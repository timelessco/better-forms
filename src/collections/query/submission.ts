import { createCollection } from "@tanstack/db";
import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

export type SubmissionSummary = {
  formId: string;
  total: number;
};

type SubmissionSummaryCollectionConfig = {
  queryClient: QueryClient;
  formId: string;
  queryFn: () => Promise<{ total: number }>;
};

/** Lightweight submission count for dashboard/card surfaces */
export const createSubmissionSummaryCollection = (config: SubmissionSummaryCollectionConfig) => {
  const { queryClient, formId, queryFn } = config;

  return createCollection(
    queryCollectionOptions<SubmissionSummary, unknown, string[]>({
      queryKey: ["submissions-count", formId],
      queryFn: async () => {
        const result = await queryFn();
        return [{ formId, total: result.total }];
      },
      queryClient,
      getKey: (item): string | number => item.formId,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }),
  );
};
