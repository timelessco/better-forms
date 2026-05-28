import { createFileRoute } from "@tanstack/react-router";
import { handleUpload } from "@vercel/blob/client";
import type { HandleUploadBody } from "@vercel/blob/client";
import * as v from "valibot";
import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";
import { parseError } from "@/lib/errors/parse";
import {
  assertFormFileField,
  checkUploadRateLimit,
  getClientIp,
} from "@/lib/server-fn/public-file-uploads";

/**
 * Vercel Blob client-upload token route for public form file fields.
 *
 * The browser calls `upload(...)` (from `@vercel/blob/client`) which POSTs
 * here to mint a short-lived, scoped token, then uploads the bytes directly to
 * Blob — so files never transit this function. All hardening runs inside
 * `onBeforeGenerateToken`; the size/MIME limits we return are enforced by Blob
 * itself at upload time.
 *
 * No `onUploadCompleted` handler: `upload()` resolves on the client with the
 * blob URL, which the field carries into the submission payload. (The webhook
 * also can't reach localhost without a tunnel.)
 */

const clientPayloadSchema = v.object({
  formId: v.pipe(v.string(), v.uuid()),
  draftId: v.pipe(v.string(), v.uuid()),
  fieldName: v.pipe(v.string(), v.minLength(1)),
});

export const Route = createFileRoute("/api/forms/upload")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as HandleUploadBody;
        try {
          const result = await handleUpload({
            request,
            body,
            token: process.env.BETTER_FORM_READ_WRITE_TOKEN,
            onBeforeGenerateToken: async (pathname, clientPayloadRaw) => {
              const payload = v.parse(clientPayloadSchema, JSON.parse(clientPayloadRaw ?? "{}"));

              await checkUploadRateLimit(getClientIp());
              const { allowedContentTypes, maxFileBytes } = await assertFormFileField(
                payload.formId,
                payload.fieldName,
              );

              // The client proposes the pathname; pin it to this form+draft's
              // namespace so a tampered client can't write under another form.
              const expectedPrefix = `submissions/${payload.formId}/${payload.draftId}/`;
              if (!pathname.startsWith(expectedPrefix)) {
                throw createError({
                  code: "uploads/field-not-found" satisfies ErrorCode,
                  status: 400,
                  message: "Upload path does not match this form",
                  why: "Proposed pathname is outside the form+draft submission namespace",
                  fix: "Re-pick the file from the rendered form",
                  internal: { pathname, expectedPrefix },
                });
              }

              return {
                addRandomSuffix: true,
                maximumSizeInBytes: maxFileBytes,
                ...(allowedContentTypes.length > 0 ? { allowedContentTypes } : {}),
                tokenPayload: JSON.stringify({
                  formId: payload.formId,
                  draftId: payload.draftId,
                }),
              };
            },
          });

          return Response.json(result);
        } catch (err) {
          const parsed = parseError(err);
          return Response.json(
            { error: parsed.code ?? "upload_failed", message: parsed.message },
            { status: parsed.status ?? 400 },
          );
        }
      },
    },
  },
});
