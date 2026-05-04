import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { putBlob } from "@/integrations/blob";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Upload avatar image to Vercel Blob storage.
 * Accepts base64 image data and returns the public URL.
 */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      base64: z.string(),
      filename: z.string().optional(),
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

/**
 * Upload media file (image, video, audio, pdf, etc.) for the form editor canvas.
 * Requires auth. Used by the Plate editor's media placeholder node.
 */
export const uploadEditorMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      base64: z.string().min(1),
      filename: z.string().min(1).max(255),
      contentType: z.string().min(1).max(127),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    const base64Data = data.base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0) {
      throw new Error("empty_file");
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
