import { defaultFormSettings } from "@/types/form-settings";
import type { FormSettings } from "@/types/form-settings";

// Allowlist (default-deny): only purely presentational settings survive into a template.
// New FormSettings fields are excluded by default until explicitly added here.
export const TEMPLATE_SETTINGS_ALLOWLIST = [
  "language",
  "progressBar",
  "presentationMode",
  "saveAnswersForLater",
  "preventDuplicateSubmissions",
] as const satisfies readonly (keyof FormSettings)[];

export type TemplateSettings = Pick<FormSettings, (typeof TEMPLATE_SETTINGS_ALLOWLIST)[number]>;

export const pickTemplateSettings = (settings: FormSettings): TemplateSettings => {
  const out = {} as TemplateSettings;
  for (const key of TEMPLATE_SETTINGS_ALLOWLIST) {
    (out as Record<string, unknown>)[key] = settings[key];
  }
  return out;
};

// Clone-side: rebuild full settings from defaults, overlaying only the allowlisted subset.
export const applyTemplateSettings = (picked: TemplateSettings): FormSettings => ({
  ...defaultFormSettings,
  ...picked,
});
