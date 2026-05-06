import { createHash } from "node:crypto";

/**
 * Bump when the OG card template changes (layout, fonts, colors, sizing).
 * The next HTML render will emit a new URL for every form, naturally
 * invalidating every form's edge-cached OG image without manual purge.
 */
export const TEMPLATE_VERSION = 1;

export type OgHashInput = {
  title: string;
  description: string;
};

/**
 * Content-addressed short hash. Mixed with TEMPLATE_VERSION so a template
 * design change invalidates every form's URL on next HTML render.
 */
export const computeOgHash = ({ title, description }: OgHashInput): string => {
  const payload = `${TEMPLATE_VERSION}\n${title}\n${description}`;
  const buf = createHash("sha256").update(payload).digest();
  return buf.toString("base64url").slice(0, 10);
};
