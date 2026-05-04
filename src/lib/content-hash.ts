/**
 * Shared content-hash helpers for form publish/change detection.
 *
 * The server computes `publishedContentHash` at publish time and stores it on
 * the form row. The client re-computes the same hash from live draft state
 * and compares to detect unpublished changes — no version-content fetch
 * required.
 *
 * Settings are intentionally **not** part of the hash — they live outside
 * versioning entirely (see docs/plans/2026-05-04-settings-version-split.md).
 * The settings dirty flag is computed by deep-equal of `forms.draftSettings`
 * vs the live `form_settings` row.
 *
 * Both environments must run identical code, so the hash is a pure-JS fn
 * (cyrb53) and the JSON is canonicalized (sorted keys, stripped undefineds)
 * so that object-key-order drift between server reads and client edits
 * cannot produce spurious mismatches.
 */

import type { FormSettings } from "@/types/form-settings";

/**
 * Legacy snapshot shape — pre-split versions stored a subset of settings keys
 * here. Kept for type compatibility when reading old `formVersions.settings`
 * rows; new versions write `null` for the column.
 */
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

/**
 * Stable JSON for jsonb-roundtrip-safe equality checks. Postgres jsonb may
 * rearrange keys after a server merge, so any equality check between draft
 * and live settings must canonicalize both sides first.
 */
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
