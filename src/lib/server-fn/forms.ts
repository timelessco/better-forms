import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { customDomains, forms, member, submissions, workspaces } from "@/db/schema";
import { RESERVED_SLUGS } from "@/lib/config/plan-config";
import { planUnlocks } from "@/lib/config/plan-gates";
import { db } from "@/db";
import { authMiddleware, formProSettingsMiddleware } from "@/lib/auth/middleware";
import { purgeFormCache, purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import type { VersionedSettingsSnapshot } from "@/lib/content-hash";
import type { FormSettings } from "@/types/form-settings";
import { getActiveOrgId } from "./auth-helpers";
import { authForm, authFormsBulk } from "./auth-helpers.server";
import { getOrgPlan } from "./plan-helpers.server";

const serializeForm = (form: typeof forms.$inferSelect) => ({
  ...form,
  createdAt: form.createdAt.toISOString(),
  updatedAt: form.updatedAt.toISOString(),
  content: form.content as object[],
  customization: (form.customization ?? {}) as Record<string, object>,
});

/**
 * Drizzle SQL fragment that shallow-merges a settings patch into the existing
 * `forms.settings` JSONB. Used by every UPDATE that mutates a subset of
 * behavioral keys without replacing the full settings object — accepts both
 * a live `Partial<FormSettings>` patch and a stored `VersionedSettingsSnapshot`
 * (used by the discard-changes / restore-version flow).
 */
export const mergeFormSettings = (patch: Partial<FormSettings> | VersionedSettingsSnapshot) =>
  sql`${forms.settings} || ${JSON.stringify(patch)}::jsonb`;

export const createForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware, formProSettingsMiddleware])
  .inputValidator(
    z.object({
      id: z.uuid(),
      workspaceId: z.uuid(),
      title: z.string().optional(),
      formName: z.string().optional(),
      schemaName: z.string().optional(),
      content: z.array(z.unknown()).optional(),
      icon: z.string().nullable().optional(),
      cover: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      settings: z.custom<FormSettings>().optional(),
      customization: z.record(z.string(), z.unknown()).optional(),
      sortIndex: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const [form] = await db
      .insert(forms)
      .values({
        id: data.id,
        createdByUserId: context.session.user.id,
        workspaceId: data.workspaceId,
        title: data.title ?? "Untitled",
        formName: data.formName ?? "draft",
        schemaName: data.schemaName ?? "draftFormSchema",
        content: data.content ?? [],
        icon: data.icon,
        cover: data.cover,
        status: data.status ?? "draft",
        ...(data.settings ? { settings: data.settings } : {}),
        customization: data.customization,
        sortIndex: data.sortIndex,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { form: serializeForm(form) };
  });

export const updateForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware, formProSettingsMiddleware])
  .inputValidator(
    z.object({
      id: z.uuid(),
      workspaceId: z.uuid().optional(),
      title: z.string().optional(),
      formName: z.string().optional(),
      schemaName: z.string().optional(),
      content: z.array(z.unknown()).optional(),
      icon: z.string().nullable().optional(),
      cover: z.string().nullable().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      updatedAt: z.string().optional(),
      settings: z.custom<Partial<FormSettings>>().optional(),
      customization: z.record(z.string(), z.unknown()).optional(),
      sortIndex: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { id, updatedAt: clientUpdatedAt, settings: settingsPatch, ...updateData } = data;
    const orgId = getActiveOrgId(context.session);
    await authForm(id, context.session.user.id, orgId);

    const [form] = await db
      .update(forms)
      .set({
        ...updateData,
        ...(settingsPatch ? { settings: mergeFormSettings(settingsPatch) } : {}),
        updatedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
      })
      .where(eq(forms.id, id))
      .returning();

    // Cache invalidation: the public response changes when (a) a live field
    // the public view reads flips (branding/analytics) or (b) status moves
    // off "published". Versioned fields are handled by the republish flow.
    // Skip the purge if the form was never published — there's no edge cache
    // for `form:$id` in that case, just a never-cached 404.
    const liveFieldChanged =
      settingsPatch?.branding !== undefined || settingsPatch?.analytics !== undefined;
    const statusChanged = updateData.status !== undefined;
    if ((liveFieldChanged || statusChanged) && form?.lastPublishedVersionId) {
      void purgeFormCache(id);
    }

    return { form: serializeForm(form) };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.id, context.session.user.id, orgId);

    const [form] = await db.delete(forms).where(eq(forms.id, data.id)).returning();
    // No purge — by the time hard-delete runs the form is already archived,
    // so its tag was invalidated at archive time and nothing has been
    // cacheable since.

    return { form: serializeForm(form) };
  });

// Bulk soft-delete (move to trash). Capped at 200 to keep statements bounded.
export const bulkArchiveForms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authFormsBulk(data.ids, context.session.user.id, orgId);

    const updated = await db
      .update(forms)
      .set({ status: "archived", updatedAt: new Date() })
      .where(inArray(forms.id, data.ids))
      .returning({ id: forms.id, lastPublishedVersionId: forms.lastPublishedVersionId });
    // Drafts that go straight to trash have no edge cache to invalidate.
    const everPublished = updated.filter((r) => r.lastPublishedVersionId).map((r) => r.id);
    void purgeFormCacheBatch(everPublished);

    return { archived: updated.length, ids: updated.map((r) => r.id) };
  });

// Bulk hard-delete from trash.
export const bulkDeleteForms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ ids: z.array(z.uuid()).min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authFormsBulk(data.ids, context.session.user.id, orgId);

    const deleted = await db
      .delete(forms)
      .where(inArray(forms.id, data.ids))
      .returning({ id: forms.id });
    // No purge — same reasoning as deleteForm.

    return { deleted: deleted.length, ids: deleted.map((r) => r.id) };
  });

export const getFormListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const formList = await db
      .select({
        id: forms.id,
        title: forms.title,
        status: forms.status,
        updatedAt: forms.updatedAt,
        createdAt: forms.createdAt,
        workspaceId: forms.workspaceId,
        icon: forms.icon,
        cover: forms.cover,
        customization: forms.customization,
        formName: forms.formName,
        sortIndex: forms.sortIndex,
        submissionCount: count(submissions.id),
        // Hash-based change detection requires these on every listing fetch —
        // refetch after publish would otherwise wipe them off the local record.
        publishedContentHash: forms.publishedContentHash,
        lastPublishedVersionId: forms.lastPublishedVersionId,
        slug: forms.slug,
        customDomainId: forms.customDomainId,
        // Full settings JSONB — covers both the share-sidebar live reads
        // (branding, analytics) and the versioned keys the client hashes.
        settings: forms.settings,
      })
      .from(forms)
      .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
      .innerJoin(member, eq(workspaces.organizationId, member.organizationId))
      .leftJoin(submissions, eq(submissions.formId, forms.id))
      .where(and(eq(member.userId, context.session.user.id), ne(forms.status, "archived")))
      .groupBy(forms.id)
      .orderBy(forms.updatedAt);

    return formList.map((f) => ({
      ...f,
      updatedAt: f.updatedAt.toISOString(),
      createdAt: f.createdAt.toISOString(),
      customization: (f.customization ?? {}) as Record<string, string>,
    }));
  });

// Archived listings — fetched only when the trash dialog opens. Same column
// shape as `getFormListings` minus the per-form heavy fields (no submissions
// count, no versioned settings — the trash dialog only needs id/title/icon
// for display + workspaceId for grouping + updatedAt for the 30-day banner).
export const getArchivedFormListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const formList = await db
      .select({
        id: forms.id,
        title: forms.title,
        status: forms.status,
        updatedAt: forms.updatedAt,
        createdAt: forms.createdAt,
        workspaceId: forms.workspaceId,
        icon: forms.icon,
        formName: forms.formName,
      })
      .from(forms)
      .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
      .innerJoin(member, eq(workspaces.organizationId, member.organizationId))
      .where(and(eq(member.userId, context.session.user.id), eq(forms.status, "archived")))
      .orderBy(forms.updatedAt);

    return formList.map((f) => ({
      ...f,
      updatedAt: f.updatedAt.toISOString(),
      createdAt: f.createdAt.toISOString(),
    }));
  });

export const archivedFormListingsQueryOptions = () =>
  queryOptions({
    queryKey: ["form-listings-archived"],
    queryFn: ({ signal }) => getArchivedFormListings({ signal }),
    staleTime: 1000 * 60, // 1 min — refetched on dialog reopen anyway
  });

const _getFormById = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    const [_, [form]] = await Promise.all([
      authForm(data.id, context.session.user.id, orgId),
      db.select().from(forms).where(eq(forms.id, data.id)),
    ]);

    if (!form) {
      throw new Error("Form not found");
    }

    return { form: serializeForm(form) };
  });

export const getFormbyIdQueryOption = (formId: string) =>
  queryOptions({
    queryKey: ["forms", formId],
    queryFn: ({ signal }) => _getFormById({ data: { id: formId }, signal }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

export type FormStatus = "draft" | "published" | "archived";
type FormStatusQueryResult = {
  form?: {
    status?: FormStatus;
  };
};

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "form";

/** @public - consumed by upcoming domain settings UI */
export const updateFormSlug = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid(), slug: z.string() }))
  .handler(async ({ data, context }) => {
    const { formId, slug } = data;
    const orgId = getActiveOrgId(context.session);
    await authForm(formId, context.session.user.id, orgId);

    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(
        "Invalid slug format. Use lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
      );
    }

    if (slug.length < 2 || slug.length > 60) {
      throw new Error("Slug must be between 2 and 60 characters");
    }

    if (RESERVED_SLUGS.has(slug)) {
      throw new Error("This slug is reserved and cannot be used");
    }

    const [formRecord] = await db
      .select({ workspaceId: forms.workspaceId })
      .from(forms)
      .where(eq(forms.id, formId));

    if (!formRecord) {
      throw new Error("Form not found");
    }

    const [workspace] = await db
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, formRecord.workspaceId));

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const existing = await db
      .select({ id: forms.id })
      .from(forms)
      .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.organizationId, workspace.organizationId),
          eq(forms.slug, slug),
          ne(forms.id, formId),
        ),
      );

    if (existing.length > 0) {
      throw new Error("Slug already in use");
    }

    const [updatedForm] = await db
      .update(forms)
      .set({ slug, updatedAt: new Date() })
      .where(eq(forms.id, formId))
      .returning();

    // Slug is part of the public-routing surface — old URL keeps serving the
    // cached body until the tag is invalidated. Skip if never published.
    if (updatedForm?.lastPublishedVersionId) void purgeFormCache(formId);

    return { form: serializeForm(updatedForm) };
  });

/** @public - consumed by upcoming domain settings UI */
export const assignFormDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      customDomainId: z.string().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { formId, customDomainId } = data;
    const orgId = getActiveOrgId(context.session);
    await authForm(formId, context.session.user.id, orgId);

    if (customDomainId !== null) {
      const plan = await getOrgPlan(orgId);
      if (!planUnlocks(plan, "customDomains")) {
        throw new Error("Custom domains require a Pro subscription. Please upgrade to continue.");
      }

      const [domain] = await db
        .select()
        .from(customDomains)
        .where(eq(customDomains.id, customDomainId));

      if (!domain) {
        throw new Error("Custom domain not found");
      }

      if (domain.organizationId !== orgId) {
        throw new Error("Custom domain does not belong to this organization");
      }

      if (domain.status !== "verified") {
        throw new Error("Custom domain is not verified");
      }

      const [formRecord] = await db
        .select({ slug: forms.slug, title: forms.title })
        .from(forms)
        .where(eq(forms.id, formId));

      if (formRecord && !formRecord.slug) {
        let autoSlug = generateSlug(formRecord.title);

        const existing = await db
          .select({ id: forms.id })
          .from(forms)
          .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
          .where(
            and(
              eq(workspaces.organizationId, orgId),
              eq(forms.slug, autoSlug),
              ne(forms.id, formId),
            ),
          );

        if (existing.length > 0) {
          autoSlug = `${autoSlug}-${formId.slice(0, 4)}`;
        }

        await db
          .update(forms)
          .set({ slug: autoSlug, updatedAt: new Date() })
          .where(eq(forms.id, formId));
      }
    }

    const [updatedForm] = await db
      .update(forms)
      .set({ customDomainId, updatedAt: new Date() })
      .where(eq(forms.id, formId))
      .returning();

    // Custom domain assignment changes the canonical URL + head metadata
    // rendered into the public response. Purge if ever published.
    if (updatedForm?.lastPublishedVersionId) void purgeFormCache(formId);

    return { form: serializeForm(updatedForm) };
  });

export const getFormStatus = async (
  queryClient: import("@tanstack/react-query").QueryClient,
  formId: string,
): Promise<FormStatus | undefined> => {
  const result = (await queryClient.ensureQueryData({
    ...getFormbyIdQueryOption(formId),
    revalidateIfStale: true,
  })) as FormStatusQueryResult;

  return result.form?.status;
};
