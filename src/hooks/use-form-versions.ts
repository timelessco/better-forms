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
import { stripProCustomization } from "@/lib/theme/pro-customization";
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
 * Publish-CTA dirty flags, two independent sources:
 * - hasVersionedChanges: hash(editor+customization+title/icon/cover) vs publishedContentHash; settings excluded (docs/plans/2026-05-04-settings-version-split.md).
 * - hasSettingsChanges: deep-equal draftSettings vs live liveSettings row; no live row (first publish) → any non-default draft is dirty.
 */
export const useFormPublishStatus = (formId: string | undefined) => {
  const { data: formData } = useForm(formId);
  const form = formData?.[0];

  return useMemo(() => {
    if (!formId || !form) return EMPTY_STATUS;

    // Pre-first-publish: any draft counts. Else hash content vs publishedContentHash.
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

    // Canonicalize before compare — postgres jsonb roundtrip reorders keys; drift would flicker dirty flag during autosave.
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

/** Boolean alias for migration; use useFormPublishStatus for granular flags. */
export const useHasUnpublishedChanges = (formId: string | undefined): boolean =>
  useFormPublishStatus(formId).hasAnyChanges;

/** Publish draft. Optimistically sets status "published". `stripProStyles` mirrors the server's
 * free-plan Pro-key strip so the optimistic publishedContentHash matches what the server stores. */
export const publishForm = (formId: string, opts?: { stripProStyles?: boolean }) => {
  const queryClient = getQueryClient();
  const tx = createTransaction({
    mutationFn: async () => {
      const result = await publishFormVersion({ data: { formId } });
      // Pre-populate version-content cache so dirty check compares without a fetch.
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
      // Align publishedContentHash + liveSettings so both dirty flags clear before server refetch.
      draft.publishedContentHash = computeContentHash({
        content: draft.content,
        customization: opts?.stripProStyles
          ? stripProCustomization((draft.customization ?? {}) as Record<string, string>)
          : draft.customization,
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
 * Restore version content to draft. Bypasses createTransaction (overlay timing) —
 * server call then writeUpdate syncs the store so editor sees restored content on exit.
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
 * Discard changes: revert versioned fields (Groups 1–3) to latest published snapshot.
 * Group 4 (slug, customDomainId, branding) untouched — live, never versioned.
 * Server authoritative; no optimistic overlay since published content isn't guaranteed cached.
 */
export const discardChanges = async (formId: string) => {
  const detail = getFormListings();
  const form = detail.get(formId);
  if (!form?.lastPublishedVersionId) throw new Error("No published version to revert to");

  // Server reverts + returns full row; bypass createTransaction (no cacheable overlay). writeUpdate syncs store so live queries react.
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
