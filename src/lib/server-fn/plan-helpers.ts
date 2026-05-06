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
  presentationMode?: string;
};

// Customization keys available to every plan (basic Theme controls in the
// editor's Customize sidebar). Anything outside this set — light:/dark:
// per-mode color overrides, layout numbers, typography, custom CSS — is
// Pro-only and triggers the customization gate.
export const FREE_CUSTOMIZATION_KEYS: ReadonlySet<string> = new Set([
  "preset",
  "themeColor",
  "baseColor",
  "font",
  "radius",
  "defaultMode",
]);

const customizationRequiresPro = (value: unknown): boolean => {
  if (value == null || typeof value !== "object") return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (!FREE_CUSTOMIZATION_KEYS.has(key)) return true;
  }
  return false;
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
    isActive: customizationRequiresPro,
  },
  {
    field: "presentationMode",
    gate: "aiChatPresentation",
    isActive: (v) => v === "ai-chat",
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
