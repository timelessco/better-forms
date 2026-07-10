import { generateNKeysBetween } from "fractional-indexing";
import { log } from "evlog";
import { toast } from "sonner";

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

/** Move `activeId` to `overId`'s slot after a dnd-kit drag, backfill fresh ordered indexes over the
 * whole list, and persist every row whose index changed (each failure toasts `errorLabel`). Bails
 * when there's no drop target, the item is dropped on itself, or either id is missing. `onReordered`
 * fires once after a successful reorder (e.g. to flip a sidebar into manual-sort mode). */
export const applyReorder = <T>({
  items,
  activeId,
  overId,
  getId,
  getSortIndex,
  persist,
  errorLabel,
  onReordered,
}: {
  items: readonly T[];
  activeId: string | number;
  overId: string | number | undefined;
  getId: (item: T) => string;
  getSortIndex: (item: T) => string | null | undefined;
  persist: (item: T, index: string) => Promise<unknown>;
  errorLabel: string;
  onReordered?: () => void;
}): void => {
  if (overId == null || activeId === overId) return;

  const oldIdx = items.findIndex((it) => getId(it) === activeId);
  const newIdx = items.findIndex((it) => getId(it) === overId);
  if (oldIdx < 0 || newIdx < 0) return;

  const reordered = [...items];
  const [moved] = reordered.splice(oldIdx, 1);
  reordered.splice(newIdx, 0, moved);

  try {
    const indexes = generateOrderedIndexes(reordered.length);
    reordered.forEach((item, i) => {
      if ((getSortIndex(item) ?? null) !== indexes[i]) {
        persist(item, indexes[i]).catch(() => toast.error(errorLabel));
      }
    });
    onReordered?.();
  } catch (err) {
    log.error({
      tag: "sort-utils",
      msg: `Failed to compute sort indexes (${errorLabel})`,
      error: err,
    });
  }
};

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
