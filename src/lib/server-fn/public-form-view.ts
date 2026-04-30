import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { forms, formVersions, organization, submissions, workspaces } from "@/db/schema";
import { db } from "@/db";
import { planUnlocks } from "@/lib/config/plan-gates";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import { buildPublicFormSettings } from "@/types/form-settings";

/**
 * Public server functions for viewing a form and verifying its password.
 * NO authentication required.
 */

/**
 * Get a published form by ID (public access).
 * Returns the published version content, not the draft content.
 * Only returns forms with status === "published".
 */
export const getPublishedFormById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    // Read only the live (Group 4) fields + version pointer from forms. Everything
    // else (content, title, icon, cover, Group 2 settings) comes from the
    // published version snapshot so changes don't leak to the public URL until
    // the user republishes.
    const [form] = await db
      .select({
        id: forms.id,
        status: forms.status,
        lastPublishedVersionId: forms.lastPublishedVersionId,
        // Group 4 (live): branding + analytics live in forms.settings JSONB.
        // Plus draft fallbacks for forms without versions.
        liveSettings: forms.settings,
        orgPlan: organization.plan,
        draftTitle: forms.title,
        draftContent: forms.content,
        draftIcon: forms.icon,
        draftCover: forms.cover,
      })
      .from(forms)
      .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
      .innerJoin(organization, eq(organization.id, workspaces.organizationId))
      .where(and(eq(forms.id, data.id), eq(forms.status, "published")));

    if (!form) {
      throw notFound();
    }

    // Load version snapshot (source of truth for Groups 1-3)
    const [version] = form.lastPublishedVersionId
      ? await db.select().from(formVersions).where(eq(formVersions.id, form.lastPublishedVersionId))
      : [undefined];

    const snapshotSettings = version?.settings;
    const canDisableBranding =
      isServerPlan(form.orgPlan) && planUnlocks(form.orgPlan, "disableBranding");
    const liveBranding = form.liveSettings?.branding ?? true;
    const liveAnalytics = form.liveSettings?.analytics ?? false;
    const effectiveBranding = canDisableBranding ? liveBranding : true;
    const settings = buildPublicFormSettings(snapshotSettings, { branding: effectiveBranding });

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
        .where(eq(submissions.formId, data.id));
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

    if (version) {
      return {
        form: {
          id: form.id,
          title: version.title,
          content: version.content as object[],
          customization: (version.customization ?? {}) as Record<string, string>,
          icon: version.icon,
          cover: version.cover,
          status: form.status,
          analytics: liveAnalytics,
          settings,
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
        title: form.draftTitle,
        content: form.draftContent as object[],
        customization: {} as Record<string, string>,
        icon: form.draftIcon,
        cover: form.draftCover,
        status: form.status,
        analytics: liveAnalytics,
        settings,
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
    const [formRow] = await db
      .select({ settings: forms.settings })
      .from(forms)
      .where(eq(forms.id, data.formId));

    if (!formRow) {
      return { valid: false };
    }

    return { valid: formRow.settings?.password === data.password };
  });
