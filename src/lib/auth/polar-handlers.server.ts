import type { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import type { WebhookSubscriptionUncanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import { planForProductId } from "@/lib/config/plan-config";
import { logger } from "@/lib/utils";

// `plan-cleanup.server` is imported lazily inside each handler body. `auth.ts`
// is reachable from the client through `auth-client.ts` (which reads `Session`
// from the `auth` instance), so any *static* import here would drag the
// `@/db` + `pg` graph into the client bundle and produce hydration-time
// `Symbol(TSS_SERVER_FUNCTION_FACTORY) in undefined` errors. The lazy import
// keeps the heavy module out of the static graph; it only loads when Polar
// actually delivers a webhook (server-side, on demand).
//
// Errors are swallowed via the logger so a failed write doesn't wedge Polar's
// delivery channel — Polar retries, and read-time gates cover the gap.

type SubscriptionPayload =
  | WebhookSubscriptionActivePayload
  | WebhookSubscriptionCanceledPayload
  | WebhookSubscriptionCreatedPayload
  | WebhookSubscriptionRevokedPayload
  | WebhookSubscriptionUncanceledPayload
  | WebhookSubscriptionUpdatedPayload;

const extractOrgId = (payload: SubscriptionPayload): string | null => {
  const metadata = payload.data.metadata as { referenceId?: unknown } | null | undefined;
  const referenceId = metadata?.referenceId;
  return typeof referenceId === "string" && referenceId.length > 0 ? referenceId : null;
};

export const handleSubscriptionUpgrade = async (payload: SubscriptionPayload): Promise<void> => {
  const orgId = extractOrgId(payload);
  if (!orgId) {
    logger("[polar] subscription event missing referenceId metadata", payload.type);
    return;
  }
  const targetPlan = planForProductId(payload.data.productId);
  if (targetPlan === "free") {
    logger("[polar] unrecognized product on upgrade event, no plan change", payload.type, orgId);
    return;
  }
  try {
    const { applyUpgradeRestore } = await import("@/lib/server-fn/plan-cleanup.server");
    await applyUpgradeRestore(orgId, undefined, targetPlan);
  } catch (error) {
    logger("[polar] applyUpgradeRestore failed", orgId, error);
  }
};

export const handleSubscriptionDowngrade = async (payload: SubscriptionPayload): Promise<void> => {
  const orgId = extractOrgId(payload);
  if (!orgId) {
    logger("[polar] subscription event missing referenceId metadata", payload.type);
    return;
  }
  try {
    const { applyDowngradeCleanup } = await import("@/lib/server-fn/plan-cleanup.server");
    await applyDowngradeCleanup(orgId);
  } catch (error) {
    logger("[polar] applyDowngradeCleanup failed", orgId, error);
  }
};

// `subscription.updated` covers many transitions; we only act on `active` and
// `canceled` to avoid double-running with the dedicated created/canceled hooks.
export const handleSubscriptionUpdated = async (
  payload: WebhookSubscriptionUpdatedPayload,
): Promise<void> => {
  const status = payload.data.status;
  if (status === "active" && planForProductId(payload.data.productId) !== "free") {
    await handleSubscriptionUpgrade(payload);
    return;
  }
  if (status === "canceled") {
    await handleSubscriptionDowngrade(payload);
  }
};
