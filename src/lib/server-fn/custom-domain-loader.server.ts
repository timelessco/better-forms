import { notFound } from "@tanstack/react-router";
import { and, count, eq, ne } from "drizzle-orm";
import { customDomains, forms, formVersions, organization, submissions } from "@/db/schema";
import { db } from "@/db";
import { buildPublicFormSettings } from "@/types/form-settings";
import type { DomainMeta, ResolvedDomain } from "./custom-domain-loader";

/**
 * Look up a verified custom domain by hostname.
 * Throws notFound() if no matching verified domain exists.
 */
export const resolveCustomDomain = async (host: string): Promise<ResolvedDomain> => {
  const hostname = host.split(":")[0]; // strip port

  const [domain] = await db
    .select({
      id: customDomains.id,
      organizationId: customDomains.organizationId,
      domain: customDomains.domain,
      siteTitle: customDomains.siteTitle,
      faviconUrl: customDomains.faviconUrl,
      ogImageUrl: customDomains.ogImageUrl,
    })
    .from(customDomains)
    .innerJoin(organization, eq(organization.id, customDomains.organizationId))
    .where(
      and(
        eq(customDomains.domain, hostname),
        eq(customDomains.status, "verified"),
        ne(organization.plan, "free"),
      ),
    );

  if (!domain) {
    throw notFound();
  }

  return domain;
};

/**
 * Dev-friendly fallback: when the request is from an app host (localhost,
 * Vercel preview), look up the custom domain assigned to a form by slug.
 * Lets developers preview custom-domain forms without simulating the host.
 */
export const resolveDomainForSlug = async (slug: string): Promise<ResolvedDomain> => {
  const [row] = await db
    .select({
      id: customDomains.id,
      organizationId: customDomains.organizationId,
      domain: customDomains.domain,
      siteTitle: customDomains.siteTitle,
      faviconUrl: customDomains.faviconUrl,
      ogImageUrl: customDomains.ogImageUrl,
    })
    .from(customDomains)
    .innerJoin(forms, eq(forms.customDomainId, customDomains.id))
    .innerJoin(organization, eq(organization.id, customDomains.organizationId))
    .where(
      and(
        eq(forms.slug, slug),
        eq(forms.status, "published"),
        eq(customDomains.status, "verified"),
        ne(organization.plan, "free"),
      ),
    );

  if (!row) {
    throw notFound();
  }

  return row;
};

/**
 * Load a published form that belongs to a specific custom domain's organization.
 *
 * @param domain - resolved custom domain record
 * @param value  - the slug or form UUID to look up
 * @param lookupBy - whether `value` is a "slug" or "id"
 */
export const loadFormForCustomDomain = async (
  domain: ResolvedDomain,
  value: string,
  lookupBy: "slug" | "id",
) => {
  const conditions =
    lookupBy === "slug"
      ? and(
          eq(forms.slug, value),
          eq(forms.customDomainId, domain.id),
          eq(forms.status, "published"),
        )
      : and(
          eq(forms.id, value),
          eq(forms.customDomainId, domain.id),
          eq(forms.status, "published"),
        );

  const [form] = await db
    .select({
      id: forms.id,
      status: forms.status,
      lastPublishedVersionId: forms.lastPublishedVersionId,
      // Group 4 (live) — branding is always false for custom domains anyway;
      // analytics lives in forms.settings JSONB.
      liveSettings: forms.settings,
      draftTitle: forms.title,
      draftContent: forms.content,
      draftIcon: forms.icon,
      draftCover: forms.cover,
    })
    .from(forms)
    .where(conditions);

  if (!form) {
    throw notFound();
  }

  // Load version snapshot (source of truth for Groups 1-3)
  const [version] = form.lastPublishedVersionId
    ? await db.select().from(formVersions).where(eq(formVersions.id, form.lastPublishedVersionId))
    : [undefined];

  const snapshotSettings = version?.settings;
  const settings = buildPublicFormSettings(snapshotSettings, { branding: false });

  // --- Gating checks (same logic as getPublishedFormById) ---
  if (settings.closeForm) {
    return {
      form: null,
      error: null,
      gated: {
        type: "closed" as const,
        message: settings.closedFormMessage || "This form is now closed.",
      },
      domainMeta: buildDomainMeta(domain),
    };
  }

  if (settings.closeOnDate && settings.closeDate && new Date(settings.closeDate) < new Date()) {
    return {
      form: null,
      error: null,
      gated: {
        type: "date_expired" as const,
        message: settings.closedFormMessage || "This form is no longer accepting responses.",
      },
      domainMeta: buildDomainMeta(domain),
    };
  }

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
        domainMeta: buildDomainMeta(domain),
      };
    }
  }

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
        analytics: form.liveSettings?.analytics ?? false,
        settings,
      },
      error: null,
      gated,
      domainMeta: buildDomainMeta(domain),
    };
  }

  // Fallback for forms without versions (backward compat — shouldn't happen after backfill)
  return {
    form: {
      id: form.id,
      title: form.draftTitle,
      content: form.draftContent as object[],
      customization: {} as Record<string, string>,
      icon: form.draftIcon,
      cover: form.draftCover,
      status: form.status,
      analytics: form.liveSettings?.analytics ?? false,
      settings,
    },
    error: null,
    gated: null,
    domainMeta: buildDomainMeta(domain),
  };
};

const buildDomainMeta = (domain: ResolvedDomain): DomainMeta => ({
  siteTitle: domain.siteTitle,
  faviconUrl: domain.faviconUrl,
  ogImageUrl: domain.ogImageUrl,
});
