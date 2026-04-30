import { createCollection } from "@tanstack/db";
import type { InsertMutationFn, UpdateMutationFn, DeleteMutationFn } from "@tanstack/db";
import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { FormSettings } from "@/types/form-settings";

export type FormListing = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
  createdAt: string;
  workspaceId: string;
  icon: string | null;
  formName: string;
  sortIndex?: string | null;
  customization?: Record<string, unknown> | null;
  submissionCount: number;
  settings?: FormSettings;
  slug?: string | null;
  customDomainId?: string | null;
  publishedContentHash?: string | null;
  lastPublishedVersionId?: string | null;
  // Heavy fields — populated on-demand when editor opens a form (enrichment)
  content?: unknown[];
  schemaName?: string | null;
  cover?: string | null;
  createdByUserId?: string | null;
};

export type FormFavorite = {
  id: string;
  userId: string;
  formId: string;
  sortIndex?: string | null;
  createdAt: string;
};

type FormListingCollectionConfig = {
  queryClient: QueryClient;
  queryFn: () => Promise<FormListing[]>;
  onInsert?: InsertMutationFn<FormListing>;
  onUpdate?: UpdateMutationFn<FormListing>;
  onDelete?: DeleteMutationFn<FormListing>;
};

export const createFormListingCollection = (config: FormListingCollectionConfig) => {
  const { queryClient, queryFn, onInsert, onUpdate, onDelete } = config;

  // Closure ref set after collection creation — used by enrichedQueryFn
  // to merge lightweight listing data with existing enriched records,
  // preventing refetches from wiping heavy fields (content, settings, etc.).
  let collectionRef: { get: (id: string | number) => FormListing | undefined } | null = null;

  const enrichedQueryFn = async () => {
    const listings = await queryFn();
    const ref = collectionRef;
    if (!ref) return listings;
    // Short-circuit: skip per-item merge when no forms have been enriched yet
    if (!listings.some((l) => ref.get(l.id)?.content !== undefined)) return listings;
    return listings.map((listing) => {
      const existing = ref.get(listing.id);
      return existing ? { ...existing, ...listing } : listing;
    });
  };

  const collection = createCollection(
    queryCollectionOptions<FormListing, unknown, string[]>({
      queryKey: ["form-listings"],
      queryFn: enrichedQueryFn,
      queryClient,
      getKey: (item): string | number => item.id,
      staleTime: 1000 * 60 * 5,
      onInsert,
      onUpdate,
      onDelete,
    }),
  );

  collectionRef = collection;
  return collection;
};

type FavoriteCollectionConfig = {
  queryClient: QueryClient;
  queryFn: () => Promise<FormFavorite[]>;
  onInsert?: InsertMutationFn<FormFavorite>;
  onUpdate?: UpdateMutationFn<FormFavorite>;
  onDelete?: DeleteMutationFn<FormFavorite>;
};

export const createFavoriteCollection = (config: FavoriteCollectionConfig) => {
  const { queryClient, queryFn, onInsert, onUpdate, onDelete } = config;

  return createCollection(
    queryCollectionOptions<FormFavorite, unknown, string[]>({
      queryKey: ["favorites"],
      queryFn: async () => queryFn(),
      queryClient,
      getKey: (item): string | number => item.id,
      staleTime: 1000 * 60 * 5,
      onInsert,
      onUpdate,
      onDelete,
    }),
  );
};
