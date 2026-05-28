// Sprite-icon extraction. Icon = sprite name (e.g. "fingerprint-03"), image
// URL, or null. Satori (@vercel/og) only rasterizes <img>, not <svg>/<use> —
// so extract the <symbol>, wrap in a standalone <svg>, return a base64 data URL.

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
 * Extract one symbol from the sprite as a standalone SVG with `fill`. `null` if absent.
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

/** `data:image/svg+xml;base64,...` URL for a sprite icon, or null. Satori's
 * <img> rasterizes the data URL with no network round-trip. */
export const buildIconDataUrl = (sprite: string, name: string, fill: string): string | null => {
  const svg = extractStandaloneIconSvg(sprite, name, fill);
  if (!svg) return null;
  // `Buffer` ok — server-fn-only module.
  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
};
