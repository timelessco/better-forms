import { put } from "@vercel/blob";

/** Upload to Vercel Blob as a public object; centralizes access level + token. */
export const putBlob = (key: string, body: Buffer | Blob, contentType: string) =>
  put(key, body, {
    access: "public",
    contentType,
    token: process.env.BETTER_FORM_READ_WRITE_TOKEN,
  });
