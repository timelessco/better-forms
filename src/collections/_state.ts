import type { QueryClient } from "@tanstack/query-core";
import type {
  createFavoriteCollection,
  createFormListingCollection,
  FormFavorite,
  FormListing,
} from "./query/form-listing";
import type {
  createVersionContentCollection,
  createVersionListCollection,
  VersionContent,
  VersionListItem,
} from "./query/version";
import type { createWorkspaceSummaryCollection, WorkspaceSummary } from "./query/workspace";
import type { Form } from "./local/form";
import type {
  bulkArchiveForms,
  bulkDeleteForms,
  createForm,
  deleteForm,
  updateForm,
} from "@/lib/server-fn/forms";
import type {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  reorderWorkspace,
} from "@/lib/server-fn/workspaces";
import type { addFavorite, removeFavorite, reorderFavorite } from "@/lib/server-fn/favorites";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` required: function constraints need contravariant params
type ServerFn = (...args: any[]) => any;
export type ServerFnInput<T extends ServerFn> = NonNullable<Parameters<T>[0]>["data"];
export type ServerFnOutput<T extends ServerFn> = Awaited<ReturnType<T>>;

/** Convert null values to undefined so collection data aligns with Zod-validated server fn inputs */
type NullToUndefined<T> = {
  [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
};

export const stripNulls = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v]),
  ) as NullToUndefined<T>;

export type ServerFns = {
  getWorkspacesWithForms: () => Promise<{ workspaces: WorkspaceSummary[] }>;
  getFormListings: () => Promise<FormListing[]>;
  getFormDetail: (formId: string) => Promise<Form | null>;
  getFavorites: () => Promise<FormFavorite[]>;
  getVersionList: (formId: string) => Promise<VersionListItem[]>;
  getVersionContent: (versionId: string) => Promise<VersionContent | null>;
  getSubmissionsCount: (formId: string) => Promise<{ total: number }>;
  createWorkspace: (
    data: ServerFnInput<typeof createWorkspace>,
  ) => Promise<ServerFnOutput<typeof createWorkspace>>;
  updateWorkspace: (
    data: ServerFnInput<typeof updateWorkspace>,
  ) => Promise<ServerFnOutput<typeof updateWorkspace>>;
  deleteWorkspace: (
    data: ServerFnInput<typeof deleteWorkspace>,
  ) => Promise<ServerFnOutput<typeof deleteWorkspace>>;
  createForm: (
    data: ServerFnInput<typeof createForm>,
  ) => Promise<ServerFnOutput<typeof createForm>>;
  updateForm: (
    data: ServerFnInput<typeof updateForm>,
  ) => Promise<ServerFnOutput<typeof updateForm>>;
  deleteForm: (
    data: ServerFnInput<typeof deleteForm>,
  ) => Promise<ServerFnOutput<typeof deleteForm>>;
  bulkArchiveForms: (
    data: ServerFnInput<typeof bulkArchiveForms>,
  ) => Promise<ServerFnOutput<typeof bulkArchiveForms>>;
  bulkDeleteForms: (
    data: ServerFnInput<typeof bulkDeleteForms>,
  ) => Promise<ServerFnOutput<typeof bulkDeleteForms>>;
  addFavorite: (
    data: ServerFnInput<typeof addFavorite>,
  ) => Promise<ServerFnOutput<typeof addFavorite>>;
  removeFavorite: (
    data: ServerFnInput<typeof removeFavorite>,
  ) => Promise<ServerFnOutput<typeof removeFavorite>>;
  reorderFavorite: (
    data: ServerFnInput<typeof reorderFavorite>,
  ) => Promise<ServerFnOutput<typeof reorderFavorite>>;
  reorderWorkspace: (
    data: ServerFnInput<typeof reorderWorkspace>,
  ) => Promise<ServerFnOutput<typeof reorderWorkspace>>;
};

export const state = {
  serverFns: null as ServerFns | null,
  queryClient: null as QueryClient | null,
  workspaces: null as ReturnType<typeof createWorkspaceSummaryCollection> | null,
  formListings: null as ReturnType<typeof createFormListingCollection> | null,
  favorites: null as ReturnType<typeof createFavoriteCollection> | null,
  enrichedFormIds: new Set<string>(),
  versionListCache: new Map<string, ReturnType<typeof createVersionListCollection>>(),
  versionContentCache: new Map<string, ReturnType<typeof createVersionContentCollection>>(),
};

export const isInitialized = () => state.serverFns !== null && state.queryClient !== null;

/** Return all initialized singletons, throwing if not yet initialized. */
export const getInit = () => {
  if (!state.serverFns || !state.queryClient) {
    throw new Error("Collections not initialized. Call initCollections() first.");
  }
  return {
    serverFns: state.serverFns,
    queryClient: state.queryClient,
    workspaces: state.workspaces as NonNullable<typeof state.workspaces>,
    formListings: state.formListings as NonNullable<typeof state.formListings>,
    favorites: state.favorites as NonNullable<typeof state.favorites>,
  };
};
