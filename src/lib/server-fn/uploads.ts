import { createServerFn } from "@tanstack/react-start";
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import { putBlob } from "@/integrations/blob";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";

/** Upload avatar image (base64) to Vercel Blob; returns public URL. */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      base64: v.string(),
      filename: v.optional(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const contentTypeMatch = data.base64.match(/^data:(image\/\w+);base64,/);
    const contentType = contentTypeMatch?.[1] || "image/png";

    const extension = contentType.split("/")[1] || "png";
    const filename = data.filename || `avatar-${userId}-${Date.now()}.${extension}`;

    const blob = await putBlob(`avatars/${filename}`, buffer, contentType);

    return { url: blob.url };
  });

/** Upload media (image/video/audio/pdf) for the editor canvas (auth required; Plate media placeholder). */
export const uploadEditorMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      base64: v.pipe(v.string(), v.minLength(1)),
      filename: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      contentType: v.pipe(v.string(), v.minLength(1), v.maxLength(127)),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    const base64Data = data.base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0) {
      throw createError({
        code: "uploads/empty-file" satisfies ErrorCode,
        status: 400,
        message: "The uploaded file is empty",
        why: "Decoded base64 buffer is zero bytes",
        fix: "Choose a non-empty file and try again",
      });
    }

    const key = `editor/${userId}/${crypto.randomUUID()}-${data.filename}`;
    const blob = await putBlob(key, buffer, data.contentType);

    return {
      url: blob.url,
      name: data.filename,
      size: buffer.length,
      type: data.contentType,
    };
  });
