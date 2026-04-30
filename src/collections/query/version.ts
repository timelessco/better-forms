import { createCollection } from "@tanstack/db";
import type { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";

export type VersionListItem = {
  id: string;
  version: number;
  title: string | null;
  publishedAt: string;
  publishedBy: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

import type { VersionedSettingsSnapshot } from "@/lib/content-hash";

export type VersionContent = {
  id: string;
  formId: string;
  version: number;
  content: object[];
  settings: VersionedSettingsSnapshot;
  customization: Record<string, string>;
  title: string | null;
  icon: string | null;
  cover: string | null;
  publishedAt: string;
  createdAt: string;
};

type VersionListCollectionConfig = {
  queryClient: QueryClient;
  formId: string;
  queryFn: () => Promise<VersionListItem[]>;
};

export const createVersionListCollection = (config: VersionListCollectionConfig) => {
  const { queryClient, formId, queryFn } = config;

  return createCollection(
    queryCollectionOptions<VersionListItem, unknown, string[]>({
      queryKey: ["form-versions", formId],
      queryFn: async () => queryFn(),
      queryClient,
      getKey: (item): string | number => item.id,
    }),
  );
};

type VersionContentCollectionConfig = {
  queryClient: QueryClient;
  versionId: string;
  queryFn: () => Promise<VersionContent | null>;
};

export const createVersionContentCollection = (config: VersionContentCollectionConfig) => {
  const { queryClient, versionId, queryFn } = config;

  return createCollection(
    queryCollectionOptions<VersionContent, unknown, string[]>({
      queryKey: ["form-version-content", versionId],
      queryFn: async () => {
        const result = await queryFn();
        return result ? [result] : [];
      },
      queryClient,
      getKey: (item): string | number => item.id,
      staleTime: 1000 * 60 * 30, // 30 minutes — version content is immutable
    }),
  );
};
