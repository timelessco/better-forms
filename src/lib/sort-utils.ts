import { generateNKeysBetween } from "fractional-indexing";

/** N fresh ascending fractional indexes. Rewrites list order after a drag, even
 * when items lacked a prior sortIndex (lazy backfill). */
export const generateOrderedIndexes = (count: number): string[] =>
  count === 0 ? [] : generateNKeysBetween(null, null, count);

/** Sort by `sortIndex`, falling back to `fallback` (e.g. updatedAt) for unset
 * rows (lazy backfill). Rows with a sortIndex sort before those without. */
export const sortByManualOrder = <T extends { sortIndex?: string | null }>(
  items: readonly T[],
  fallback: (a: T, b: T) => number,
): T[] =>
  [...items].toSorted((a, b) => {
    const aIdx = a.sortIndex ?? null;
    const bIdx = b.sortIndex ?? null;
    if (aIdx && bIdx) return aIdx < bIdx ? -1 : aIdx > bIdx ? 1 : 0;
    if (aIdx) return -1;
    if (bIdx) return 1;
    return fallback(a, b);
  });

/** Lowest existing `sortIndex`, or `null`. Pass to
 * `generateKeyBetween(null, leading)` to place a new item before all others. */
export const getLeadingSortIndex = (
  items: readonly { sortIndex?: string | null }[],
): string | null => {
  let leading: string | null = null;
  for (const item of items) {
    const idx = item.sortIndex ?? null;
    if (idx && (leading === null || idx < leading)) leading = idx;
  }
  return leading;
};
