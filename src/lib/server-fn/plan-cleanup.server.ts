import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { customDomains, formSettings, forms, organization, workspaces } from "@/db/schema";
import { mergeFormSettings } from "@/lib/server-fn/forms";
import { vercelDomains } from "@/lib/vercel-domains.server";

type DbExecutor = typeof db;

/** Idempotent: ne(status,'suspended') filter protects previousStatus from re-run overwrite.
 * Detaches each non-suspended domain from Vercel (best-effort); keeps account-level domains
 * so re-upgrade is fast. */
export const applyDowngradeCleanup = async (
  orgId: string,
  executor: DbExecutor = db,
): Promise<void> => {
  // Snapshot domains before the transaction (DB state changes) to know what to detach on Vercel.
  const toDetach = await executor
    .select({ domain: customDomains.domain })
    .from(customDomains)
    .where(and(eq(customDomains.organizationId, orgId), ne(customDomains.status, "suspended")));

  // Best-effort: Vercel outage mustn't block downgrade; record marked suspended below won't serve.
  await Promise.allSettled(toDetach.map((d) => vercelDomains.detach(d.domain)));

  await executor.transaction(async (tx) => {
    await tx.update(organization).set({ plan: "free" }).where(eq(organization.id, orgId));

    // customization preserved (UI re-gates on free; clearing would surprise a re-upgrader).
    // Pro-gated keys reset via jsonb merge so rest of settings (language/redirect/password)
    // stays. Reset both draft (editor reflects downgrade) and live formSettings (public renderer
    // stops serving pro features immediately).
    const proResetPatch = {
      analytics: false,
      dataRetention: false,
      dataRetentionDays: null,
      respondentEmailNotifications: false,
      branding: true,
    } as const;

    const orgWorkspaceIds = tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.organizationId, orgId));

    await tx
      .update(forms)
      .set({ draftSettings: mergeFormSettings(proResetPatch) })
      .where(inArray(forms.workspaceId, orgWorkspaceIds));

    await tx
      .update(formSettings)
      .set({
        settings: sql`${formSettings.settings} || ${JSON.stringify(proResetPatch)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          formSettings.formId,
          tx
            .select({ id: forms.id })
            .from(forms)
            .where(inArray(forms.workspaceId, orgWorkspaceIds)),
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

/** Form columns NOT auto-restored — re-flipping Pro features the user implicitly dropped would
 * surprise. Re-attaches each suspended domain to Vercel (best-effort) for SSL/routing; account
 * domain preserved on downgrade so usually verified=true without fresh TXT.
 * targetPlan defaults to "pro" (back-compat + common path); pass "business" for Business events. */
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

    // Suspended rows lacking previousStatus (manual DB edit) → 'pending' so they re-verify first.
    await tx
      .update(customDomains)
      .set({
        status: sql`COALESCE(${customDomains.previousStatus}, 'pending')`,
        previousStatus: null,
      })
      .where(and(eq(customDomains.organizationId, orgId), eq(customDomains.status, "suspended")));
  });
};
