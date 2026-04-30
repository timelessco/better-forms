import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { forms, formVersions, user } from "@/db/schema";
import { mergeFormSettings } from "@/lib/server-fn/forms";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { computeContentHash, pickVersionedSettings } from "@/lib/content-hash";
import { purgeFormCache } from "@/lib/server-fn/cdn-cache";
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
        throw new Error("Form not found");
      }

      const [lastVersion] = await tx
        .select({ id: formVersions.id, version: formVersions.version })
        .from(formVersions)
        .where(eq(formVersions.formId, data.formId))
        .orderBy(desc(formVersions.version))
        .limit(1);

      const nextVersionNumber = (lastVersion?.version ?? 0) + 1;
      const now = new Date();

      // Snapshot Group 2 behavior settings into the version's settings jsonb
      // so the public endpoint can read them from the snapshot instead of the
      // live forms.settings. Group 4 (slug, customDomainId, branding,
      // analytics) is intentionally excluded — those stay live.
      // `pickVersionedSettings` is the same helper that drives the client-side
      // hash, so the snapshot, the hash, and the listings query stay in lockstep.
      const settingsSnapshot = pickVersionedSettings(form.settings);

      const contentHash = computeContentHash({
        content: form.content,
        customization: form.customization ?? {},
        title: form.title,
        icon: form.icon,
        cover: form.cover,
        settings: settingsSnapshot,
      });

      const versionId = crypto.randomUUID();

      const [newVersion] = await tx
        .insert(formVersions)
        .values({
          id: versionId,
          formId: data.formId,
          version: nextVersionNumber,
          content: form.content,
          settings: settingsSnapshot,
          customization: form.customization ?? {},
          title: form.title,
          icon: form.icon,
          cover: form.cover,
          publishedByUserId: context.session.user.id,
          publishedAt: now,
          createdAt: now,
        })
        .returning();

      await tx
        .update(forms)
        .set({
          content: form.content,
          title: form.title,
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

      return {
        version: serializeVersion(newVersion),
        versionNumber: nextVersionNumber,
      };
    });

    // Purge CDN cache so viewers see the new version immediately. Runs after
    // commit so a failed transaction doesn't nuke the cache for no reason.
    void purgeFormCache(data.formId);

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
          publishedByName: user.name,
          publishedByImage: user.image,
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
          name: v.publishedByName,
          image: v.publishedByImage,
        },
      })),
    };
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
      throw new Error("Version not found");
    }

    const orgId = getActiveOrgId(context.session);
    await authForm(version.formId, context.session.user.id, orgId);

    return { version: serializeVersion(version) };
  });

/**
 * Restore a version's content to the form draft.
 * Note: Does NOT update publishedContentHash to keep "has changes" state.
 */
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
      throw new Error("Version not found");
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
      })
      .from(forms)
      .innerJoin(formVersions, eq(forms.lastPublishedVersionId, formVersions.id))
      .where(eq(forms.id, data.formId));

    if (!result?.version) {
      throw new Error("No published version to revert to");
    }

    const version = result.version;
    const snapshotSettings = version.settings ?? {};

    const contentHash = computeContentHash({
      content: version.content,
      customization: version.customization ?? {},
      title: version.title,
      icon: version.icon,
      cover: version.cover,
      settings: snapshotSettings,
    });

    // Reset every versioned field on the live draft back to the snapshot via a
    // jsonb concat — `forms.settings || snapshot` keeps the live-only keys
    // (branding, analytics) and overwrites the versioned ones. Group 4 (slug,
    // customDomainId) is on top-level columns and intentionally left untouched.
    const [updatedForm] = await db
      .update(forms)
      .set({
        content: version.content,
        title: version.title,
        customization: version.customization ?? {},
        icon: version.icon,
        cover: version.cover,
        settings: mergeFormSettings(snapshotSettings),
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
        settings: version.settings,
        title: version.title,
      },
    };
  });
