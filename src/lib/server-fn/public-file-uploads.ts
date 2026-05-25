import { getRequestIP } from "@tanstack/react-start/server";
import { and, eq, sql } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import type { Value } from "platejs";
import { forms, formVersions, uploadRateLimits } from "@/db/schema";
import { db } from "@/db";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import {
  acceptStringToContentTypes,
  buildAcceptString,
  DEFAULT_MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_HARD_CAP_MB,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";

/**
 * Public form file uploads — NO auth required.
 *
 * These guards back the `/api/forms/upload` Vercel Blob client-upload token
 * route (its `onBeforeGenerateToken`). The file bytes never transit our
 * server: the browser uploads directly to Blob with a short-lived token we
 * mint only after these checks pass — which lifts the old ~4.5 MB serverless
 * request-body ceiling, so the `HARD_MAX_FILE_BYTES` cap below is now actually
 * enforceable.
 *
 * Hardened by:
 *   1. Postgres-backed per-IP rate limit
 *   2. Form must exist + be published + contain a FileUpload field with the given name
 *   3. MIME allowlist (returned as `allowedContentTypes`, enforced by Blob)
 *   4. Max size (returned as `maximumSizeInBytes`, enforced by Blob)
 */

const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 20;
const CLEANUP_PROBABILITY = 0.01;
// Hard upper bound — even if a field is configured higher, refuse beyond this.
const HARD_MAX_FILE_BYTES = MAX_FILE_SIZE_HARD_CAP_MB * 1024 * 1024;
const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx";

export const getClientIp = (): string => getRequestIP({ xForwardedFor: true }) ?? "unknown";

// Inlined as a SQL literal because Postgres can't concatenate a parameterized
// integer with text inside an interval cast. Safe: it's a build-time constant.
const WINDOW_INTERVAL_SQL = sql.raw(`interval '${WINDOW_MINUTES} minutes'`);

export const checkUploadRateLimit = async (ip: string): Promise<void> => {
  if (Math.random() < CLEANUP_PROBABILITY) {
    await db.execute(
      sql`DELETE FROM upload_rate_limits WHERE window_start < now() - interval '1 hour'`,
    );
  }

  // Atomic upsert: insert with count=1, or on conflict either reset (window expired)
  // or increment.
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

export const assertFormFileField = async (
  formId: string,
  fieldName: string,
): Promise<{ accept: string; allowedContentTypes: string[]; maxFileBytes: number }> => {
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
  // Prefer the granular allowedFileTypes/allowedFileExtensions set by the
  // block menu. Fall back to a legacy `accept` string if present, then to the
  // hardcoded default for forms that predate the type picker.
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

  return { accept, allowedContentTypes: acceptStringToContentTypes(accept), maxFileBytes };
};
