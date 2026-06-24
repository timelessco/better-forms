import { createTransaction } from "@tanstack/react-db";
import { createVersionContentCollection, createVersionListCollection } from "./query/version";
import type { FormListing } from "./query/form-listing";
import type { WorkspaceSummary } from "./query/workspace";
import { defaultFormSettings } from "@/types/form-settings";
import { DEFAULT_FORM_CONTENT } from "./local/form";
import type { Form } from "./local/form";
import type { updateForm } from "@/lib/server-fn/forms";
import { getInit, state, stripNulls } from "./_state";
import type { ServerFnInput } from "./_state";

/** Map a local `Form` onto a `FormListing`. `Form` lacks the listing-only `shortId`/`submissionCount`; supply them (optimistic rows use `""`/`0`, replaced on refetch). */
const formToListing = (
  form: Form,
  extras: { shortId: string; submissionCount: number; sortIndex?: string | null },
): FormListing => ({
  id: form.id,
  shortId: extras.shortId,
  title: form.title,
  status: form.status,
  updatedAt: form.updatedAt ?? new Date().toISOString(),
  createdAt: form.createdAt ?? new Date().toISOString(),
  workspaceId: form.workspaceId,
  icon: form.icon ?? null,
  formName: form.formName,
  sortIndex: extras.sortIndex ?? null,
  customization: form.customization,
  submissionCount: extras.submissionCount,
  draftSettings: form.draftSettings,
  liveSettings: form.liveSettings,
  publishedContentHash: form.publishedContentHash,
  lastPublishedVersionId: form.lastPublishedVersionId,
  content: form.content,
  schemaName: form.schemaName,
  cover: form.cover,
  previewImageUrl: form.previewImageUrl ?? null,
  createdByUserId: form.createdByUserId ?? null,
});

export const getWorkspaces = () => getInit().workspaces;
export const getFormListings = () => getInit().formListings;
export const getFavorites = () => getInit().favorites;
export const getQueryClient = () => getInit().queryClient;

/** Merge full `Form` detail onto an existing listing row, preserving listing-only fields (shortId/submissionCount/sortIndex). */
export const mergeFormDetailIntoListing = (detail: Form, existing?: FormListing): FormListing => ({
  ...existing,
  ...formToListing(detail, {
    shortId: existing?.shortId ?? "",
    submissionCount: existing?.submissionCount ?? 0,
    sortIndex: existing?.sortIndex ?? null,
  }),
  // `_getFormById` doesn't join `form_settings`, so detail carries no `liveSettings`; keep the listing's value (drives the publish settings dirty-flag).
  liveSettings: detail.liveSettings ?? existing?.liveSettings,
  id: detail.id,
});

export const enrichFormDetail = async (formId: string) => {
  const { serverFns, formListings } = getInit();
  if (state.enrichedFormIds.has(formId)) return null;
  const detail = await serverFns.getFormDetail(formId);
  if (detail) {
    formListings.utils.writeUpdate(mergeFormDetailIntoListing(detail, formListings.get(formId)));
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
  options: { title?: string; content?: unknown[] } | string = "Untitled",
): { form: Form; persisted: Promise<void> } => {
  const title = typeof options === "string" ? options : (options.title ?? "Untitled");
  const content =
    typeof options === "object" && options.content ? options.content : DEFAULT_FORM_CONTENT;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const newForm: Form = {
    id,
    workspaceId,
    title,
    formName: "draft",
    schemaName: "draftFormSchema",
    content,
    icon: null,
    cover: null,
    status: "draft",
    draftSettings: defaultFormSettings,
    liveSettings: null,
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
    formListings.insert(formToListing(newForm, { shortId: "", submissionCount: 0 }));
  });

  return { form: newForm, persisted: tx.isPersisted.promise.then(() => undefined) };
};

export const duplicateFormById = (formId: string): { form: Form; persisted: Promise<void> } => {
  const { serverFns, formListings } = getInit();
  const sourceForm = formListings.get(formId);
  if (!sourceForm) throw new Error(`Form not found: ${formId}`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = sourceForm.title ? `${sourceForm.title} copy` : "Untitled copy";

  const newForm: Form = {
    id,
    workspaceId: sourceForm.workspaceId,
    title,
    formName: sourceForm.formName,
    schemaName: sourceForm.schemaName ?? "draftFormSchema",
    // Listing may be un-enriched (no heavy `content`); default to empty, matching the server's `data.content ?? []`.
    content: structuredClone(sourceForm.content ?? []),
    icon: sourceForm.icon,
    cover: sourceForm.cover ?? null,
    status: "draft",
    draftSettings: sourceForm.draftSettings ?? defaultFormSettings,
    liveSettings: sourceForm.liveSettings ?? null,
    customization: sourceForm.customization ?? {},
    createdByUserId: sourceForm.createdByUserId ?? undefined,
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
    formListings.insert(
      formToListing(newForm, {
        shortId: "",
        submissionCount: 0,
        sortIndex: sourceForm.sortIndex,
      }),
    );
  });

  return { form: newForm, persisted: tx.isPersisted.promise.then(() => undefined) };
};

export const updateFormStatus = async (id: string, status: "draft" | "published" | "archived") => {
  const { formListings, queryClient, serverFns } = getInit();

  // Archived rows live outside `formListings` (server filters them). Optimistically remove, persist, then prime the trash query.
  if (status === "archived") {
    const existing = formListings.get(id);
    if (!existing) return;

    const tx = createTransaction({
      mutationFn: async () => {
        await serverFns.updateForm(
          stripNulls({ ...existing, status: "archived" }) as ServerFnInput<typeof updateForm>,
        );
        // Refetch so the archived row is gone from the server snapshot before TanStack DB drops the optimistic delete — else it falls back to the pre-archive snapshot and the form reappears.
        await Promise.all([
          formListings.utils.refetch(),
          queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] }),
        ]);
      },
    });
    tx.mutate(() => {
      formListings.delete(id);
    });
    return;
  }

  formListings.update(id, (draft) => {
    draft.status = status;
    draft.updatedAt = new Date().toISOString();
  });
};

// Restore: form is in the archived Query cache, not `formListings`. Persist flip, refetch live collection (shows in sidebar), invalidate trash.
export const restoreFormLocal = async (id: string) => {
  const { formListings, queryClient, serverFns } = getInit();
  const archived = queryClient.getQueryData<FormListing[]>(["form-listings-archived"]);
  const existing = archived?.find((f) => f.id === id);
  if (!existing) return;

  await serverFns.updateForm(
    stripNulls({ ...existing, status: "draft" }) as ServerFnInput<typeof updateForm>,
  );
  await Promise.all([
    formListings.utils.refetch(),
    queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] }),
  ]);
};

// Hard-delete from trash: form lives in the archived cache, never in `formListings` this session. Hit server directly, refresh trash.
export const permanentDeleteFormLocal = async (id: string) => {
  const { queryClient, serverFns } = getInit();
  await serverFns.deleteForm({ id });
  await queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] });
};

// Optimistically remove rows from `formListings` (instant sidebar update), persist flip, invalidate trash query.
export const bulkArchiveFormsLocal = async (ids: string[]) => {
  if (ids.length === 0) return { archived: 0 };
  const { formListings, queryClient, serverFns } = getInit();

  let archived = 0;
  const tx = createTransaction({
    mutationFn: async () => {
      const result = await serverFns.bulkArchiveForms({ ids });
      archived = result.archived;
      // Refetch so archived rows are gone from the server snapshot before TanStack DB drops the optimistic deletes (same pattern as updateFormStatus).
      await Promise.all([
        formListings.utils.refetch(),
        queryClient.invalidateQueries({ queryKey: ["form-listings-archived"] }),
      ]);
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

// Rows aren't in `formListings` (server filters archived) — hit server, invalidate trash.
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
  sortIndex: string | null = null,
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
    sortIndex,
    forms: [],
  };
  workspaces.insert(ws);
  return ws;
};

export const updateWorkspaceName = async (id: string, name: string) => {
  const { workspaces } = getInit();
  workspaces.update(id, (draft) => {
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
  formListings.update(formId, (draft) => {
    draft.sortIndex = sortIndex;
  });
};

export const reorderWorkspaceLocal = async (workspaceId: string, sortIndex: string) => {
  const { workspaces } = getInit();
  workspaces.update(workspaceId, (draft) => {
    draft.sortIndex = sortIndex;
  });
};

export const reorderFavoriteLocal = async (favoriteId: string, sortIndex: string) => {
  const { favorites } = getInit();
  favorites.update(favoriteId, (draft) => {
    draft.sortIndex = sortIndex;
  });
};

export const moveFormToWorkspaceLocal = async (formId: string, workspaceId: string) => {
  const { formListings } = getInit();
  formListings.update(formId, (draft) => {
    draft.workspaceId = workspaceId;
    draft.updatedAt = new Date().toISOString();
    draft.sortIndex = null;
  });
};

export type { Form } from "./local/form";
export type { WorkspaceSummary } from "./query/workspace";
export type { FormListing, FormFavorite } from "./query/form-listing";
