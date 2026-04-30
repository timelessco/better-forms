import { createTransaction } from "@tanstack/react-db";
import { createVersionContentCollection, createVersionListCollection } from "./query/version";
import type { FormListing } from "./query/form-listing";
import type { WorkspaceSummary } from "./query/workspace";
import { defaultFormSettings } from "@/types/form-settings";
import { DEFAULT_FORM_CONTENT } from "./local/form";
import type { Form } from "./local/form";
import { getInit, state, stripNulls } from "./_state";

export const getWorkspaces = () => getInit().workspaces;
export const getFormListings = () => getInit().formListings;
export const getFavorites = () => getInit().favorites;
export const getQueryClient = () => getInit().queryClient;

export const enrichFormDetail = async (formId: string) => {
  const { serverFns, formListings } = getInit();
  if (state.enrichedFormIds.has(formId)) return null;
  const detail = await serverFns.getFormDetail(formId);
  if (detail) {
    const existing = formListings.get(formId);
    formListings.utils.writeUpdate({
      ...existing,
      ...detail,
      id: formId,
    } as unknown as FormListing);
    state.enrichedFormIds.add(formId);
  }
  return null;
};

export const getVersionList = (formId: string) => {
  const { queryClient, serverFns } = getInit();
  let collection = state.versionListCache.get(formId);
  if (!collection) {
    collection = createVersionListCollection({
      queryClient,
      formId,
      queryFn: () => serverFns.getVersionList(formId),
    });
    state.versionListCache.set(formId, collection);
  }
  return collection;
};

export const getVersionContent = (versionId: string) => {
  const { queryClient, serverFns } = getInit();
  let collection = state.versionContentCache.get(versionId);
  if (!collection) {
    collection = createVersionContentCollection({
      queryClient,
      versionId,
      queryFn: () => serverFns.getVersionContent(versionId),
    });
    state.versionContentCache.set(versionId, collection);
  }
  return collection;
};

export const createFormLocal = (
  workspaceId: string,
  title = "Untitled",
): { form: Form; persisted: Promise<void> } => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const newForm: Form = {
    id,
    workspaceId,
    title,
    formName: "draft",
    schemaName: "draftFormSchema",
    content: DEFAULT_FORM_CONTENT,
    icon: null,
    cover: null,
    status: "draft",
    settings: defaultFormSettings,
    customization: {},
    createdAt: now,
    updatedAt: now,
  };

  const { serverFns, formListings } = getInit();
  const tx = createTransaction({
    mutationFn: async () => {
      await serverFns.createForm(newForm);
      await formListings.utils.refetch();
    },
  });
  tx.mutate(() => {
    formListings.insert(newForm as unknown as FormListing);
  });

  return { form: newForm, persisted: tx.isPersisted.promise.then(() => undefined) };
};

export const duplicateFormById = (formId: string): { form: Form; persisted: Promise<void> } => {
  const { serverFns, formListings } = getInit();
  const sourceForm = formListings.get(formId) as Form | undefined;
  if (!sourceForm) throw new Error(`Form not found: ${formId}`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = sourceForm.title ? `${sourceForm.title} copy` : "Untitled copy";

  const newForm: Form = {
    ...sourceForm,
    id,
    title,
    content: structuredClone(sourceForm.content),
    status: "draft",
    lastPublishedVersionId: null,
    publishedContentHash: null,
    createdAt: now,
    updatedAt: now,
  };

  const tx = createTransaction({
    mutationFn: async () => {
      await serverFns.createForm(newForm);
      await formListings.utils.refetch();
    },
  });
  tx.mutate(() => {
    formListings.insert(newForm as unknown as FormListing);
  });

  return { form: newForm, persisted: tx.isPersisted.promise.then(() => undefined) };
};

export const updateFormStatus = async (id: string, status: "draft" | "published" | "archived") => {
  const { formListings, queryClient, serverFns } = getInit();

  // Archived rows live outside the main `formListings` collection (server fn
  // filters them out). Optimistically remove from the live collection, persist
  // the status change, then prime the trash query so the dialog reflects it.
  if (status === "archived") {
    const existing = formListings.get(id);
    if (!existing) return;

    const tx = createTransaction({
      mutationFn: async () => {
        await serverFns.updateForm(stripNulls(existing) as never);
        await queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] });
      },
    });
    tx.mutate(() => {
      formListings.delete(id);
    });
    return;
  }

  formListings.update(id, (draft: Record<string, unknown>) => {
    draft.status = status;
    draft.updatedAt = new Date().toISOString();
  });
};

// Restore: form is currently in the archived listings (Query cache), not in
// `formListings`. Persist the status flip server-side, then refetch the live
// collection so the restored form shows up in the sidebar, and invalidate the
// trash listing.
export const restoreFormLocal = async (id: string) => {
  const { formListings, queryClient, serverFns } = getInit();
  const archived = queryClient.getQueryData<FormListing[]>(["form-listings-archived"]);
  const existing = archived?.find((f) => f.id === id);
  if (!existing) return;

  await serverFns.updateForm(stripNulls({ ...existing, status: "draft" }) as never);
  await Promise.all([
    formListings.utils.refetch(),
    queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] }),
  ]);
};

// Hard-delete from trash: form lives in the archived query cache, never
// touched the `formListings` collection in this session. Call the server
// directly and refresh the trash list.
export const permanentDeleteFormLocal = async (id: string) => {
  const { queryClient, serverFns } = getInit();
  await serverFns.deleteForm({ id });
  await queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] });
};

// Optimistically removes the rows from `formListings` so the sidebar
// updates immediately, then persists the status flip and invalidates the
// trash query so the next dialog open is fresh.
export const bulkArchiveFormsLocal = async (ids: string[]) => {
  if (ids.length === 0) return { archived: 0 };
  const { formListings, queryClient, serverFns } = getInit();

  let archived = 0;
  const tx = createTransaction({
    mutationFn: async () => {
      const result = await serverFns.bulkArchiveForms({ ids });
      archived = result.archived;
      await queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] });
      return result;
    },
  });
  tx.mutate(() => {
    for (const id of ids) {
      if (formListings.get(id)) formListings.delete(id);
    }
  });
  await tx.isPersisted.promise;
  return { archived };
};

// The rows aren't in `formListings` (server filters archived), so we just hit
// the server and invalidate the trash listing.
export const bulkPermanentDeleteFormsLocal = async (ids: string[]) => {
  if (ids.length === 0) return { deleted: 0 };
  const { queryClient, serverFns } = getInit();
  const result = await serverFns.bulkDeleteForms({ ids });
  await queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] });
  return result;
};

export const createWorkspaceLocal = async (
  organizationId: string,
  name = "Workspace",
): Promise<WorkspaceSummary> => {
  const { workspaces } = getInit();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ws: WorkspaceSummary = {
    id,
    organizationId,
    name,
    createdByUserId: null,
    createdAt: now,
    updatedAt: now,
    forms: [],
  };
  workspaces.insert(ws);
  return ws;
};

export const updateWorkspaceName = async (id: string, name: string) => {
  const { workspaces } = getInit();
  workspaces.update(id, (draft: Record<string, unknown>) => {
    draft.name = name;
    draft.updatedAt = new Date().toISOString();
  });
};

export const deleteWorkspaceLocal = async (id: string) => {
  getInit().workspaces.delete(id);
};

export const toggleFavoriteLocal = async (userId: string, formId: string, sortIndex?: string) => {
  const { favorites } = getInit();
  const id = `${userId}:${formId}`;
  const existing = favorites.get(id);

  if (existing) {
    favorites.delete(id);
  } else {
    favorites.insert({
      id,
      userId,
      formId,
      sortIndex: sortIndex ?? null,
      createdAt: new Date().toISOString(),
    });
  }
};

export const reorderFormLocal = async (formId: string, sortIndex: string) => {
  const { formListings } = getInit();
  formListings.update(formId, (draft: Record<string, unknown>) => {
    draft.sortIndex = sortIndex;
  });
};

export const reorderWorkspaceLocal = async (workspaceId: string, sortIndex: string) => {
  const { workspaces } = getInit();
  workspaces.update(workspaceId, (draft: Record<string, unknown>) => {
    draft.sortIndex = sortIndex;
  });
};

export const reorderFavoriteLocal = async (favoriteId: string, sortIndex: string) => {
  const { favorites } = getInit();
  favorites.update(favoriteId, (draft: Record<string, unknown>) => {
    draft.sortIndex = sortIndex;
  });
};

export const moveFormToWorkspaceLocal = async (formId: string, workspaceId: string) => {
  const { formListings } = getInit();
  formListings.update(formId, (draft: Record<string, unknown>) => {
    draft.workspaceId = workspaceId;
    draft.updatedAt = new Date().toISOString();
    draft.sortIndex = null;
  });
};

export const renameFormLocal = async (formId: string, title: string) => {
  const { formListings } = getInit();
  formListings.update(formId, (draft: Record<string, unknown>) => {
    draft.title = title;
    draft.updatedAt = new Date().toISOString();
  });
};

export type { Form } from "./local/form";
export type { WorkspaceSummary } from "./query/workspace";
export type { FormListing, FormFavorite } from "./query/form-listing";
