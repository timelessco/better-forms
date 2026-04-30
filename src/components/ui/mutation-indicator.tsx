import { useMutationState } from "@tanstack/react-query";

/**
 * Dev-only indicator showing pending mutations.
 * Positioned in top-left corner.
 *
 * Uses useMutationState from TanStack Query v5 to track all pending mutations.
 */
export const MutationIndicator = () => {
  const pendingMutations = useMutationState({
    filters: { status: "pending" },
    select: () => 1,
  });

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (pendingMutations.length === 0) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="bg-plain-reverse text-plain fixed top-1 left-1 z-50 flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs"
    >
      <span className="bg-plain size-4 animate-pulse rounded-full" />
      Saving {pendingMutations.length}...
    </div>
  );
};
