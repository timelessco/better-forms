import type { SetThemeOp } from "@/lib/ai/ops-schema";
import { FREE_CUSTOMIZATION_KEYS } from "@/lib/server-fn/plan-helpers";

/** "Free-tier" = every key in the allowlist. Pro path emits `light:*`/`dark:*`
 * overrides (not allowlisted), so any such key flips the payload to Pro-tier. */
const isFreeTierThemePayload = (theme: Record<string, string>): boolean => {
  for (const key of Object.keys(theme)) {
    if (!FREE_CUSTOMIZATION_KEYS.has(key)) return false;
  }
  return true;
};

/**
 * Merge flat theme payload (from /api/ai/form-generate theme mode) into a
 * customization record; used for the editor's optimistic update.
 * - Free-tier merge (all `theme` keys free): start from `current` filtered to
 *   free keys, keeping the result inside the server allowlist — matters for
 *   downgraded users (light:* overrides preserved) and stale `organization.plan`.
 * - Pro-tier merge (any Pro key): preserve `current` verbatim.
 * Both mark preset "custom" (user deviated from a built-in style).
 */
export const mergeThemeIntoCustomization = (
  current: Record<string, string>,
  theme: Record<string, string>,
): Record<string, string> => {
  // Empty theme = no-op (AI returned nothing actionable): don't flip preset or strip keys.
  if (Object.keys(theme).length === 0) return current;
  if (isFreeTierThemePayload(theme)) {
    const filteredCurrent: Record<string, string> = {};
    for (const [key, value] of Object.entries(current)) {
      if (FREE_CUSTOMIZATION_KEYS.has(key)) filteredCurrent[key] = value;
    }
    return { ...filteredCurrent, ...theme, preset: "custom" };
  }
  return { ...current, ...theme, preset: "custom" };
};

/** Streaming variant: apply a SetThemeOp (AI emits in create/append/replace modes)
 * to a customization record. Same semantics as mergeThemeIntoCustomization but
 * unpacks op.tokens/font/radius; undefined fields don't overwrite. */
export const mergeSetThemeOpIntoCustomization = (
  current: Record<string, string>,
  op: SetThemeOp,
): Record<string, string> => {
  const next: Record<string, string> = { ...current, preset: "custom" };
  if (op.tokens) {
    for (const [key, value] of Object.entries(op.tokens)) {
      next[key] = value;
    }
  }
  if (op.font) next.font = op.font;
  if (op.radius) next.radius = op.radius;
  return next;
};
