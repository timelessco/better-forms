import type { FeatureGate } from "@/lib/config/plan-gates";

export type ServerPlan = "free" | "pro" | "business";

export const isServerPlan = (value: unknown): value is ServerPlan =>
  value === "free" || value === "pro" || value === "business";

export type FormProSettingsInput = {
  branding?: boolean;
  respondentEmailNotifications?: boolean;
  dataRetention?: boolean;
  analytics?: boolean;
};

// Free-plan customization keys (basic Theme controls) — consumed by the AI form-gen theming
// path. NOT a draft-write gate: the soft Pro gate lets free users hold Pro customization in
// drafts; publishFormVersion strips Pro keys from the published snapshot instead. Gating
// updateForm here caused an optimistic-rollback loop (hover-applied controls re-fired on
// every revert).
export const FREE_CUSTOMIZATION_KEYS: ReadonlySet<string> = new Set([
  "preset",
  "themeColor",
  "baseColor",
  "font",
  "radius",
  "defaultMode",
]);

// Maps each FormProSettingsInput field → FeatureGate + predicate for when it's gating-eligible.
// These are LIVE settings (take effect without publish), so they stay hard-gated.
const FORM_INPUT_GATES: ReadonlyArray<{
  field: keyof FormProSettingsInput;
  gate: FeatureGate;
  isActive: (value: unknown) => boolean;
}> = [
  { field: "branding", gate: "disableBranding", isActive: (v) => v === false },
  {
    field: "respondentEmailNotifications",
    gate: "respondentEmailNotifications",
    isActive: (v) => v === true,
  },
  { field: "dataRetention", gate: "dataRetention", isActive: (v) => v === true },
  { field: "analytics", gate: "analytics", isActive: (v) => v === true },
];

// FeatureGates this input activates; empty = no plan check needed.
export const formSettingsFeatureGates = (data: FormProSettingsInput): FeatureGate[] => {
  const record = data as Record<string, unknown>;
  const gates: FeatureGate[] = [];
  for (const { field, gate, isActive } of FORM_INPUT_GATES) {
    if (isActive(record[field])) gates.push(gate);
  }
  return gates;
};

// Do these inputs need any paid feature? Used by formProSettingsMiddleware to decide plan fetch.
export const requiresProForFormSettings = (data: FormProSettingsInput): boolean =>
  formSettingsFeatureGates(data).length > 0;
