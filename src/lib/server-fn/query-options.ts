/**
 * Shared query option factories for TanStack DB collections.
 *
 * These are the **source of truth** for the query keys used by the
 * corresponding `*.collection.ts` files.  Route loaders call these to
 * prefetch data so the TanStack Query cache is warm when collections
 * initialise.
 *
 * WARNING: The `queryKey` values here MUST exactly match the keys in
 *   - src/collections/query/workspace.ts     ("workspaces-with-forms")
 *   - src/collections/query/form-listing.ts  ("form-listings", "favorites")
 * Changing a key in one place without updating the other will cause a
 * cache miss and an unnecessary network round-trip.
 */

import { queryOptions } from "@tanstack/react-query";
import type { WorkspaceSummary } from "@/collections/query/workspace";
import { getFormListings } from "@/lib/server-fn/forms";
import { getFavorites } from "@/lib/server-fn/favorites";
import { getWorkspaces } from "@/lib/server-fn/workspaces";

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Fetches workspaces with an empty `forms` array. `WorkspaceSummary.forms` is
 * vestigial — nothing reads it. The sidebar's per-workspace form list comes
 * from the separate form-listings collection (joined by `form.workspaceId`),
 * and heavy form content is enriched on demand (see `useForm`/`enrichFormDetail`).
 * Keeping workspaces lightweight here is the intended optimization.
 *
 * Shared by the prefetch options below and the workspaces collection's injected
 * queryFn (in `_authenticated.tsx`) so the two definitions can't drift.
 */
export const fetchWorkspacesWithEmptyForms = async (): Promise<WorkspaceSummary[]> => {
  const result = await getWorkspaces();
  return result.workspaces.map((ws) => ({ ...ws, forms: [] }));
};

/** Prefetch-friendly query options for the workspaces collection. */
export const workspacesCollectionQueryOptions = () =>
  queryOptions({
    queryKey: ["workspaces-with-forms"] as const,
    queryFn: fetchWorkspacesWithEmptyForms,
    staleTime: FIVE_MINUTES,
  });

/**
 * Prefetch-friendly query options for form listings.
 */
export const formListingsCollectionQueryOptions = () =>
  queryOptions({
    queryKey: ["form-listings"] as const,
    queryFn: () => getFormListings(),
    staleTime: FIVE_MINUTES,
  });

/**
 * Prefetch-friendly query options for the current user's favourites.
 */
export const favoritesCollectionQueryOptions = () =>
  queryOptions({
    queryKey: ["favorites"] as const,
    queryFn: () => getFavorites(),
    staleTime: FIVE_MINUTES,
  });
