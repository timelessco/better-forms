import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNotNull } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import { customDomains, forms, member } from "@/db/schema";
import type { CustomDomainRow } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";
import { purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import { vercelDomains } from "@/lib/vercel-domains.server";
import type { VercelDomainVerification } from "@/lib/vercel-domains.server";
import {
  refreshDomainStatusFromVercel,
  triggerDomainVerification,
} from "@/lib/server-fn/custom-domains.server";
import { DOMAIN_LIMITS } from "@/lib/config/plan-config";
import { isSubdomain } from "@/lib/dns-instructions";

const serializeDomain = (domain: CustomDomainRow) => ({
  ...domain,
  createdAt: domain.createdAt.toISOString(),
  updatedAt: domain.updatedAt.toISOString(),
});

export const listOrgDomains = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ orgId: v.string() }))
  .handler(async ({ data, context }) => {
    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.session.user.id), eq(member.organizationId, data.orgId)),
      );

    if (!membership) {
      throw createError({
        code: "domains/not-owner" satisfies ErrorCode,
        status: 403,
        message: "Not authorized to view domains for this organization",
        why: "User isn't a member of the requested org",
        fix: "Switch to an org you're a member of",
        internal: { orgId: data.orgId, userId: context.session.user.id },
      });
    }

    const domains = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.organizationId, data.orgId));

    return domains.map(serializeDomain);
  });

export const addDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      orgId: v.string(),
      domain: v.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!isSubdomain(data.domain)) {
      throw createError({
        code: "domains/invalid-host" satisfies ErrorCode,
        status: 400,
        message:
          "Custom domains must be a subdomain like forms.example.com. Bare/apex domains aren't supported — please use a subdomain.",
        why: "Provided host has no subdomain label",
        fix: "Use a subdomain such as forms.example.com",
        internal: { domain: data.domain },
      });
    }

    const [[membership], existingDomains] = await Promise.all([
      db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, context.session.user.id),
            eq(member.organizationId, data.orgId),
            eq(member.role, "owner"),
          ),
        ),
      db.select().from(customDomains).where(eq(customDomains.organizationId, data.orgId)),
    ]);

    if (!membership) {
      throw createError({
        code: "domains/not-owner" satisfies ErrorCode,
        status: 403,
        message: "Only organization owners can add domains",
        why: "User is a member but not an owner of this org",
        fix: "Ask the organization owner to add the domain",
        internal: { orgId: data.orgId, userId: context.session.user.id },
      });
    }

    if (existingDomains.length >= DOMAIN_LIMITS.maxDomainsPerOrg) {
      throw createError({
        code: "domains/limit-reached" satisfies ErrorCode,
        status: 422,
        message: `Maximum of ${DOMAIN_LIMITS.maxDomainsPerOrg} domains per organization`,
        why: "Organization has reached its custom-domain cap",
        fix: "Remove an existing domain before adding another",
        internal: { orgId: data.orgId, existingCount: existingDomains.length },
      });
    }

    let vercelDomainId: string | undefined;
    let vercelFailed = false;
    let vercelErrorMessage: string | undefined;
    let verification: VercelDomainVerification[] | undefined;
    try {
      const vercelResult = await vercelDomains.add(data.domain);
      vercelDomainId = vercelResult.domain;
      verification = vercelResult.verification;
    } catch (e) {
      vercelFailed = true;
      vercelErrorMessage = e instanceof Error ? e.message : "Unknown Vercel error";
      console.error("[addDomain] Vercel add failed:", vercelErrorMessage);
    }

    const now = new Date();
    const [domain] = await db
      .insert(customDomains)
      .values({
        id: crypto.randomUUID(),
        organizationId: data.orgId,
        domain: data.domain,
        status: vercelFailed ? "failed" : "pending",
        vercelDomainId: vercelDomainId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      ...serializeDomain(domain),
      verification,
      warning: vercelFailed
        ? `Vercel registration failed: ${vercelErrorMessage ?? "unknown error"}`
        : undefined,
    };
  });

export const removeDomain = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ domainId: v.string() }))
  .handler(async ({ data, context }) => {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, data.domainId));

    if (!domain) {
      throw createError({
        code: "domains/not-found" satisfies ErrorCode,
        status: 404,
        message: "Domain not found",
        why: "No custom_domain row exists with this ID",
        fix: "Refresh the domain list — it may have been removed",
        internal: { domainId: data.domainId },
      });
    }

    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, context.session.user.id),
          eq(member.organizationId, domain.organizationId),
          eq(member.role, "owner"),
        ),
      );

    if (!membership) {
      throw createError({
        code: "domains/not-owner" satisfies ErrorCode,
        status: 403,
        message: "Only organization owners can remove domains",
        why: "User is a member but not an owner of this org",
        fix: "Ask the organization owner to remove the domain",
        internal: { domainId: data.domainId, userId: context.session.user.id },
      });
    }

    try {
      await vercelDomains.remove(domain.domain);
    } catch {
      // Continue with DB cleanup even if Vercel fails
    }

    // Clear customDomainId on all forms + delete domain atomically; capture ever-published
    // forms (canonical URL changed) to purge CDN tags post-commit.
    const everPublished = await db.transaction(async (tx) => {
      const affected = await tx
        .update(forms)
        .set({ customDomainId: null })
        .where(eq(forms.customDomainId, data.domainId))
        .returning({ id: forms.id, lastPublishedVersionId: forms.lastPublishedVersionId });

      await tx.delete(customDomains).where(eq(customDomains.id, data.domainId));

      return affected.filter((f) => f.lastPublishedVersionId).map((f) => f.id);
    });

    await purgeFormCacheBatch(everPublished);

    return { success: true };
  });

const assertCanReadDomain = async (domainId: string, userId: string) => {
  const [domain] = await db.select().from(customDomains).where(eq(customDomains.id, domainId));
  if (!domain) {
    throw createError({
      code: "domains/not-found" satisfies ErrorCode,
      status: 404,
      message: "Domain not found",
      why: "No custom_domain row exists with this ID",
      fix: "Refresh the domain list — it may have been removed",
      internal: { domainId },
    });
  }
  const [membership] = await db
    .select()
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, domain.organizationId)));
  if (!membership) {
    throw createError({
      code: "domains/not-authorized" satisfies ErrorCode,
      status: 403,
      message: "Not authorized to check this domain",
      why: "User isn't a member of the domain's organization",
      fix: "Switch to the correct organization",
      internal: { domainId, userId, organizationId: domain.organizationId },
    });
  }
};

export const checkDomainStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ domainId: v.string() }))
  .handler(async ({ data, context }) => {
    await assertCanReadDomain(data.domainId, context.session.user.id);
    return refreshDomainStatusFromVercel(data.domainId);
  });

export const recheckDomainStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ domainId: v.string() }))
  .handler(async ({ data, context }) => {
    await assertCanReadDomain(data.domainId, context.session.user.id);
    return triggerDomainVerification(data.domainId);
  });

export const updateDomainMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      domainId: v.string(),
      siteTitle: v.optional(v.string()),
      faviconUrl: v.optional(v.string()),
      ogImageUrl: v.optional(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, data.domainId));

    if (!domain) {
      throw createError({
        code: "domains/not-found" satisfies ErrorCode,
        status: 404,
        message: "Domain not found",
        why: "No custom_domain row exists with this ID",
        fix: "Refresh the domain list — it may have been removed",
        internal: { domainId: data.domainId },
      });
    }

    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.userId, context.session.user.id),
          eq(member.organizationId, domain.organizationId),
          eq(member.role, "owner"),
        ),
      );

    if (!membership) {
      throw createError({
        code: "domains/not-owner" satisfies ErrorCode,
        status: 403,
        message: "Only organization owners can update domain settings",
        why: "User is a member but not an owner of this org",
        fix: "Ask the organization owner to update the domain",
        internal: { domainId: data.domainId, userId: context.session.user.id },
      });
    }

    const { domainId, ...updateFields } = data;
    const { updated, boundFormIds } = await db.transaction(async (tx) => {
      const [updatedRow] = await tx
        .update(customDomains)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(customDomains.id, domainId))
        .returning();
      // Same transaction so a concurrent assignFormDomain can't slip a form between meta UPDATE and read.
      const bound = await tx
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.customDomainId, domainId), isNotNull(forms.lastPublishedVersionId)));
      return { updated: updatedRow, boundFormIds: bound.map((f) => f.id) };
    });

    // siteTitle/faviconUrl/ogImageUrl land in every bound form's rendered <head>.
    await purgeFormCacheBatch(boundFormIds);

    return serializeDomain(updated);
  });

export const getDomainByHost = createServerFn({ method: "POST" })
  .inputValidator(v.object({ host: v.string() }))
  .handler(async ({ data }) => {
    const [domain] = await db
      .select({
        id: customDomains.id,
        domain: customDomains.domain,
        siteTitle: customDomains.siteTitle,
        faviconUrl: customDomains.faviconUrl,
        ogImageUrl: customDomains.ogImageUrl,
      })
      .from(customDomains)
      .where(and(eq(customDomains.domain, data.host), eq(customDomains.status, "verified")));

    if (!domain) {
      return null;
    }

    return domain;
  });

export const orgDomainsQueryOptions = (orgId: string) =>
  queryOptions({
    queryKey: ["org-domains", orgId],
    queryFn: () => listOrgDomains({ data: { orgId } }),
    staleTime: 1000 * 60 * 5,
  });
