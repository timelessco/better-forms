import type { FeatureGate } from "@/lib/config/plan-gates";

export type ServerPlan = "free" | "pro" | "business";

export const isServerPlan = (value: unknown): value is ServerPlan =>
  value === "free" || value === "pro" || value === "business";

export type FormProSettingsInput = {
  branding?: boolean;
  respondentEmailNotifications?: boolean;
  dataRetention?: boolean;
  analytics?: boolean;
  customization?: Record<string, unknown> | null;
};

// Maps each FormProSettingsInput field to the FeatureGate it triggers, with
// the predicate that decides when the field is "on" (gating-eligible).
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
  {
    field: "customization",
    gate: "customization",
    isActive: (v) => v != null && Object.keys(v as Record<string, unknown>).length > 0,
  },
];

// Returns which FeatureGates this input bundle activates.
// Empty array means no plan check needed.
export const formSettingsFeatureGates = (data: FormProSettingsInput): FeatureGate[] => {
  const record = data as Record<string, unknown>;
  const gates: FeatureGate[] = [];
  for (const { field, gate, isActive } of FORM_INPUT_GATES) {
    if (isActive(record[field])) gates.push(gate);
  }
  return gates;
};

// Pure predicate: do these form-settings inputs require any paid feature?
// Used by formProSettingsMiddleware to decide whether to fetch the plan.
export const requiresProForFormSettings = (data: FormProSettingsInput): boolean =>
  formSettingsFeatureGates(data).length > 0;
