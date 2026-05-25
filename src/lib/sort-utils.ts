import { generateNKeysBetween } from "fractional-indexing";

/**
 * Generate a fresh, ascending list of fractional indexes for N items.
 * Use this to rewrite a list's order after a drag, ensuring a consistent
 * sequence even when some items had no previous sortIndex (lazy backfill).
 */
export const generateOrderedIndexes = (count: number): string[] =>
  count === 0 ? [] : generateNKeysBetween(null, null, count);

/**
 * Sort a list by `sortIndex` first, falling back to `fallback` (e.g. updatedAt)
 * for rows where `sortIndex` hasn't been set yet (lazy backfill).
 * Rows with a sortIndex appear before rows without.
 */
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

/**
 * Lowest existing `sortIndex` in a list, or `null` if none have one yet.
 * Pass to `generateKeyBetween(null, leading)` to produce an index that places
 * a new item before every other.
 */
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
