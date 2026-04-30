import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customDomains, forms, organization, workspaces } from "@/db/schema";
import { mergeFormSettings } from "@/lib/server-fn/forms";
import { vercelDomains } from "@/lib/vercel-domains.server";

type DbExecutor = typeof db;

/**
 * Idempotent: running twice produces the same final state. The
 * `ne(status, 'suspended')` filter is what protects `previousStatus` from
 * being overwritten on a re-run.
 *
 * Detaches each non-suspended domain from the Vercel project (best-effort).
 * Account-level domains are kept so re-upgrade is fast.
 */
export const applyDowngradeCleanup = async (
  orgId: string,
  executor: DbExecutor = db,
): Promise<void> => {
  // Snapshot domains BEFORE the transaction so we know what to detach on
  // Vercel even though their DB state will change.
  const toDetach = await executor
    .select({ domain: customDomains.domain })
    .from(customDomains)
    .where(and(eq(customDomains.organizationId, orgId), ne(customDomains.status, "suspended")));

  // Best-effort: a Vercel outage shouldn't block the local downgrade. The
  // record is still marked suspended below, so it won't serve traffic.
  await Promise.allSettled(toDetach.map((d) => vercelDomains.detach(d.domain)));

  await executor.transaction(async (tx) => {
    await tx.update(organization).set({ plan: "free" }).where(eq(organization.id, orgId));

    // `customization` is intentionally preserved — UI re-gates editing on free,
    // and clearing stored values would surprise a user who later re-upgrades.
    // Pro-gated keys are reset via a jsonb merge so the rest of `settings`
    // (language, redirect, password, etc.) stays untouched.
    await tx
      .update(forms)
      .set({
        settings: mergeFormSettings({
          analytics: false,
          dataRetention: false,
          dataRetentionDays: null,
          respondentEmailNotifications: false,
          branding: true,
        }),
      })
      .where(
        inArray(
          forms.workspaceId,
          tx
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.organizationId, orgId)),
        ),
      );

    await tx
      .update(customDomains)
      .set({
        previousStatus: sql`${customDomains.status}`,
        status: "suspended",
      })
      .where(and(eq(customDomains.organizationId, orgId), ne(customDomains.status, "suspended")));
  });
};

/**
 * Form columns are NOT auto-restored — re-flipping Pro features the user
 * implicitly opted out of during downgrade would be surprising.
 *
 * Re-attaches each suspended domain to the Vercel project (best-effort) so
 * SSL/routing is back in place. The account-level domain was preserved on
 * downgrade, so this typically returns verified=true without a fresh TXT.
 *
 * `targetPlan` defaults to "pro" for backwards compatibility with existing tests
 * and the most common upgrade path; pass "business" when handling a Business
 * subscription event.
 */
export const applyUpgradeRestore = async (
  orgId: string,
  executor: DbExecutor = db,
  targetPlan: "pro" | "business" = "pro",
): Promise<void> => {
  const toReattach = await executor
    .select({ domain: customDomains.domain })
    .from(customDomains)
    .where(and(eq(customDomains.organizationId, orgId), eq(customDomains.status, "suspended")));

  await Promise.allSettled(toReattach.map((d) => vercelDomains.add(d.domain)));

  await executor.transaction(async (tx) => {
    await tx.update(organization).set({ plan: targetPlan }).where(eq(organization.id, orgId));

    // Suspended rows without a recorded previousStatus (manual DB edit)
    // fall back to 'pending' so they re-verify before serving.
    await tx
      .update(customDomains)
      .set({
        status: sql`COALESCE(${customDomains.previousStatus}, 'pending')`,
        previousStatus: null,
      })
      .where(and(eq(customDomains.organizationId, orgId), eq(customDomains.status, "suspended")));
  });
};
