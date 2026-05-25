import { eq } from "drizzle-orm";
import { customDomains } from "@/db/schema";
import { db } from "@/db";
import { vercelDomains } from "@/lib/vercel-domains.server";
import type { VercelDomainStatus } from "@/lib/vercel-domains.server";

const serializeDomain = (domain: typeof customDomains.$inferSelect) => ({
  ...domain,
  createdAt: domain.createdAt.toISOString(),
  updatedAt: domain.updatedAt.toISOString(),
});

const loadDomain = async (domainId: string) => {
  const [domain] = await db.select().from(customDomains).where(eq(customDomains.id, domainId));
  if (!domain) {
    throw new Error("Domain not found");
  }
  return domain;
};

const persistStatus = async (domainId: string, status: VercelDomainStatus | null) => {
  const newStatus = status?.verified ? "verified" : status === null ? "failed" : "pending";
  const [updated] = await db
    .update(customDomains)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(customDomains.id, domainId))
    .returning();

  return {
    ...serializeDomain(updated),
    verification: status?.verification,
  };
};

/**
 * Poll-friendly status read: GET /v9/projects/.../domains/{d}.
 * Reserved-cost path. Use this for periodic UI refresh / reconciliation.
 * Vercel rate-limits POST /verify to 50/hr per team — this endpoint is not.
 */
export const refreshDomainStatusFromVercel = async (domainId: string) => {
  const domain = await loadDomain(domainId);

  let status: VercelDomainStatus;
  try {
    status = await vercelDomains.check(domain.domain);
  } catch {
    return persistStatus(domainId, null);
  }

  return persistStatus(domainId, status);
};

/**
 * Explicit user action — POST /v9/projects/.../domains/{d}/verify.
 * Counts against Vercel's 50/hr verify quota. Only call from a button click.
 */
export const triggerDomainVerification = async (domainId: string) => {
  const domain = await loadDomain(domainId);

  let status: VercelDomainStatus;
  try {
    status = await vercelDomains.verify(domain.domain);
  } catch {
    return persistStatus(domainId, null);
  }

  // verify() can return verified=false with no challenge; fall back to GET so
  // the UI has the TXT record to display.
  if (!status.verified && !status.verification?.length) {
    try {
      status = await vercelDomains.check(domain.domain);
    } catch {
      // keep prior status
    }
  }

  return persistStatus(domainId, status);
};
