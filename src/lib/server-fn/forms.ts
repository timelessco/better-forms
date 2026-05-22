import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { createError } from "evlog";
import { z } from "zod";
import { customDomains, formSettings, forms, member, submissions, workspaces } from "@/db/schema";
import { RESERVED_SLUGS } from "@/lib/config/plan-config";
import { planUnlocks } from "@/lib/config/plan-gates";
import { db } from "@/db";
import { authMiddleware, formProSettingsMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";
import { purgeFormCache, purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import { defaultFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";
import { getActiveOrgId } from "./auth-helpers";
import { authForm, authFormsBulk } from "./auth-helpers.server";
import { getOrgPlan, getOrgPlanWithPolarSync } from "./plan-helpers.server";
import { generateShortId } from "@/lib/short-id";

const MAX_SHORT_ID_ATTEMPTS = 5;
const PG_UNIQUE_VIOLATION = "23505";
const SHORT_ID_CONSTRAINT = "forms_shortId_key";

// Postgres SQLSTATE 23505 = unique_violation. Treat as a collision only when
// it's on the shortId index; FK / PK / other unique-index violations propagate.
const isShortIdCollision = (err: unknown): boolean =>
  !!err &&
  typeof err === "object" &&
  "code" in err &&
  (err as { code: unknown }).code === PG_UNIQUE_VIOLATION &&
  "constraint_name" in err &&
  (err as { constraint_name: unknown }).constraint_name === SHORT_ID_CONSTRAINT;

const serializeForm = (form: typeof forms.$inferSelect) => ({
  ...form,
  createdAt: form.createdAt.toISOString(),
  updatedAt: form.updatedAt.toISOString(),
  content: form.content as object[],
  customization: (form.customization ?? {}) as Record<string, object>,
});

/**
 * Drizzle SQL fragment that shallow-merges a settings patch into the existing
 * `forms.draftSettings` JSONB. Used by every UPDATE that mutates a subset of
 * behavioral keys without replacing the full settings object. The live
 * settings (served to public renderers) live in the `form_settings` table —
 * `mergeFormSettings` only patches the user's working draft.
 */
export const mergeFormSettings = (patch: Partial<FormSettings>) =>
  sql`${forms.draftSettings} || ${JSON.stringify(patch)}::jsonb`;

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
      draftSettings: z.custom<FormSettings>().optional(),
      customization: z.record(z.string(), z.unknown()).optional(),
      sortIndex: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    // Generate-then-INSERT, retrying only on the UNIQUE-constraint violation
    // for forms.shortId. At 7-char base62 (3.5T namespace) collisions are
    // vanishing, so the happy path is one DB roundtrip.
    for (let attempt = 0; attempt < MAX_SHORT_ID_ATTEMPTS; attempt++) {
      try {
        const [form] = await db
          .insert(forms)
          .values({
            id: data.id,
            shortId: generateShortId(),
            createdByUserId: context.session.user.id,
            workspaceId: data.workspaceId,
            title: data.title ?? "Untitled",
            formName: data.formName ?? "draft",
            schemaName: data.schemaName ?? "draftFormSchema",
            content: data.content ?? [],
            icon: data.icon,
            cover: data.cover,
            status: data.status ?? "draft",
            ...(data.draftSettings ? { draftSettings: data.draftSettings } : {}),
            customization: data.customization,
            sortIndex: data.sortIndex,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        return { form: serializeForm(form) };
      } catch (err) {
        if (isShortIdCollision(err)) continue;
        throw err;
      }
    }
    throw createError({
      code: "forms/short-id-collision" satisfies ErrorCode,
      status: 500,
      message: "Couldn't allocate a unique short ID for the form. Please try again.",
      why: `Hit ${MAX_SHORT_ID_ATTEMPTS} consecutive shortId UNIQUE collisions — should be effectively impossible at 7-char base62`,
      fix: "Retry the request — this is almost certainly transient",
      internal: { maxAttempts: MAX_SHORT_ID_ATTEMPTS, formId: data.id },
    });
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
      draftSettings: z.custom<Partial<FormSettings>>().optional(),
      customization: z.record(z.string(), z.unknown()).optional(),
      sortIndex: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { id, updatedAt: clientUpdatedAt, draftSettings: settingsPatch, ...updateData } = data;
    const orgId = getActiveOrgId(context.session);
    await authForm(id, context.session.user.id, orgId);

    const [form] = await db
      .update(forms)
      .set({
        ...updateData,
        ...(settingsPatch ? { draftSettings: mergeFormSettings(settingsPatch) } : {}),
        updatedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
      })
      .where(eq(forms.id, id))
      .returning();

    // Cache invalidation: with settings out of versioning and never written
    // to the live row by this fn (`updateForm` only touches draftSettings),
    // the only field this endpoint flips that is public-visible is `status`
    // moving off "published". Live settings changes happen in publishFormVersion.
    const statusChanged = updateData.status !== undefined;
    if (statusChanged && form?.lastPublishedVersionId) {
      await purgeFormCache(id);
    }

    return { form: serializeForm(form) };
  });

/**
 * Flip the analytics toggle. Unlike most settings (which live in draftSettings
 * and only go live on republish), this writes the live `formSettings` row
 * directly so `isAnalyticsEnabled` and the recorder gate flip immediately —
 * no republish required. Draft is updated too so the share sidebar reflects
 * the new value without a roundtrip back through the form-listings sync.
 */
export const setFormAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware, formProSettingsMiddleware])
  .inputValidator(z.object({ formId: z.uuid(), enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authForm(data.formId, context.session.user.id, orgId);

    // Explicit plan gate. `formProSettingsMiddleware` scans input *field names*
    // for gated settings; this fn's input is `{ enabled }`, not `{ analytics }`,
    // so the middleware finds zero gates and waves it through. Re-check here
    // when turning analytics ON. Polar-sync flavour because `organization.plan`
    // drifts if a webhook missed — same reason getInsightsAvailability uses it.
    // Turning OFF is always allowed (downgrade path).
    if (data.enabled) {
      const plan = await getOrgPlanWithPolarSync(orgId, context.session.user.email ?? null);
      if (!planUnlocks(plan, "analytics")) {
        throw createError({
          code: "plan/pro-required" satisfies ErrorCode,
          status: 402,
          message: "Analytics requires a Pro subscription. Please upgrade to continue.",
          why: "Org plan doesn't unlock the analytics feature gate",
          fix: "Upgrade to Pro from the billing settings",
          internal: { feature: "analytics", orgId, plan },
        });
      }
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      // Draft so the share-sidebar's optimistic state stays in sync.
      await tx
        .update(forms)
        .set({
          draftSettings: mergeFormSettings({ analytics: data.enabled }),
          updatedAt: now,
        })
        .where(eq(forms.id, data.formId));

      // Live — this is what `isAnalyticsEnabled` reads. Merge into the
      // existing row so we don't clobber other live settings.
      await tx
        .insert(formSettings)
        .values({
          formId: data.formId,
          settings: { ...defaultFormSettings, analytics: data.enabled } as FormSettings,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: formSettings.formId,
          set: {
            settings: sql`${formSettings.settings} || ${JSON.stringify({ analytics: data.enabled })}::jsonb`,
            updatedAt: now,
          },
        });
    });

    return { ok: true as const };
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
    await purgeFormCacheBatch(everPublished);

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
        shortId: forms.shortId,
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
        // Working draft of behavioral settings — what the editor's settings
        // sidebar reads/writes. The live (published) settings live in
        // `form_settings`; carry both so the client can diff for the
        // settings dirty flag without an extra fetch.
        draftSettings: forms.draftSettings,
        liveSettings: formSettings.settings,
      })
      .from(forms)
      .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
      .innerJoin(member, eq(workspaces.organizationId, member.organizationId))
      .leftJoin(submissions, eq(submissions.formId, forms.id))
      .leftJoin(formSettings, eq(formSettings.formId, forms.id))
      .where(and(eq(member.userId, context.session.user.id), ne(forms.status, "archived")))
      .groupBy(forms.id, formSettings.formId)
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
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "No forms row exists with this ID after auth passed",
        fix: "Refresh — the form may have been deleted",
        internal: { formId: data.id },
      });
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
      throw createError({
        code: "forms/slug-invalid-format" satisfies ErrorCode,
        status: 400,
        message:
          "Invalid slug format. Use lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
        why: "Slug doesn't match the [a-z0-9-] pattern (no leading/trailing hyphen)",
        fix: "Use only lowercase letters, numbers, and hyphens",
        internal: { slug },
      });
    }

    if (slug.length < 2 || slug.length > 60) {
      throw createError({
        code: "forms/slug-invalid-length" satisfies ErrorCode,
        status: 400,
        message: "Slug must be between 2 and 60 characters",
        why: "Slug length is outside the 2-60 character range",
        fix: "Shorten or extend the slug to fit within 2-60 characters",
        internal: { slug, length: slug.length },
      });
    }

    if (RESERVED_SLUGS.has(slug)) {
      throw createError({
        code: "forms/slug-reserved" satisfies ErrorCode,
        status: 422,
        message: "This slug is reserved and cannot be used",
        why: "Slug matches one of the platform's reserved names",
        fix: "Choose a different slug",
        internal: { slug },
      });
    }

    const [formRecord] = await db
      .select({ workspaceId: forms.workspaceId })
      .from(forms)
      .where(eq(forms.id, formId));

    if (!formRecord) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "Form was authorized but disappeared between auth and slug read",
        fix: "Refresh and try again",
        internal: { formId },
      });
    }

    const [workspace] = await db
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, formRecord.workspaceId));

    if (!workspace) {
      throw createError({
        code: "workspaces/not-found" satisfies ErrorCode,
        status: 404,
        message: "Workspace not found",
        why: "Form's workspace row is missing — likely a stale reference",
        fix: "Refresh and try again",
        internal: { workspaceId: formRecord.workspaceId, formId },
      });
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
      throw createError({
        code: "forms/slug-taken" satisfies ErrorCode,
        status: 422,
        message: "Slug already in use",
        why: "Another form in this organization already uses this slug",
        fix: "Pick a different slug",
        internal: { slug, organizationId: workspace.organizationId, formId },
      });
    }

    const [updatedForm] = await db
      .update(forms)
      .set({ slug, updatedAt: new Date() })
      .where(eq(forms.id, formId))
      .returning();

    // Slug is part of the public-routing surface — old URL keeps serving the
    // cached body until the tag is invalidated. Skip if never published.
    if (updatedForm?.lastPublishedVersionId) await purgeFormCache(formId);

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
        throw createError({
          code: "domains/pro-required" satisfies ErrorCode,
          status: 402,
          message: "Custom domains require a Pro subscription. Please upgrade to continue.",
          why: "Org plan doesn't unlock the customDomains feature gate",
          fix: "Upgrade to Pro from the billing settings",
          internal: { feature: "customDomains", orgId, plan },
        });
      }

      const [domain] = await db
        .select()
        .from(customDomains)
        .where(eq(customDomains.id, customDomainId));

      if (!domain) {
        throw createError({
          code: "domains/not-found" satisfies ErrorCode,
          status: 404,
          message: "Custom domain not found",
          why: "No custom_domain row exists with this ID",
          fix: "Refresh the domain list — it may have been removed",
          internal: { customDomainId, orgId },
        });
      }

      if (domain.organizationId !== orgId) {
        throw createError({
          code: "domains/not-belongs-to-org" satisfies ErrorCode,
          status: 403,
          message: "Custom domain does not belong to this organization",
          why: "Domain row's organizationId doesn't match the active org",
          fix: "Assign a domain that belongs to your current organization",
          internal: { customDomainId, expectedOrgId: orgId, actualOrgId: domain.organizationId },
        });
      }

      if (domain.status !== "verified") {
        throw createError({
          code: "domains/not-verified" satisfies ErrorCode,
          status: 422,
          message: "Custom domain is not verified",
          why: `Domain status is "${domain.status}" — needs to be "verified" before assignment`,
          fix: "Complete domain verification from the domains settings",
          internal: { customDomainId, status: domain.status },
        });
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
    if (updatedForm?.lastPublishedVersionId) await purgeFormCache(formId);

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
