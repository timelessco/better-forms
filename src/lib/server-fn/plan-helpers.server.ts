import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { planForProductId } from "@/lib/config/plan-config";
import type { Plan } from "@/lib/config/plan-config";
import { logger } from "@/lib/utils";
import { isServerPlan } from "./plan-helpers";
import type { ServerPlan } from "./plan-helpers";

// Reads the cached `organization.plan` (synced by Polar webhooks); falls back
// to 'free' for unknown orgs or unexpected column values.
export const getOrgPlan = async (orgId: string): Promise<ServerPlan> => {
  const [row] = await db
    .select({ plan: organization.plan })
    .from(organization)
    .where(eq(organization.id, orgId));
  const resolved: ServerPlan = isServerPlan(row?.plan) ? row.plan : "free";
  logger("[getOrgPlan]", {
    orgId,
    rawColumnValue: row?.plan ?? null,
    rowFound: Boolean(row),
    returns: resolved,
  });
  return resolved;
};

/**
 * Plan resolver with self-heal: reads `organization.plan` first; if it says
 * "free" (which can be stale when a Polar upgrade webhook didn't reach this
 * env), falls back to verifying with Polar using the caller's email. If
 * Polar shows an active paid subscription for this org, writes it back to
 * the DB and returns the corrected plan. The fast path (no email passed,
 * or column already paid) skips the Polar round-trip entirely.
 */
export const getOrgPlanWithPolarSync = async (
  orgId: string,
  userEmail: string | null,
): Promise<ServerPlan> => {
  const cached = await getOrgPlan(orgId);
  if (cached !== "free") return cached;
  if (!userEmail) return cached;

  try {
    const { polarClient } = await import("@/lib/auth/auth");

    // Polar customers are keyed by email in this project (see
    // openOrgBillingPortal). The user's active subs across all their
    // customers — we filter to ones whose metadata.referenceId matches
    // this org.
    const customerList = await polarClient.customers.list({ email: userEmail, limit: 5 });
    const customers = customerList.result.items;
    if (customers.length === 0) {
      logger("[getOrgPlanWithPolarSync] no Polar customer for email", { orgId });
      return cached;
    }

    const subLists = await Promise.all(
      customers.map((c) => polarClient.subscriptions.list({ customerId: c.id, active: true })),
    );

    let detected: Plan = "free";
    for (const subs of subLists) {
      for (const sub of subs.result.items) {
        const metaRef = (sub.metadata as { referenceId?: unknown } | null)?.referenceId;
        if (metaRef !== orgId) continue;
        const plan = planForProductId(sub.productId);
        if (plan === "business") {
          detected = "business";
          break;
        }
        if (plan === "pro" && detected === "free") detected = "pro";
      }
      if (detected === "business") break;
    }

    if (detected === "free") {
      logger("[getOrgPlanWithPolarSync] Polar also reports free", { orgId });
      return cached;
    }

    logger("[getOrgPlanWithPolarSync] DRIFT detected — writing back", {
      orgId,
      cachedColumn: cached,
      polarReports: detected,
    });
    await db.update(organization).set({ plan: detected }).where(eq(organization.id, orgId));
    return detected;
  } catch (e) {
    logger(
      "[getOrgPlanWithPolarSync] Polar verify failed — keeping cached value",
      e instanceof Error ? e.message : String(e),
    );
    return cached;
  }
};
