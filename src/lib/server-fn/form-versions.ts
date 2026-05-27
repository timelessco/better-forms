import crypto from "node:crypto";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import { z } from "zod";
import { formSettings, forms, formVersions, user } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { canonicalJSON, computeContentHash } from "@/lib/content-hash";
import type { ErrorCode } from "@/lib/errors/codes";
import { purgeFormCache } from "@/lib/server-fn/cdn-cache";
import { defaultFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";
import { getActiveOrgId } from "./auth-helpers";
import { authForm } from "./auth-helpers.server";

// TODO: make plan-based
const MAX_VERSIONS_PER_FORM = 20;

const serializeVersion = (version: typeof formVersions.$inferSelect) => ({
  ...version,
  publishedAt: version.publishedAt.toISOString(),
  createdAt: version.createdAt.toISOString(),
  content: version.content as object[],
  customization: (version.customization ?? {}) as Record<string, string>,
});

export const publishFormVersion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

    const result = await db.transaction(async (tx) => {
      const [form] = await tx.select().from(forms).where(eq(forms.id, data.formId));

      if (!form) {
        throw createError({
          code: "forms/not-found" satisfies ErrorCode,
          status: 404,
          message: "Form not found",
          why: "Form row missing inside publish transaction after auth passed",
          fix: "Refresh and try again — the form may have been deleted",
          internal: { formId: data.formId },
        });
      }

      const [lastVersion] = await tx
        .select({ version: formVersions.version })
        .from(formVersions)
        .where(eq(formVersions.formId, data.formId))
        .orderBy(desc(formVersions.version))
        .limit(1);

      const now = new Date();

      const contentHash = computeContentHash({
        content: form.content,
        customization: form.customization ?? {},
        title: form.title,
        icon: form.icon,
        cover: form.cover,
      });

      // DEBUG: log snapshot publish reads from DB to diagnose "changed it but published is
      // stale" reports. Revert once verified.
      console.log("[publish] read forms row", {
        formId: data.formId,
        title: form.title,
        contentLen: Array.isArray(form.content) ? form.content.length : null,
        customization: form.customization,
        previousPublishedContentHash: form.publishedContentHash,
        newContentHash: contentHash,
        lastPublishedVersionId: form.lastPublishedVersionId,
        updatedAt: form.updatedAt,
      });

      // Per-domain conditional publish (see plan §2): versioned (editor + customization) inserts
      // a new version row only if hash differs from publishedContentHash; settings upserts
      // formSettings from draftSettings only if live differs from draft. First publish: both fire.
      const versionedDirty = form.publishedContentHash !== contentHash;
      const isFirstPublish = !form.lastPublishedVersionId;

      console.log("[publish] decision", {
        versionedDirty,
        isFirstPublish,
        willInsertVersion: versionedDirty || isFirstPublish,
      });

      let newVersion: typeof formVersions.$inferSelect | undefined;
      let versionId = form.lastPublishedVersionId ?? null;

      if (versionedDirty || isFirstPublish) {
        const nextVersionNumber = (lastVersion?.version ?? 0) + 1;
        versionId = crypto.randomUUID();

        const [inserted] = await tx
          .insert(formVersions)
          .values({
            id: versionId,
            formId: data.formId,
            version: nextVersionNumber,
            content: form.content,
            // Settings excluded from versions: null on new rows; legacy rows keep pre-split snapshot.
            settings: null,
            customization: form.customization ?? {},
            title: form.title,
            icon: form.icon,
            cover: form.cover,
            publishedByUserId: context.session.user.id,
            publishedByName: context.session.user.name || null,
            publishedByImage: context.session.user.image || null,
            publishedAt: now,
            createdAt: now,
          })
          .returning();
        newVersion = inserted;

        console.log("[publish] inserted new version row", {
          versionId,
          version: nextVersionNumber,
          contentLen: Array.isArray(inserted?.content)
            ? (inserted.content as unknown[]).length
            : null,
          customization: inserted?.customization,
          title: inserted?.title,
        });

        await tx
          .update(forms)
          .set({
            status: "published",
            lastPublishedVersionId: versionId,
            publishedContentHash: contentHash,
            updatedAt: now,
          })
          .where(eq(forms.id, data.formId));

        const allVersions = await tx
          .select({ id: formVersions.id })
          .from(formVersions)
          .where(eq(formVersions.formId, data.formId))
          .orderBy(desc(formVersions.version));

        if (allVersions.length > MAX_VERSIONS_PER_FORM) {
          const versionsToDelete = allVersions.slice(MAX_VERSIONS_PER_FORM).map((v) => v.id);
          await tx.delete(formVersions).where(inArray(formVersions.id, versionsToDelete));
        }
      } else if (form.status !== "published") {
        // No content change but archived/unpublished — flip back to published, no empty version.
        await tx
          .update(forms)
          .set({ status: "published", updatedAt: now })
          .where(eq(forms.id, data.formId));
      }

      // Settings: copy draft → live when they differ (canonical compare) to avoid noop writes.
      const [liveRow] = await tx
        .select({ settings: formSettings.settings })
        .from(formSettings)
        .where(eq(formSettings.formId, data.formId));

      const draft = (form.draftSettings ?? defaultFormSettings) as FormSettings;
      const live = liveRow?.settings ?? null;
      const settingsDirty = live === null || canonicalJSON(live) !== canonicalJSON(draft);

      if (settingsDirty || isFirstPublish) {
        await tx
          .insert(formSettings)
          .values({ formId: data.formId, settings: draft, updatedAt: now })
          .onConflictDoUpdate({
            target: formSettings.formId,
            set: { settings: draft, updatedAt: now },
          });
      }

      return {
        version: newVersion ? serializeVersion(newVersion) : null,
        versionId,
        versionedPublished: Boolean(newVersion),
        settingsPublished: settingsDirty || isFirstPublish,
      };
    });

    await purgeFormCache(data.formId);

    return result;
  });

export const getFormVersions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    const [_, versions] = await Promise.all([
      authForm(data.formId, context.session.user.id, orgId),
      db
        .select({
          id: formVersions.id,
          version: formVersions.version,
          title: formVersions.title,
          publishedAt: formVersions.publishedAt,
          publishedByUserId: formVersions.publishedByUserId,
          // Snapshot authoritative; fall back to joined user row for legacy pre-snapshot versions.
          publishedByName: formVersions.publishedByName,
          publishedByImage: formVersions.publishedByImage,
          fallbackName: user.name,
          fallbackImage: user.image,
        })
        .from(formVersions)
        .leftJoin(user, eq(formVersions.publishedByUserId, user.id))
        .where(eq(formVersions.formId, data.formId))
        .orderBy(desc(formVersions.version)),
    ]);

    return {
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        publishedAt: v.publishedAt.toISOString(),
        publishedBy: {
          id: v.publishedByUserId,
          name: v.publishedByName || v.fallbackName,
          image: v.publishedByImage || v.fallbackImage,
        },
      })),
    };
  });

/** Version-list query options. Source of truth for the ["form-versions", formId] key + fetcher;
 * mirrors the version-list collection's injected queryFn (getVersionList in _authenticated.tsx). */
export const getFormVersionsQueryOption = (formId: string) =>
  queryOptions({
    queryKey: ["form-versions", formId] as const,
    queryFn: () => getFormVersions({ data: { formId } }).then((r) => r.versions),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

export const getFormVersionContent = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ versionId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const [version] = await db
      .select()
      .from(formVersions)
      .where(eq(formVersions.id, data.versionId));

    if (!version) {
      throw createError({
        code: "versions/not-found" satisfies ErrorCode,
        status: 404,
        message: "Version not found",
        why: "No form_versions row exists with this ID",
        fix: "Choose a different version — this one may have been pruned",
        internal: { versionId: data.versionId },
      });
    }

    const orgId = getActiveOrgId(context.session);
    await authForm(version.formId, context.session.user.id, orgId);

    return { version: serializeVersion(version) };
  });

/** Restore a version's content to the form draft. Leaves publishedContentHash so "has changes" stays. */
export const restoreFormVersion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      versionId: z.uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    const authPromise = authForm(data.formId, context.session.user.id, orgId);

    const [version] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.id, data.versionId), eq(formVersions.formId, data.formId)));
    await authPromise;

    if (!version) {
      throw createError({
        code: "versions/not-found" satisfies ErrorCode,
        status: 404,
        message: "Version not found",
        why: "No matching form_versions row for this form + version ID combination",
        fix: "Pick another version from the history list",
        internal: { formId: data.formId, versionId: data.versionId },
      });
    }

    // We don't update publishedContentHash so the form shows "has changes".
    await db
      .update(forms)
      .set({
        content: version.content,
        title: version.title,
        customization: version.customization ?? {},
        updatedAt: new Date(),
      })
      .where(eq(forms.id, data.formId));

    return {
      success: true,
      version: {
        content: version.content as object[],
        settings: version.settings,
        title: version.title,
      },
    };
  });

export const discardFormChanges = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

    const [result] = await db
      .select({
        lastPublishedVersionId: forms.lastPublishedVersionId,
        version: formVersions,
        liveSettings: formSettings.settings,
      })
      .from(forms)
      .innerJoin(formVersions, eq(forms.lastPublishedVersionId, formVersions.id))
      .leftJoin(formSettings, eq(formSettings.formId, forms.id))
      .where(eq(forms.id, data.formId));

    if (!result?.version) {
      throw createError({
        code: "versions/no-published" satisfies ErrorCode,
        status: 422,
        message: "No published version to revert to",
        why: "Form has never been published, so there's no baseline to discard back to",
        fix: "Publish the form at least once before discarding changes",
        internal: { formId: data.formId },
      });
    }

    const version = result.version;

    const contentHash = computeContentHash({
      content: version.content,
      customization: version.customization ?? {},
      title: version.title,
      icon: version.icon,
      cover: version.cover,
    });

    // Discard resets both domains: versioned (editor + customization + title/icon/cover) ← last
    // version; settings (draftSettings) ← live formSettings.settings (defaultFormSettings if no live row).
    const liveSettings = (result.liveSettings ?? defaultFormSettings) as FormSettings;

    const [updatedForm] = await db
      .update(forms)
      .set({
        content: version.content,
        title: version.title,
        customization: version.customization ?? {},
        icon: version.icon,
        cover: version.cover,
        draftSettings: liveSettings,
        publishedContentHash: contentHash,
        updatedAt: new Date(),
      })
      .where(eq(forms.id, data.formId))
      .returning();

    return {
      success: true,
      form: {
        ...updatedForm,
        content: updatedForm.content as object[],
        customization: (updatedForm.customization ?? {}) as Record<string, string>,
        updatedAt: updatedForm.updatedAt.toISOString(),
        createdAt: updatedForm.createdAt.toISOString(),
      },
      version: {
        content: version.content as object[],
        title: version.title,
      },
    };
  });
