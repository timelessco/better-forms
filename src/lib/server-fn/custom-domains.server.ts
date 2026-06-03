import { eq } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import { customDomains } from "@/db/schema";
import { db } from "@/db";
import type { ErrorCode } from "@/lib/errors/codes";
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
    throw createError({
      code: "domains/not-found" satisfies ErrorCode,
      status: 404,
      message: "Domain not found",
      why: "No custom_domain row exists with this ID",
      fix: "Check the domain ID — it may have been removed",
      internal: { domainId },
    });
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

  if (!updated) {
    throw createError({
      code: "domains/not-found" satisfies ErrorCode,
      status: 404,
      message: "Domain not found",
      why: "UPDATE matched no custom_domains row — deleted mid-request",
      fix: "Check the domain ID — it may have been removed",
      internal: { domainId },
    });
  }

  return {
    ...serializeDomain(updated),
    verification: status?.verification,
  };
};

/** Poll-friendly status read (GET .../domains/{d}) for periodic refresh/reconciliation. Not
 * rate-limited, unlike POST /verify (Vercel caps that at 50/hr per team). */
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

/** Explicit user action (POST .../domains/{d}/verify); counts against Vercel's 50/hr quota.
 * Only call from a button click. */
export const triggerDomainVerification = async (domainId: string) => {
  const domain = await loadDomain(domainId);

  let status: VercelDomainStatus;
  try {
    status = await vercelDomains.verify(domain.domain);
  } catch {
    return persistStatus(domainId, null);
  }

  // verify() may return verified=false with no challenge; fall back to GET for the TXT record.
  if (!status.verified && !status.verification?.length) {
    try {
      status = await vercelDomains.check(domain.domain);
    } catch {
      // keep prior status
    }
  }

  return persistStatus(domainId, status);
};
