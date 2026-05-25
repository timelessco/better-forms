// Shared sprite-icon extraction. The form's icon field can be a sprite name
// (e.g. "fingerprint-03"), an uploaded image URL, or null. Satori (used by
// @vercel/og) doesn't render <svg>/<use> tags directly — it only rasterizes
// images via <img>. So we extract the matching <symbol> from the bundled
// sprite, wrap it in a complete <svg>, and return a base64 data URL the
// OG card can use as <img src={...}>.

const NAME_RE = /^[a-z0-9-]{1,64}$/i;
const URL_RE = /^https?:\/\//i;

const sanitizeSvgFragment = (fragment: string): string =>
  fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");

export const isIconUrl = (icon: string | null | undefined): boolean => !!icon && URL_RE.test(icon);

export const isSpriteIconName = (icon: string | null | undefined): boolean =>
  !!icon && NAME_RE.test(icon);

/**
 * Extract a single icon symbol from the bundled sprite and return a complete,
 * standalone SVG document with the requested fill applied. Returns `null` if
 * the symbol isn't present.
 */
export const extractStandaloneIconSvg = (
  sprite: string,
  name: string,
  fill: string,
): string | null => {
  if (!isSpriteIconName(name)) return null;
  const re = new RegExp(`<symbol[^>]*\\bid="${name}"[^>]*>([\\s\\S]*?)</symbol>`, "i");
  const match = sprite.match(re);
  if (!match) return null;
  const inner = sanitizeSvgFragment(match[1]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}">${inner}</svg>`;
};

/**
 * Returns a `data:image/svg+xml;base64,...` URL for the given sprite icon, or
 * null if the symbol isn't found. Satori's <img> can rasterize the data URL
 * directly without a network round-trip.
 */
export const buildIconDataUrl = (sprite: string, name: string, fill: string): string | null => {
  const svg = extractStandaloneIconSvg(sprite, name, fill);
  if (!svg) return null;
  // `Buffer` is fine here; this module only runs in the server function.
  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
};
