import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import {
  customDomains,
  formSettings,
  forms,
  formVersions,
  organization,
  submissions,
  workspaces,
} from "@/db/schema";
import { db } from "@/db";
import { planUnlocks } from "@/lib/config/plan-gates";
import { resolveOgInputs } from "@/lib/og/resolve-inputs";
import { buildOgImageUrl } from "@/lib/og/url";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import { shortIdSchema } from "@/lib/short-id";
import { buildPublicFormSettings } from "@/types/form-settings";

/**
 * Public server functions for viewing a form and verifying its password.
 * NO authentication required.
 */

/**
 * Get a published form by its public Form Short ID.
 * Returns the published version content, not the draft content.
 * Only returns forms with status === "published".
 */
export const getPublishedFormByShortId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ shortId: shortIdSchema }))
  .handler(async ({ data }) => {
    // Settings live in the form_settings table now (split from versioning —
    // see docs/plans/2026-05-04-settings-version-split.md). Editor content
    // (title, content, icon, cover, customization) still comes from the
    // published version snapshot so changes don't leak before republish.
    const [form] = await db
      .select({
        id: forms.id,
        shortId: forms.shortId,
        slug: forms.slug,
        customDomain: customDomains.domain,
        status: forms.status,
        lastPublishedVersionId: forms.lastPublishedVersionId,
        liveSettings: formSettings.settings,
        orgPlan: organization.plan,
        draftTitle: forms.title,
        draftContent: forms.content,
        draftIcon: forms.icon,
        draftCover: forms.cover,
      })
      .from(forms)
      .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
      .innerJoin(organization, eq(organization.id, workspaces.organizationId))
      .leftJoin(formSettings, eq(formSettings.formId, forms.id))
      .leftJoin(customDomains, eq(customDomains.id, forms.customDomainId))
      .where(and(eq(forms.shortId, data.shortId), eq(forms.status, "published")));

    if (!form) {
      console.log("[public-read] form not found or not published", { shortId: data.shortId });
      throw notFound();
    }

    console.log("[public-read] forms row", {
      id: form.id,
      status: form.status,
      lastPublishedVersionId: form.lastPublishedVersionId,
      draftTitle: form.draftTitle,
    });

    // Load version snapshot (source of truth for editor content/customization)
    const [version] = form.lastPublishedVersionId
      ? await db.select().from(formVersions).where(eq(formVersions.id, form.lastPublishedVersionId))
      : [undefined];

    console.log("[public-read] version row", {
      requestedVersionId: form.lastPublishedVersionId,
      foundVersionId: version?.id,
      versionNumber: version?.version,
      title: version?.title,
      customization: version?.customization,
      publishedAt: version?.publishedAt,
    });

    const canDisableBranding =
      isServerPlan(form.orgPlan) && planUnlocks(form.orgPlan, "disableBranding");
    const liveBranding = form.liveSettings?.branding ?? true;
    const liveAnalytics = form.liveSettings?.analytics ?? false;
    const effectiveBranding = canDisableBranding ? liveBranding : true;
    const settings = buildPublicFormSettings(form.liveSettings, { branding: effectiveBranding });

    // --- Gating checks (based on snapshot settings — changes here require republish) ---
    // 1. Form manually closed
    if (settings.closeForm) {
      return {
        form: null,
        error: null,
        gated: {
          type: "closed" as const,
          message: settings.closedFormMessage || "This form is now closed.",
        },
      };
    }

    // 2. Close on scheduled date
    if (settings.closeOnDate && settings.closeDate && new Date(settings.closeDate) < new Date()) {
      return {
        form: null,
        error: null,
        gated: {
          type: "date_expired" as const,
          message: settings.closedFormMessage || "This form is no longer accepting responses.",
        },
      };
    }

    // 3. Submission limit reached
    if (settings.limitSubmissions && settings.maxSubmissions) {
      const [{ value: submissionCount }] = await db
        .select({ value: count() })
        .from(submissions)
        .where(eq(submissions.formId, form.id));
      if (submissionCount >= settings.maxSubmissions) {
        return {
          form: null,
          error: null,
          gated: {
            type: "limit_reached" as const,
            message: "This form has reached its maximum number of submissions.",
          },
        };
      }
    }

    // 4. Password protection — return form data but flag as gated
    // NEVER send password to client
    const gated = settings.passwordProtect
      ? { type: "password_required" as const, message: null }
      : null;

    const og = resolveOgInputs(version, {
      title: form.draftTitle,
      content: form.draftContent,
      icon: form.draftIcon,
    });
    const ogImageUrl = buildOgImageUrl({
      shortId: form.shortId,
      title: og.title,
      description: og.description,
    });
    const ogDescription = og.description;

    if (version) {
      return {
        form: {
          id: form.id,
          shortId: form.shortId,
          slug: form.slug,
          customDomain: form.customDomain,
          title: version.title,
          content: version.content as object[],
          customization: (version.customization ?? {}) as Record<string, string>,
          icon: version.icon,
          cover: version.cover,
          status: form.status,
          analytics: liveAnalytics,
          settings,
          ogDescription,
          ogImageUrl,
        },
        error: null,
        gated,
      };
    }

    // Fallback for forms without versions (backward compatibility — shouldn't
    // happen after backfill migration but kept for safety)
    return {
      form: {
        id: form.id,
        shortId: form.shortId,
        slug: form.slug,
        customDomain: form.customDomain,
        title: form.draftTitle,
        content: form.draftContent as object[],
        customization: {} as Record<string, string>,
        icon: form.draftIcon,
        cover: form.draftCover,
        status: form.status,
        analytics: liveAnalytics,
        settings,
        ogDescription,
        ogImageUrl,
      },
      error: null,
      gated: null,
    };
  });

/**
 * Verify a password for a password-protected form.
 */
export const verifyFormPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ formId: z.uuid(), password: z.string() }))
  .handler(async ({ data }) => {
    // Password is a live setting — read from form_settings, not the draft.
    const [formRow] = await db
      .select({ settings: formSettings.settings })
      .from(formSettings)
      .where(eq(formSettings.formId, data.formId));

    if (!formRow) {
      return { valid: false };
    }

    return { valid: formRow.settings?.password === data.password };
  });
