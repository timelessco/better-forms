import { createServerFn } from "@tanstack/react-start";
import { putBlob } from "@/integrations/blob";
import { getRequestIP } from "@tanstack/react-start/server";
import { and, eq, sql } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import type { Value } from "platejs";
import { z } from "zod";
import { forms, formVersions, uploadRateLimits } from "@/db/schema";
import { db } from "@/db";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import {
  buildAcceptString,
  DEFAULT_MAX_FILE_SIZE_MB,
  getExtensionForMime,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";

/** Public form file uploads — NO auth. Hardened by: (1) Postgres per-IP rate limit; (2) form must
 * exist + be published + have a FileUpload field of that name; (3) MIME allowlist vs field accept;
 * (4) max size. */

const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 20;
const CLEANUP_PROBABILITY = 0.01;
// Hard upper bound: refuse beyond this even if a field is configured higher.
const HARD_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx";

const getClientIp = (): string => getRequestIP({ xForwardedFor: true }) ?? "unknown";

// SQL literal: Postgres can't concat a parameterized int with text in an interval cast. Build-time constant, safe.
const WINDOW_INTERVAL_SQL = sql.raw(`interval '${WINDOW_MINUTES} minutes'`);

const checkUploadRateLimit = async (ip: string): Promise<void> => {
  if (Math.random() < CLEANUP_PROBABILITY) {
    await db.execute(
      sql`DELETE FROM upload_rate_limits WHERE window_start < now() - interval '1 hour'`,
    );
  }

  // Atomic upsert: insert count=1, or on conflict reset (window expired) or increment.
  const result = await db
    .insert(uploadRateLimits)
    .values({ ip, count: 1 })
    .onConflictDoUpdate({
      target: uploadRateLimits.ip,
      set: {
        count: sql`CASE
          WHEN ${uploadRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN 1
          ELSE ${uploadRateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${uploadRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN now()
          ELSE ${uploadRateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: uploadRateLimits.count });

  const newCount = result[0]?.count ?? 0;
  if (newCount > MAX_PER_WINDOW) {
    throw createError({
      code: "uploads/rate-limited" satisfies ErrorCode,
      status: 429,
      message: "Too many uploads. Please try again later.",
      why: `Upload count exceeded ${MAX_PER_WINDOW} per ${WINDOW_MINUTES}-minute window for this IP`,
      fix: `Wait a few minutes before uploading again`,
      internal: { ip, count: newCount, windowMinutes: WINDOW_MINUTES },
    });
  }
};

const isMimeAllowed = (contentType: string, accept: string): boolean => {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const mime = contentType.toLowerCase();
  for (const token of tokens) {
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1); // "image/"
      if (mime.startsWith(prefix)) return true;
    } else if (token.startsWith(".")) {
      const ext = getExtensionForMime(mime);
      if (ext && `.${ext}` === token) return true;
    } else if (token === mime) {
      return true;
    }
  }
  return false;
};

const assertFormFileField = async (
  formId: string,
  fieldName: string,
): Promise<{ accept: string; maxFileBytes: number }> => {
  const [form] = await db
    .select({
      status: forms.status,
      lastPublishedVersionId: forms.lastPublishedVersionId,
      draftContent: forms.content,
    })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.status, "published")));

  if (!form) {
    throw createError({
      code: "forms/not-found" satisfies ErrorCode,
      status: 404,
      message: "Form not found",
      why: "No published form exists with this ID",
      fix: "Check the form URL — it may have been unpublished or deleted",
      internal: { formId },
    });
  }

  let content: Value | null = null;
  if (form.lastPublishedVersionId) {
    const [version] = await db
      .select({ content: formVersions.content })
      .from(formVersions)
      .where(eq(formVersions.id, form.lastPublishedVersionId));
    content = (version?.content ?? null) as Value | null;
  } else {
    content = (form.draftContent ?? null) as Value | null;
  }

  if (!content) {
    throw createError({
      code: "uploads/form-no-content" satisfies ErrorCode,
      status: 422,
      message: "This form has no content",
      why: "Published version or draft content is empty — nothing to upload against",
      fix: "Publish the form with content before accepting uploads",
      internal: { formId },
    });
  }

  const elements = transformPlateStateToFormElements(content);
  const editable = getEditableFields(elements);
  const field = editable.find((f) => f.fieldType === "FileUpload" && f.name === fieldName);
  if (!field) {
    throw createError({
      code: "uploads/field-not-found" satisfies ErrorCode,
      status: 422,
      message: "No file upload field matches the provided name",
      why: "fieldName doesn't correspond to a FileUpload field on the published form",
      fix: "Verify the field name from the rendered form",
      internal: { formId, fieldName },
    });
  }
  // Prefer granular allowedFileTypes/Extensions (block menu); else legacy accept; else default
  // for forms predating the type picker.
  const allowedFileTypes = "allowedFileTypes" in field ? field.allowedFileTypes : undefined;
  const allowedFileExtensions =
    "allowedFileExtensions" in field ? field.allowedFileExtensions : undefined;
  const legacyAccept =
    "accept" in field && typeof field.accept === "string" && field.accept.length > 0
      ? field.accept
      : null;
  const { category, subtypes } = resolveAllowedSubtypes(allowedFileTypes, allowedFileExtensions);
  const accept =
    allowedFileTypes !== undefined
      ? buildAcceptString(category, subtypes)
      : (legacyAccept ?? DEFAULT_ACCEPT);

  const fieldMaxFileSize =
    "maxFileSize" in field && typeof field.maxFileSize === "number" && field.maxFileSize > 0
      ? field.maxFileSize
      : DEFAULT_MAX_FILE_SIZE_MB;
  const maxFileBytes = Math.min(fieldMaxFileSize * 1024 * 1024, HARD_MAX_FILE_BYTES);

  return { accept, maxFileBytes };
};

const decodeBase64 = (dataUrl: string): Buffer => {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
};

export const uploadFormFile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      formId: z.uuid(),
      draftId: z.uuid(),
      fieldName: z.string().min(1),
      filename: z.string().min(1).max(255),
      contentType: z.string().min(1).max(127),
      base64: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    await checkUploadRateLimit(getClientIp());

    const { accept, maxFileBytes } = await assertFormFileField(data.formId, data.fieldName);

    if (!isMimeAllowed(data.contentType, accept)) {
      throw createError({
        code: "uploads/mime-not-allowed" satisfies ErrorCode,
        status: 400,
        message: "This file type isn't allowed for this field",
        why: "Provided content-type doesn't match the field's accept list",
        fix: "Upload a file with one of the allowed types",
        internal: { contentType: data.contentType, accept },
      });
    }

    const buffer = decodeBase64(data.base64);
    if (buffer.length === 0) {
      throw createError({
        code: "uploads/empty-file" satisfies ErrorCode,
        status: 400,
        message: "The uploaded file is empty",
        why: "Decoded base64 buffer is zero bytes",
        fix: "Choose a non-empty file and try again",
      });
    }
    if (buffer.length > maxFileBytes) {
      throw createError({
        code: "uploads/too-large" satisfies ErrorCode,
        status: 400,
        message: "This file is larger than allowed for this field",
        why: "Buffer length exceeds the field's maxFileBytes limit",
        fix: "Compress the file or pick a smaller one",
        internal: { byteSize: buffer.length, maxFileBytes },
      });
    }

    const ext = getExtensionForMime(data.contentType) ?? "bin";
    const key = `submissions/${data.formId}/${data.draftId}/${crypto.randomUUID()}.${ext}`;
    const blob = await putBlob(key, buffer, data.contentType);

    return {
      url: blob.url,
      name: data.filename,
      size: buffer.length,
      type: data.contentType,
    };
  });

export type UploadedFormFile = {
  url: string;
  name: string;
  size: number;
  type: string;
};
