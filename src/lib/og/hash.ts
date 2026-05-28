import { createHash } from "node:crypto";

/** Bump on any OG template change — next render emits new URLs, invalidating
 * every edge-cached OG image without manual purge. */
export const TEMPLATE_VERSION = 3;

export type OgHashInput = {
  title: string;
  description: string;
};

/** Content-addressed short hash, mixed with TEMPLATE_VERSION so a template change
 * rotates every URL. */
export const computeOgHash = ({ title, description }: OgHashInput): string => {
  const payload = `${TEMPLATE_VERSION}\n${title}\n${description}`;
  const buf = createHash("sha256").update(payload).digest();
  return buf.toString("base64url").slice(0, 10);
};
