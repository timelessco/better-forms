import type { SetThemeOp } from "@/lib/ai/ops-schema";
import { FREE_CUSTOMIZATION_KEYS } from "@/lib/server-fn/plan-helpers";

/**
 * A theme payload is "free-tier" when every key in it is in the free-tier
 * customization allowlist. The Pro-tier path emits `light:*` / `dark:*`
 * token overrides — none of those are in the allowlist, so any presence of
 * such a key flips the payload to Pro-tier.
 */
const isFreeTierThemePayload = (theme: Record<string, string>): boolean => {
  for (const key of Object.keys(theme)) {
    if (!FREE_CUSTOMIZATION_KEYS.has(key)) return false;
  }
  return true;
};

/**
 * Merges a flat theme payload (returned by /api/ai/form-generate in theme
 * mode) into an existing customization record. Used by the editor's
 * themeMutation to build the optimistic update.
 *
 * Pro-plan payloads carry `light:*` / `dark:*` token overrides plus
 * `font`/`radius`. Free-plan payloads carry only the basic keys
 * (`themeColor`, `baseColor`, `font`, `radius`, `defaultMode`).
 *
 * Branching rule:
 * - **Free-tier merge** (every key in `theme` is a free key): start from a
 *   filtered `current` that *also* drops any non-free keys. This keeps the
 *   final payload inside the server gate's allowlist — important for
 *   downgraded users (whose `light:*` overrides are preserved on
 *   downgrade) and for users whose `organization.plan` column is stale.
 * - **Pro-tier merge** (any Pro key in `theme`): preserve `current`
 *   verbatim. Pro users retain their existing customization.
 *
 * In both cases the preset is marked "custom" so the editor's preset
 * selector reflects that the user has deviated from a built-in style.
 */
export const mergeThemeIntoCustomization = (
  current: Record<string, string>,
  theme: Record<string, string>,
): Record<string, string> => {
  // Empty theme = no-op. Don't flip preset to "custom" or strip any keys —
  // the AI returned nothing actionable.
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

/**
 * Streaming-path variant: applies a SetThemeOp (the schema the AI emits in
 * non-theme modes — create / append / replace) to an existing customization
 * record. Same merge semantics as mergeThemeIntoCustomization, but unpacks
 * the op's `tokens` / `font` / `radius` fields. Undefined fields don't
 * overwrite — only the keys the op actually carries are merged in.
 */
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
