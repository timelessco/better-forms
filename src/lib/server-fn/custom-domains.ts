import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { customDomains, forms, member } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import { vercelDomains } from "@/lib/vercel-domains.server";
import type { VercelDomainVerification } from "@/lib/vercel-domains.server";
import {
  refreshDomainStatusFromVercel,
  triggerDomainVerification,
} from "@/lib/server-fn/custom-domains.server";
import { DOMAIN_LIMITS } from "@/lib/config/plan-config";
import { isSubdomain } from "@/lib/dns-instructions";

const serializeDomain = (domain: typeof customDomains.$inferSelect) => ({
  ...domain,
  createdAt: domain.createdAt.toISOString(),
  updatedAt: domain.updatedAt.toISOString(),
});

export const listOrgDomains = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context }) => {
    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.session.user.id), eq(member.organizationId, data.orgId)),
      );

    if (!membership) {
      throw new Error("Not authorized to view domains for this organization");
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
    z.object({
      orgId: z.string(),
      domain: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!isSubdomain(data.domain)) {
      throw new Error(
        "Custom domains must be a subdomain like forms.example.com. Bare/apex domains aren't supported — please use a subdomain.",
      );
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
      throw new Error("Only organization owners can add domains");
    }

    if (existingDomains.length >= DOMAIN_LIMITS.maxDomainsPerOrg) {
      throw new Error(`Maximum of ${DOMAIN_LIMITS.maxDomainsPerOrg} domains per organization`);
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
  .inputValidator(z.object({ domainId: z.string() }))
  .handler(async ({ data, context }) => {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, data.domainId));

    if (!domain) {
      throw new Error("Domain not found");
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
      throw new Error("Only organization owners can remove domains");
    }

    try {
      await vercelDomains.remove(domain.domain);
    } catch {
      // Continue with DB cleanup even if Vercel fails
    }

    // Clear customDomainId on all forms and delete domain atomically.
    // Capture the ever-published forms whose canonical URL just changed so
    // we can purge their CDN tags after commit.
    const everPublished = await db.transaction(async (tx) => {
      const affected = await tx
        .update(forms)
        .set({ customDomainId: null })
        .where(eq(forms.customDomainId, data.domainId))
        .returning({ id: forms.id, lastPublishedVersionId: forms.lastPublishedVersionId });

      await tx.delete(customDomains).where(eq(customDomains.id, data.domainId));

      return affected.filter((f) => f.lastPublishedVersionId).map((f) => f.id);
    });

    void purgeFormCacheBatch(everPublished);

    return { success: true };
  });

const assertCanReadDomain = async (domainId: string, userId: string) => {
  const [domain] = await db.select().from(customDomains).where(eq(customDomains.id, domainId));
  if (!domain) {
    throw new Error("Domain not found");
  }
  const [membership] = await db
    .select()
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, domain.organizationId)));
  if (!membership) {
    throw new Error("Not authorized to check this domain");
  }
};

export const checkDomainStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ domainId: z.string() }))
  .handler(async ({ data, context }) => {
    await assertCanReadDomain(data.domainId, context.session.user.id);
    return refreshDomainStatusFromVercel(data.domainId);
  });

export const recheckDomainStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ domainId: z.string() }))
  .handler(async ({ data, context }) => {
    await assertCanReadDomain(data.domainId, context.session.user.id);
    return triggerDomainVerification(data.domainId);
  });

export const updateDomainMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      domainId: z.string(),
      siteTitle: z.string().optional(),
      faviconUrl: z.string().optional(),
      ogImageUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const [domain] = await db
      .select()
      .from(customDomains)
      .where(eq(customDomains.id, data.domainId));

    if (!domain) {
      throw new Error("Domain not found");
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
      throw new Error("Only organization owners can update domain settings");
    }

    const { domainId, ...updateFields } = data;
    const { updated, boundFormIds } = await db.transaction(async (tx) => {
      const [updatedRow] = await tx
        .update(customDomains)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(customDomains.id, domainId))
        .returning();
      // Same transaction so a concurrent assignFormDomain can't slip a form
      // in between the meta UPDATE and the bound-forms read.
      const bound = await tx
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.customDomainId, domainId), isNotNull(forms.lastPublishedVersionId)));
      return { updated: updatedRow, boundFormIds: bound.map((f) => f.id) };
    });

    // siteTitle / faviconUrl / ogImageUrl land in the rendered <head> of
    // every bound form's public response.
    void purgeFormCacheBatch(boundFormIds);

    return serializeDomain(updated);
  });

export const getDomainByHost = createServerFn({ method: "POST" })
  .inputValidator(z.object({ host: z.string() }))
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
