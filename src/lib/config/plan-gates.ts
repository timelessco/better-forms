import type { ServerPlan } from "@/lib/server-fn/plan-helpers";

// Source of truth: which Plan unlocks which feature. New gate: add a key, call
// `planUnlocks(plan, "<key>")` at the site. Change a tier: edit the value.

export type FeatureGate =
  | "analytics"
  | "customDomains"
  | "respondentEmailNotifications"
  | "dataRetention"
  | "disableBranding"
  | "customization";

export const PLAN_GATES: Record<FeatureGate, ServerPlan> = {
  analytics: "pro",
  customDomains: "pro",
  respondentEmailNotifications: "pro",
  dataRetention: "pro",
  disableBranding: "pro",
  customization: "pro",
};

export const PLAN_RANK: Record<ServerPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

export const planUnlocks = (plan: ServerPlan, feature: FeatureGate): boolean =>
  PLAN_RANK[plan] >= PLAN_RANK[PLAN_GATES[feature]];

// ─── Plan-scoped quotas ────────────────────────────────────────────────
// Numeric per-plan limits (not boolean gates). Co-located with PLAN_GATES.
// `null` = no cap.
export type PlanQuota = {
  /** Hard cap on AI form-generate calls per org per UTC day. */
  aiGenerationsPerDay: number | null;
};

export const PLAN_QUOTAS: Record<ServerPlan, PlanQuota> = {
  free: {
    aiGenerationsPerDay: 5,
  },
  pro: {
    aiGenerationsPerDay: null,
  },
  business: {
    aiGenerationsPerDay: null,
  },
};

export const aiQuotaForPlan = (plan: ServerPlan): PlanQuota => PLAN_QUOTAS[plan];
