import { FREE_CUSTOMIZATION_KEYS } from "@/lib/server-fn/plan-helpers";

/**
 * Pro-gated customization keys (the customize-sidebar Pro sections). Free users can tweak them
 * in the draft (sidebar no longer hard-blocks); publish strips them from the version snapshot —
 * server-enforced in publishFormVersion, surfaced client-side by the pro-publish-gate dialog.
 *
 * FREE_CUSTOMIZATION_KEYS (the basic Theme controls the AI free tier also writes) is the single
 * source of truth for what is free — proSectionForKey short-circuits to null for those, so a
 * key listed there (e.g. `font`) can never be stripped or flagged, even if it overlaps a section.
 */

// Mode-scoped color token overrides (written as `light:<token>` / `dark:<token>`; legacy rows
// may carry the bare token name) — the Colors section's SEMANTIC_COLOR_TOKENS.
const PRO_COLOR_TOKENS = new Set([
  "title-color",
  "foreground",
  "background",
  "input",
  "primary",
  "destructive",
  "success",
]);

const PRO_SECTIONS: { label: string; keys: readonly string[] }[] = [
  {
    // `font` (body font family) is intentionally absent — it's a FREE_CUSTOMIZATION_KEYS basic
    // Theme control. Only the title font + sizing/spacing/alignment are Pro.
    label: "Typography",
    keys: [
      "titleFont",
      "titleFontSize",
      "baseFontSize",
      "titleLetterSpacing",
      "letterSpacing",
      "titleLineHeight",
      "lineHeight",
      "textAlign",
    ],
  },
  // Colors handled via PRO_COLOR_TOKENS (mode-prefixed), Custom CSS via customCss matcher.
  {
    label: "Inputs",
    keys: ["inputWidth", "inputHeight", "inputRadius", "inputMarginBottom", "inputPadding"],
  },
  { label: "Buttons", keys: ["buttonWidth", "buttonHeight", "buttonRadius", "buttonAlign"] },
];

const PRO_PLAIN_KEY_SECTION = new Map<string, string>(
  PRO_SECTIONS.flatMap((s) => s.keys.map((k) => [k, s.label] as const)),
);

/** Section label for a pro-gated key, or null if the key is free. */
export const proSectionForKey = (key: string): string | null => {
  // Basic Theme controls are free everywhere (single source of truth) — never strip/flag them.
  if (FREE_CUSTOMIZATION_KEYS.has(key)) return null;
  const plain = PRO_PLAIN_KEY_SECTION.get(key);
  if (plain) return plain;
  // strip optional light:/dark: mode prefix for token + customCss matching
  const bare = key.replace(/^(?:light|dark):/, "");
  if (bare === "customCss") return "Custom CSS";
  if (PRO_COLOR_TOKENS.has(bare)) return "Colors";
  return null;
};

/** Ordered Pro section labels with at least one non-empty value set (for the publish dialog). */
export const getProCustomizationSections = (
  customization: Record<string, string> | null | undefined,
): string[] => {
  const found = new Set<string>();
  for (const [key, value] of Object.entries(customization ?? {})) {
    if (!value) continue; // mode-migration leaves ""-valued keys behind — not active styles
    const section = proSectionForKey(key);
    if (section) found.add(section);
  }
  const order = ["Typography", "Colors", "Inputs", "Buttons", "Custom CSS"];
  return order.filter((s) => found.has(s));
};

/** Customization with all pro-gated keys removed — what a free plan actually publishes. */
export const stripProCustomization = (
  customization: Record<string, string> | null | undefined,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(customization ?? {}).filter(([key]) => proSectionForKey(key) === null),
  );
