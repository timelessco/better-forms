import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import { customDomains, formSettings, forms, member, submissions, workspaces } from "@/db/schema";
import type { FormRow } from "@/db/schema";
import { RESERVED_SLUGS } from "@/lib/config/plan-config";
import { planUnlocks } from "@/lib/config/plan-gates";
import { db } from "@/db";
import { authMiddleware, formProSettingsMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";
import { purgeFormCache, purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import { defaultFormSettings, sanitizeFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";
import { requireScopedForm, requireScopedFormsBulk } from "./auth-helpers.server";
import { mergeFormSettings } from "./merge-form-settings.server";
import { hashFormPassword, isHashedFormPassword } from "./password-hash.server";
import { getOrgPlan, getOrgPlanWithPolarSync } from "./plan-helpers.server";
import { generateShortId } from "@/lib/short-id";

const MAX_SHORT_ID_ATTEMPTS = 5;
const PG_UNIQUE_VIOLATION = "23505";
const SHORT_ID_CONSTRAINT = "forms_shortId_key";

// SQLSTATE 23505 (unique_violation): collision only on the shortId index; FK/PK/other propagate.
const isShortIdCollision = (err: unknown): boolean =>
  !!err &&
  typeof err === "object" &&
  "code" in err &&
  (err as { code: unknown }).code === PG_UNIQUE_VIOLATION &&
  "constraint_name" in err &&
  (err as { constraint_name: unknown }).constraint_name === SHORT_ID_CONSTRAINT;

// Shared field shapes for createForm/updateForm validators — the two differ only in a couple of
// fields' optionality (workspaceId required on create; updatedAt/draftSettings type), spread below.
const formMutationFields = {
  title: v.optional(v.string()),
  formName: v.optional(v.string()),
  schemaName: v.optional(v.string()),
  content: v.optional(v.array(v.any())),
  icon: v.optional(v.nullable(v.string())),
  cover: v.optional(v.nullable(v.string())),
  status: v.optional(v.picklist(["draft", "published", "archived"])),
  customization: v.optional(v.record(v.string(), v.any())),
  sortIndex: v.optional(v.nullable(v.string())),
} as const;

const serializeForm = (form: FormRow) => ({
  ...form,
  createdAt: form.createdAt.toISOString(),
  updatedAt: form.updatedAt.toISOString(),
  content: form.content as object[],
  customization: (form.customization ?? {}) as Record<string, object>,
});

export const createForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware, formProSettingsMiddleware])
  .validator(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      workspaceId: v.pipe(v.string(), v.uuid()),
      ...formMutationFields,
      draftSettings: v.optional(v.custom<FormSettings>(() => true)),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    // Generate-then-INSERT, retry only on forms.shortId UNIQUE violation. 7-char base62
    // (3.5T namespace) → collisions vanishing, happy path is one roundtrip.
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
  .validator(
    v.object({
      id: v.pipe(v.string(), v.uuid()),
      workspaceId: v.optional(v.pipe(v.string(), v.uuid())),
      ...formMutationFields,
      updatedAt: v.optional(v.string()),
      draftSettings: v.optional(v.custom<Partial<FormSettings>>(() => true)),
    }),
  )
  .handler(async ({ data, context }) => {
    const { id, updatedAt: clientUpdatedAt, draftSettings: settingsPatch, ...updateData } = data;
    await requireScopedForm(context.session, id);

    // This path also persists draftSettings (the settings UI flushes here via updateForm, not
    // saveFormSettings). Hash a non-empty, not-already-hashed password so plaintext never lands at
    // rest. Idempotent guard keeps re-saves from double-hashing.
    if (settingsPatch?.password && !isHashedFormPassword(settingsPatch.password)) {
      settingsPatch.password = hashFormPassword(settingsPatch.password);
    }

    const [form] = await db
      .update(forms)
      .set({
        ...updateData,
        ...(settingsPatch ? { draftSettings: mergeFormSettings(settingsPatch) } : {}),
        updatedAt: clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(),
      })
      .where(eq(forms.id, id))
      .returning();

    if (!form) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "UPDATE matched no forms row — deleted between auth and update",
        fix: "Refresh — the form may have been deleted",
        internal: { formId: id },
      });
    }

    // Only public-visible field this fn flips is status off "published" (updateForm touches
    // draftSettings only); live settings change via publishFormVersion.
    const statusChanged = updateData.status !== undefined;
    if (statusChanged && form.lastPublishedVersionId) {
      await purgeFormCache(id);
    }

    return { form: serializeForm(form) };
  });

/** Flip analytics toggle. Unlike most settings (draftSettings, live on republish), writes
 * live formSettings directly so isAnalyticsEnabled + recorder gate flip immediately. Draft
 * updated too so share sidebar reflects it without a form-listings-sync roundtrip. */
export const setFormAnalytics = createServerFn({ method: "POST" })
  .middleware([authMiddleware, formProSettingsMiddleware])
  .validator(v.object({ formId: v.pipe(v.string(), v.uuid()), enabled: v.boolean() }))
  .handler(async ({ data, context }) => {
    const { orgId } = await requireScopedForm(context.session, data.formId);

    // Re-check plan gate on enable: input is {enabled} not a gated field name, so
    // formProSettingsMiddleware (scans field names) waves it through. Polar-sync since
    // organization.plan drifts on missed webhook. OFF always allowed (downgrade path).
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
      // Draft: keeps share-sidebar optimistic state in sync.
      await tx
        .update(forms)
        .set({
          draftSettings: mergeFormSettings({ analytics: data.enabled }),
          updatedAt: now,
        })
        .where(eq(forms.id, data.formId));

      // Live — what isAnalyticsEnabled reads. Merge into existing row; don't clobber other settings.
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

/** Settings-only publish: commit draftSettings straight to live `form_settings` WITHOUT
 * snapshotting content into a version. This is what the Settings page "Save" button calls —
 * it deliberately does NOT go through publishForm, so pending field/content edits stay in
 * draft and never leak live. Writes draft + live in one tx so both clear the dirty flag. */
export const saveFormSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      settings: v.record(v.string(), v.any()),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.formId);

    const sanitized = sanitizeFormSettings(data.settings);
    // Hash a non-empty, not-already-hashed password before persisting; never store plaintext.
    if (sanitized.password && !isHashedFormPassword(sanitized.password)) {
      sanitized.password = hashFormPassword(sanitized.password);
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(forms)
        .set({ draftSettings: sanitized, updatedAt: now })
        .where(eq(forms.id, data.formId));
      await tx
        .insert(formSettings)
        .values({ formId: data.formId, settings: sanitized, updatedAt: now })
        .onConflictDoUpdate({
          target: formSettings.formId,
          set: { settings: sanitized, updatedAt: now },
        });
    });

    return { ok: true as const };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(v.object({ id: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data, context }) => {
    await requireScopedForm(context.session, data.id);

    const [form] = await db.delete(forms).where(eq(forms.id, data.id)).returning();
    if (!form) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "DELETE matched no forms row — deleted between auth and delete",
        fix: "Refresh — the form may have been deleted",
        internal: { formId: data.id },
      });
    }
    // No purge: form already archived (tag invalidated then), nothing cacheable since.

    return { form: serializeForm(form) };
  });

// Bulk soft-delete (move to trash). Capped at 200 to keep statements bounded.
export const bulkArchiveForms = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    v.object({
      ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(200)),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireScopedFormsBulk(context.session, data.ids);

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
  .validator(
    v.object({
      ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(200)),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireScopedFormsBulk(context.session, data.ids);

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
        previewImageUrl: forms.previewImageUrl,
        customization: forms.customization,
        formName: forms.formName,
        sortIndex: forms.sortIndex,
        submissionCount: count(submissions.id),
        // Hash-based change detection needs these every fetch; else post-publish refetch wipes them.
        publishedContentHash: forms.publishedContentHash,
        lastPublishedVersionId: forms.lastPublishedVersionId,
        slug: forms.slug,
        customDomainId: forms.customDomainId,
        // Draft of behavioral settings (editor sidebar reads/writes); live ones in form_settings.
        // Carry both so client can diff for the settings dirty flag without an extra fetch.
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

// Archived listings — fetched only when trash dialog opens. Trash needs just id/title/icon
// (display) + workspaceId (grouping) + updatedAt (30-day banner); no count/versioned settings.
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

export const _getFormById = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(v.object({ id: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data, context }) => {
    const [_, [form], [settingsRow]] = await Promise.all([
      requireScopedForm(context.session, data.id),
      db.select().from(forms).where(eq(forms.id, data.id)),
      // Carry live settings on the detail so the settings dirty-flag is correct regardless of
      // whether the listing (which also joins form_settings) has loaded yet. Null until first save.
      db
        .select({ settings: formSettings.settings })
        .from(formSettings)
        .where(eq(formSettings.formId, data.id)),
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

    return { form: { ...serializeForm(form), liveSettings: settingsRow?.settings ?? null } };
  });

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
  .validator(v.object({ formId: v.pipe(v.string(), v.uuid()), slug: v.string() }))
  .handler(async ({ data, context }) => {
    const { formId, slug } = data;
    await requireScopedForm(context.session, formId);

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

    if (!updatedForm) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "UPDATE matched no forms row — deleted mid-request",
        fix: "Refresh — the form may have been deleted",
        internal: { formId },
      });
    }

    // Slug is public-routing surface; old URL serves cached body until tag invalidated.
    // Skip if never published.
    if (updatedForm.lastPublishedVersionId) await purgeFormCache(formId);

    return { form: serializeForm(updatedForm) };
  });

/** @public - consumed by upcoming domain settings UI */
export const assignFormDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      customDomainId: v.nullable(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const { formId, customDomainId } = data;
    const { orgId } = await requireScopedForm(context.session, formId);

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

    if (!updatedForm) {
      throw createError({
        code: "forms/not-found" satisfies ErrorCode,
        status: 404,
        message: "Form not found",
        why: "UPDATE matched no forms row — deleted mid-request",
        fix: "Refresh — the form may have been deleted",
        internal: { formId },
      });
    }

    // Domain assignment changes canonical URL + head metadata in the public response. Purge if ever published.
    if (updatedForm.lastPublishedVersionId) await purgeFormCache(formId);

    return { form: serializeForm(updatedForm) };
  });
