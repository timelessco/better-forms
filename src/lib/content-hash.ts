/**
 * Content-hash helpers for publish/change detection. Server stores
 * `publishedContentHash` at publish; client recomputes from draft to detect
 * unpublished changes (no version fetch).
 *
 * Settings NOT hashed — live outside versioning (see
 * docs/plans/2026-05-04-settings-version-split.md); dirty flag is deep-equal of
 * `forms.draftSettings` vs live `form_settings`.
 *
 * Pure-JS hash (cyrb53) + canonicalized JSON (sorted keys, stripped undefineds)
 * so server/client run identical code and key-order drift can't false-mismatch.
 */

import type { FormSettings } from "@/types/form-settings";

/** Legacy shape: pre-split versions stored settings here. Kept for reading old
 * `formVersions.settings` rows; new versions write `null`. */
export type VersionedSettingsSnapshot = Partial<FormSettings>;

export type VersionedSnapshotInput = {
  content: unknown;
  customization: unknown;
  title: unknown;
  icon: unknown;
  cover: unknown;
};

export const canonicalize = (value: unknown): unknown => {
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

/** Stable JSON for jsonb-roundtrip-safe equality. Postgres jsonb may reorder
 * keys after merge — canonicalize both sides before comparing. */
export const canonicalJSON = (value: unknown): string => JSON.stringify(canonicalize(value));

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
  };
  return cyrb53(JSON.stringify(canonicalize(snapshot)));
};
