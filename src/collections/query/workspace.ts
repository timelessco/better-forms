import { createCollection } from "@tanstack/db";
import type { InsertMutationFn, UpdateMutationFn, DeleteMutationFn } from "@tanstack/db";
import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

export type FormSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  workspaceId: string;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  organizationId: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  sortIndex?: string | null;
  forms: FormSummary[];
};

type WorkspaceSummaryCollectionConfig = {
  queryClient: QueryClient;
  /** Server function to fetch workspaces with forms. Injected for testability. */
  queryFn: () => Promise<{ workspaces: WorkspaceSummary[] }>;
  onInsert?: InsertMutationFn<WorkspaceSummary>;
  onUpdate?: UpdateMutationFn<WorkspaceSummary>;
  onDelete?: DeleteMutationFn<WorkspaceSummary>;
};

export const createWorkspaceSummaryCollection = (config: WorkspaceSummaryCollectionConfig) => {
  const { queryClient, queryFn, onInsert, onUpdate, onDelete } = config;

  return createCollection(
    queryCollectionOptions<WorkspaceSummary, unknown, string[]>({
      queryKey: ["workspaces-with-forms"],
      queryFn: async () => {
        const result = await queryFn();
        return result.workspaces;
      },
      queryClient,
      getKey: (item): string | number => item.id,
      staleTime: 1000 * 60 * 5,
      onInsert,
      onUpdate,
      onDelete,
    }),
  );
};
