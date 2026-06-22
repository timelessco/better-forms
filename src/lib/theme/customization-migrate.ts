// Form customization is a stringly-typed JSONB map with no validation layer.
// Some keys went stale (replaced/removed) but linger in old rows; strip them at
// the read boundary so stored data matches runtime behavior.

// Keys that were removed/replaced; runtime ignores them. `coverFit` is dead:
// the cover image is always full-bleed (`--bf-cover-fit` is hard-set to "cover"
// in generate-theme-css.ts), so a stored coverFit:"contain" silently diverges.
export const STALE_CUSTOMIZATION_KEYS = ["coverFit"] as const;

// Pure: returns a new map with stale keys removed. Null/undefined → {}.
// Idempotent — re-running on its own output is a no-op.
export const migrateCustomization = (
  c: Record<string, string> | null | undefined,
): Record<string, string> => {
  if (!c) return {};
  const out: Record<string, string> = { ...c };
  for (const k of STALE_CUSTOMIZATION_KEYS) delete out[k];
  return out;
};
