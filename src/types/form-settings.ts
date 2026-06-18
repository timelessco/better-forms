import * as v from "valibot";

export type Language = "English" | "Spanish" | "French";

export type PopupTriggerType = "button" | "delay" | "scroll";
export type PopupButtonPosition = "bottom-right" | "bottom-left" | "center";
export type PopupAnimation = "fade" | "slide" | "scale";

export type EmbedType = "standard" | "popup" | "fullPage";

export type PresentationMode = "card" | "field-by-field";

/** Canonical shape of `forms.settings` JSONB — all behavioral config. Theme tokens live in `forms.customization`, not here. */
export interface FormSettings {
  language: string;
  redirectOnCompletion: boolean;
  redirectUrl: string | null;
  redirectDelay: number;
  progressBar: boolean;
  presentationMode: PresentationMode;
  branding: boolean;
  analytics: boolean;
  partialSubmissions: boolean;
  /** Shared GMT offset label (e.g. "GMT +05:30") applied to retention + closure schedules. */
  timezone: string | null;
  dataRetention: boolean;
  dataRetentionDays: number | null;
  /** Date the retention window deletes submissions (yyyy-MM-dd). */
  dataRetentionDate: string | null;
  /** Time-of-day for retention deletion (HH:mm, 24h). */
  dataRetentionTime: string | null;

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
  /** Time-of-day the form closes (HH:mm, 24h), paired with closeDate. */
  closeTime: string | null;
  /** Show a custom message (closedFormMessage) when the form is closed, instead of the default. */
  customClosedMessage: boolean;
  limitSubmissions: boolean;
  maxSubmissions: number | null;
  preventDuplicateSubmissions: boolean;

  /** Advance to the next page automatically once a single-answer field is answered. */
  autoAdvance: boolean;
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

/** Merge partial PublicFormSettings (live doc: undefined for missing; version snapshot: null for missing) over defaults; missing fields fall back to default. */
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
  partialSubmissions: false,
  timezone: null,
  dataRetention: false,
  dataRetentionDays: null,
  dataRetentionDate: null,
  dataRetentionTime: null,
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
  closeTime: null,
  customClosedMessage: false,
  limitSubmissions: false,
  maxSubmissions: null,
  preventDuplicateSubmissions: false,
  autoAdvance: false,
  saveAnswersForLater: true,
};

/** Per-field validators — the trust boundary's type guard. A value that fails its schema
 * (wrong type from a hand-crafted request) falls back to the default rather than persisting. */
const string = v.string();
const nullableString = v.nullable(v.string());
const boolean = v.boolean();
const number = v.number();
const formSettingsSchemas: { [K in keyof FormSettings]: v.GenericSchema<FormSettings[K]> } = {
  language: string,
  redirectOnCompletion: boolean,
  redirectUrl: nullableString,
  redirectDelay: number,
  progressBar: boolean,
  presentationMode: v.picklist(["card", "field-by-field"]),
  branding: boolean,
  analytics: boolean,
  partialSubmissions: boolean,
  timezone: nullableString,
  dataRetention: boolean,
  dataRetentionDays: v.nullable(v.number()),
  dataRetentionDate: nullableString,
  dataRetentionTime: nullableString,
  selfEmailNotifications: boolean,
  notificationEmail: nullableString,
  respondentEmailNotifications: boolean,
  respondentEmailSubject: nullableString,
  respondentEmailBody: nullableString,
  passwordProtect: boolean,
  password: nullableString,
  closeForm: boolean,
  closedFormMessage: nullableString,
  closeOnDate: boolean,
  closeDate: nullableString,
  closeTime: nullableString,
  customClosedMessage: boolean,
  limitSubmissions: boolean,
  maxSubmissions: v.nullable(v.number()),
  preventDuplicateSubmissions: boolean,
  autoAdvance: boolean,
  saveAnswersForLater: boolean,
};

/** Server-side trust boundary for the Settings page "Save": keeps only keys that exist in the
 * settings schema (drops anything a client could inject), validates each value's type (a
 * wrong-typed field falls back to its default), and fills missing keys from defaults.
 * Never `?? default` — preserves an explicit `false`/`null`/`0` so a toggled-off setting isn't
 * silently reset to its default. */
export const sanitizeFormSettings = (input: Record<string, unknown>): FormSettings =>
  Object.fromEntries(
    (Object.keys(defaultFormSettings) as (keyof FormSettings)[]).map((k) => {
      if (!(k in input)) return [k, defaultFormSettings[k]];
      const parsed = v.safeParse(formSettingsSchemas[k], input[k]);
      return [k, parsed.success ? parsed.output : defaultFormSettings[k]];
    }),
  ) as unknown as FormSettings;
