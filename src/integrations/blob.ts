import { put } from "@vercel/blob";

/**
 * Upload a buffer/blob to Vercel Blob storage as a public object.
 * Centralizes the access level and token so callers don't repeat boilerplate.
 */
export const putBlob = (key: string, body: Buffer | Blob, contentType: string) =>
  put(key, body, {
    access: "public",
    contentType,
    token: process.env.BETTER_FORM_READ_WRITE_TOKEN,
  });
