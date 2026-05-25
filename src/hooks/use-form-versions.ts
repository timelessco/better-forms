import { createTransaction, eq, useLiveQuery } from "@tanstack/react-db";
import { useMemo } from "react";
import {
  isInitialized,
  getFormListings,
  getVersionList,
  getVersionContent,
  getQueryClient,
} from "@/collections";
import { canonicalJSON, computeContentHash } from "@/lib/content-hash";
import {
  discardFormChanges,
  publishFormVersion,
  restoreFormVersion,
} from "@/lib/server-fn/form-versions";
import { useForm } from "./use-live-hooks";

const EMPTY_STATUS = {
  hasVersionedChanges: false,
  hasSettingsChanges: false,
  hasAnyChanges: false,
} as const;

export const useFormVersions = (formId: string | undefined) =>
  useLiveQuery(
    (q) => {
      if (!formId || !isInitialized()) return undefined;
      return q.from({ v: getVersionList(formId) }).orderBy(({ v }) => v.version, "desc");
    },
    [formId],
  );

export const useFormVersionContent = (versionId: string | undefined) =>
  useLiveQuery(
    (q) => {
      if (!versionId || !isInitialized()) return undefined;
      return q.from({ v: getVersionContent(versionId) }).where(({ v }) => eq(v.id, versionId));
    },
    [versionId],
  );

/**
 * Compose dirty flags for the publish CTA. Two independent sources:
 *
 *   - `hasVersionedChanges`: hash of editor + customization + title/icon/cover
 *     against `form.publishedContentHash`. Settings are intentionally NOT in
 *     the hash (split out per docs/plans/2026-05-04-settings-version-split.md).
 *   - `hasSettingsChanges`: deep-equal of `form.draftSettings` against the
 *     live `formSettings.settings` row (carried on the listings query as
 *     `liveSettings`). When no live row exists yet (first publish), any
 *     non-default draft counts as dirty.
 */
export const useFormPublishStatus = (formId: string | undefined) => {
  const { data: formData } = useForm(formId);
  const form = formData?.[0];

  return useMemo(() => {
    if (!formId || !form) return EMPTY_STATUS;

    // Versioned: pre-first-publish, any draft counts. Once a baseline exists,
    // hash editor + customization + title/icon/cover and compare to
    // `publishedContentHash`.
    const everPublished = !!form.lastPublishedVersionId;
    const hasVersionedChanges =
      !everPublished ||
      (!!form.publishedContentHash &&
        computeContentHash({
          content: form.content,
          customization: form.customization,
          title: form.title,
          icon: form.icon,
          cover: form.cover,
        }) !== form.publishedContentHash);

    // Settings: compare draft against the live row. Canonicalize before
    // stringify — postgres jsonb roundtrip can rearrange keys after a server
    // merge, and key-order drift would flicker the dirty flag during autosave.
    const draft = form.draftSettings ?? null;
    const live = form.liveSettings ?? null;
    const hasSettingsChanges =
      live === null ? draft !== null : canonicalJSON(draft) !== canonicalJSON(live);

    return {
      hasVersionedChanges,
      hasSettingsChanges,
      hasAnyChanges: hasVersionedChanges || hasSettingsChanges,
    };
  }, [formId, form]);
};

/**
 * Boolean alias kept for migration; callers gating the Publish button can
 * use this until they switch to `useFormPublishStatus` for granular flags.
 */
export const useHasUnpublishedChanges = (formId: string | undefined): boolean =>
  useFormPublishStatus(formId).hasAnyChanges;

/**
 * Publish the current form draft. Optimistically sets status to "published".
 */
export const publishForm = (formId: string) => {
  const queryClient = getQueryClient();
  const tx = createTransaction({
    mutationFn: async () => {
      const result = await publishFormVersion({ data: { formId } });
      // Pre-populate version content cache so useHasUnpublishedChanges
      // can compare immediately without waiting for a separate fetch
      if (result?.version) {
        queryClient.setQueryData(["form-version-content", result.version.id], [result.version]);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["form-versions", formId] }),
        getFormListings().utils.refetch(),
      ]);
    },
  });

  tx.mutate(() => {
    getFormListings().update(formId, (draft) => {
      draft.status = "published";
      // Optimistically align publishedContentHash AND liveSettings so both
      // dirty flags flip to "no changes" immediately, without waiting for
      // the server refetch.
      draft.publishedContentHash = computeContentHash({
        content: draft.content,
        customization: draft.customization,
        title: draft.title,
        icon: draft.icon,
        cover: draft.cover,
      });
      if (draft.draftSettings !== undefined) {
        draft.liveSettings = draft.draftSettings;
      }
      draft.updatedAt = new Date().toISOString();
    });
  });

  return tx;
};

/**
 * Restore a version's content to the form draft.
 * Bypasses createTransaction to avoid optimistic overlay timing issues —
 * calls the server API, then uses writeUpdate to synchronously update
 * the collection's sync store so the editor picks up restored content
 * immediately when exiting version view.
 */
export const restoreVersion = async (formId: string, versionId: string) => {
  const versionCollection = getVersionContent(versionId);
  const version = versionCollection.get(versionId);
  if (!version) throw new Error("Version not found in local state");

  await restoreFormVersion({ data: { formId, versionId } });

  const detail = getFormListings();
  const currentForm = detail.get(formId);
  if (currentForm) {
    detail.utils.writeUpdate({
      ...currentForm,
      content: version.content,
      title: version.title,
      customization: version.customization ?? {},
      updatedAt: new Date().toISOString(),
    });
  }
};

/**
 * Discard changes and revert every versioned field (Groups 1–3) on the live
 * draft back to the latest published version snapshot. Group 4 fields (slug,
 * customDomainId, branding) stay as-is — they're live and never versioned.
 *
 * The server is authoritative — it reads the published version and resets
 * every versioned column. We don't build a client-side optimistic overlay
 * because the published version's content isn't guaranteed to be cached on
 * the client (the version-content collection only populates once Version
 * History is opened). After the server call, refetching the form listing
 * pulls in the reverted state.
 */
export const discardChanges = async (formId: string) => {
  const detail = getFormListings();
  const form = detail.get(formId);
  if (!form?.lastPublishedVersionId) throw new Error("No published version to revert to");

  // Server reverts every versioned column and returns the full form row.
  // We bypass createTransaction (mirroring restoreVersion) because there's
  // no useful optimistic overlay to apply — the revert target isn't
  // guaranteed cached client-side. writeUpdate syncs the row into the
  // collection store so live queries (and the theme inline style) react.
  const result = (await discardFormChanges({ data: { formId } })) as {
    form?: Record<string, unknown>;
  };
  const current = detail.get(formId);
  if (current && result.form) {
    detail.utils.writeUpdate({
      ...current,
      ...result.form,
    } as typeof current);
  }
};
