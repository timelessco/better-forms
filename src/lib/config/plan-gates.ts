import type { ServerPlan } from "@/lib/server-fn/plan-helpers";

// Source of truth: which Plan unlocks which feature. New gate: add a key, call
// `planUnlocks(plan, "<key>")` at the site. Change a tier: edit the value.

export type FeatureGate =
  | "analytics"
  | "customDomains"
  | "respondentEmailNotifications"
  | "dataRetention"
  | "disableBranding"
  | "customization"
  | "aiChatPresentation";

export const PLAN_GATES: Record<FeatureGate, ServerPlan> = {
  analytics: "pro",
  customDomains: "pro",
  respondentEmailNotifications: "pro",
  dataRetention: "pro",
  disableBranding: "pro",
  customization: "pro",
  aiChatPresentation: "pro",
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
  /** Hard cap on AI Chat Sessions per org per UTC month. `null` = blocked. */
  aiChatSessionsPerMonth: number | null;
  /** Hard cap on builder-side AI Chat preview calls per org per UTC day. */
  aiChatPreviewPerDay: number | null;
};

export const PLAN_QUOTAS: Record<ServerPlan, PlanQuota> = {
  free: {
    aiGenerationsPerDay: 5,
    aiChatSessionsPerMonth: null,
    aiChatPreviewPerDay: null,
  },
  pro: {
    aiGenerationsPerDay: null,
    aiChatSessionsPerMonth: 500,
    aiChatPreviewPerDay: 100,
  },
  business: {
    aiGenerationsPerDay: null,
    aiChatSessionsPerMonth: 5000,
    aiChatPreviewPerDay: 100,
  },
};

export const aiQuotaForPlan = (plan: ServerPlan): PlanQuota => PLAN_QUOTAS[plan];
