// OG image text limits — shared between the Plate-tree description extractor
// (extract-description.ts) and the takumi renderer (render.server.ts) so the
// hash baked into the URL agrees with what the renderer actually paints.
//
// The description limit (180) is unchanged from the previous extract-description
// constant — bumping it would invalidate every cached OG URL via the hash.
export const MAX_OG_TITLE_LENGTH = 100;
export const MAX_OG_DESCRIPTION_LENGTH = 180;

/**
 * Word-boundary truncation with an ellipsis, matching the behaviour the
 * description extractor has used since day 1. Reserves 2 chars for the
 * trailing space + ellipsis. If no space is available in the latter half of
 * the slice it falls back to a hard cut.
 */
export const clampOgText = (text: string, max: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 2);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut} …`;
};
