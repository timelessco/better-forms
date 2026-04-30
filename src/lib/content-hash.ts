/**
 * Shared content-hash helpers for form publish/change detection.
 *
 * The server computes `publishedContentHash` at publish time and stores it on
 * the form row. The client re-computes the same hash from live draft state
 * and compares to detect unpublished changes — no version-content fetch
 * required.
 *
 * Both environments must run identical code, so the hash is a pure-JS fn
 * (cyrb53) and the JSON is canonicalized (sorted keys, stripped undefineds)
 * so that object-key-order drift between server reads and client edits
 * cannot produce spurious mismatches.
 */

import type { FormSettings } from "@/types/form-settings";

export const VERSIONED_SETTINGS_KEYS = [
  "progressBar",
  "presentationMode",
  "saveAnswersForLater",
  "redirectOnCompletion",
  "redirectUrl",
  "redirectDelay",
  "language",
  "passwordProtect",
  "password",
  "closeForm",
  "closedFormMessage",
  "closeOnDate",
  "closeDate",
  "limitSubmissions",
  "maxSubmissions",
  "preventDuplicateSubmissions",
  "selfEmailNotifications",
  "notificationEmail",
  "respondentEmailNotifications",
  "respondentEmailSubject",
  "respondentEmailBody",
  "dataRetention",
  "dataRetentionDays",
] as const satisfies readonly (keyof FormSettings)[];

export type VersionedSettingKey = (typeof VERSIONED_SETTINGS_KEYS)[number];

/** Snapshot shape stored in `formVersions.settings` — every versioned key
 * is present (with the source value or `null`), live-only keys excluded. */
export type VersionedSettingsSnapshot = {
  [K in VersionedSettingKey]: FormSettings[K] | null;
};

export type VersionedSnapshotInput = {
  content: unknown;
  customization: unknown;
  title: unknown;
  icon: unknown;
  cover: unknown;
  /** Source of versioned settings. The helper only reads keys named in
   * `VERSIONED_SETTINGS_KEYS`, so callers can pass a live `FormSettings`,
   * a stored `VersionedSettingsSnapshot`, or any partial — extra keys are
   * ignored, missing ones default to null. */
  settings: Partial<FormSettings> | VersionedSettingsSnapshot | null | undefined;
};

export const pickVersionedSettings = (
  src: Partial<FormSettings> | VersionedSettingsSnapshot | null | undefined,
): VersionedSettingsSnapshot => {
  const obj: Partial<Record<VersionedSettingKey, unknown>> = src ?? {};
  const out = {} as VersionedSettingsSnapshot;
  for (const key of VERSIONED_SETTINGS_KEYS) {
    (out as Record<string, unknown>)[key] = obj[key] ?? null;
  }
  return out;
};

const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).toSorted()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
};

const cyrb53 = (str: string, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const high = 2097151 & h2;
  return high.toString(16).padStart(6, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
};

export const computeContentHash = (input: VersionedSnapshotInput): string => {
  const snapshot = {
    content: input.content ?? [],
    customization: input.customization ?? {},
    title: input.title ?? null,
    icon: input.icon ?? null,
    cover: input.cover ?? null,
    settings: pickVersionedSettings(input.settings ?? {}),
  };
  return cyrb53(JSON.stringify(canonicalize(snapshot)));
};
