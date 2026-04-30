export type Language = "English" | "Spanish" | "French";

export type PopupTriggerType = "button" | "delay" | "scroll";
export type PopupButtonPosition = "bottom-right" | "bottom-left" | "center";
export type PopupAnimation = "fade" | "slide" | "scale";

export type EmbedType = "standard" | "popup" | "fullPage";

export type PresentationMode = "card" | "field-by-field";

/**
 * Canonical shape of `forms.settings` JSONB column. The single typed group
 * for all behavioral configuration of a Form. `customization` (theme tokens)
 * lives in `forms.customization`, not here.
 */
export interface FormSettings {
  language: string;
  redirectOnCompletion: boolean;
  redirectUrl: string | null;
  redirectDelay: number;
  progressBar: boolean;
  presentationMode: PresentationMode;
  branding: boolean;
  analytics: boolean;
  dataRetention: boolean;
  dataRetentionDays: number | null;

  selfEmailNotifications: boolean;
  notificationEmail: string | null;
  respondentEmailNotifications: boolean;
  respondentEmailSubject: string | null;
  respondentEmailBody: string | null;

  passwordProtect: boolean;
  password: string | null;
  closeForm: boolean;
  closedFormMessage: string | null;
  closeOnDate: boolean;
  closeDate: string | null;
  limitSubmissions: boolean;
  maxSubmissions: number | null;
  preventDuplicateSubmissions: boolean;

  saveAnswersForLater: boolean;
}

export interface PublicFormSettings {
  progressBar: boolean;
  presentationMode: PresentationMode;
  branding: boolean;
  saveAnswersForLater: boolean;
  redirectOnCompletion: boolean;
  redirectUrl: string | null;
  redirectDelay: number;

  language: string;
  passwordProtect: boolean;
  closeForm: boolean;
  closedFormMessage: string | null;
  closeOnDate: boolean;
  closeDate: string | null;
  limitSubmissions: boolean;
  maxSubmissions: number | null;
  preventDuplicateSubmissions: boolean;
}

export const defaultPublicFormSettings: PublicFormSettings = {
  progressBar: false,
  presentationMode: "card",
  branding: true,
  saveAnswersForLater: true,
  redirectOnCompletion: false,
  redirectUrl: null,
  redirectDelay: 0,
  language: "English",
  passwordProtect: false,
  closeForm: false,
  closedFormMessage: "This form is now closed.",
  closeOnDate: false,
  closeDate: null,
  limitSubmissions: false,
  maxSubmissions: null,
  preventDuplicateSubmissions: false,
};

/**
 * Merge a partial source of PublicFormSettings fields (typically a
 * version-snapshot jsonb or a live form doc) with the defaults. Accepts both
 * `Partial<PublicFormSettings>` (live shape, undefined for missing) and a
 * versioned snapshot (every key present, `null` for missing). Either flavour
 * falls back to the default for missing fields.
 */
export const buildPublicFormSettings = (
  source: { [K in keyof PublicFormSettings]?: PublicFormSettings[K] | null } | null | undefined,
  overrides: Partial<PublicFormSettings> = {},
): PublicFormSettings => {
  const merged = { ...defaultPublicFormSettings };
  if (source) {
    for (const key of Object.keys(merged) as (keyof PublicFormSettings)[]) {
      const value = source[key];
      if (value === undefined || value === null) continue;
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return { ...merged, ...overrides };
};

export const defaultFormSettings: FormSettings = {
  language: "English",
  redirectOnCompletion: false,
  redirectUrl: null,
  redirectDelay: 0,
  progressBar: false,
  presentationMode: "card",
  branding: true,
  analytics: false,
  dataRetention: false,
  dataRetentionDays: null,
  selfEmailNotifications: false,
  notificationEmail: null,
  respondentEmailNotifications: false,
  respondentEmailSubject: null,
  respondentEmailBody: null,
  passwordProtect: false,
  password: null,
  closeForm: false,
  closedFormMessage: null,
  closeOnDate: false,
  closeDate: null,
  limitSubmissions: false,
  maxSubmissions: null,
  preventDuplicateSubmissions: false,
  saveAnswersForLater: true,
};
