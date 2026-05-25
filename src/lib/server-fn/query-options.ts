/**
 * Shared query option factories for TanStack DB collections.
 *
 * These are the **source of truth** for the query keys used by the
 * corresponding `*.collection.ts` files.  Route loaders call these to
 * prefetch data so the TanStack Query cache is warm when collections
 * initialise.
 *
 * WARNING: The `queryKey` values here MUST exactly match the keys in
 *   - src/db-collections/workspace-query.collection.ts  ("workspaces-with-forms")
 *   - src/db-collections/form-listing-query.collection.ts ("form-listings", "favorites")
 * Changing a key in one place without updating the other will cause a
 * cache miss and an unnecessary network round-trip.
 */

import { queryOptions } from "@tanstack/react-query";
import { getFormListings } from "@/lib/server-fn/forms";
import { getFavorites } from "@/lib/server-fn/favorites";
import { getWorkspaces } from "@/lib/server-fn/workspaces";

const FIVE_MINUTES = 1000 * 60 * 5;

/**
 * Prefetch-friendly query options for workspaces with an empty `forms` array.
 * The collection will merge real form data once it loads.
 */
export const workspacesCollectionQueryOptions = () =>
  queryOptions({
    queryKey: ["workspaces-with-forms"] as const,
    queryFn: async () => {
      const result = await getWorkspaces();
      return result.workspaces.map((ws) => ({ ...ws, forms: [] as const }));
    },
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
