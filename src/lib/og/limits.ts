// OG text limits — shared by the description extractor and the OG renderer so
// the URL hash matches what's painted. Don't change 180: bumping invalidates
// every cached OG URL via the hash.
export const MAX_OG_TITLE_LENGTH = 100;
export const MAX_OG_DESCRIPTION_LENGTH = 180;

/** Word-boundary truncation + ellipsis. Reserves 2 chars (space + …); hard cut
 * if no space in the latter half. */
export const clampOgText = (text: string, max: number): string => {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 2);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut} …`;
};
