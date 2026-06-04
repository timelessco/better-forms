// Shared by form-option-item-node (editor runtime) and plain React consumers. Separate file so
// importing these doesn't pull the platejs runtime into the client bundle.

export const LETTER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// "Labels" setting on an option group — how each option's leading marker renders.
export type OptionLabelStyle = "none" | "letters" | "numbers";

/** Ordinal shown in an option's badge: A/B/C… for letters, 1/2/3… for numbers. */
export const getOptionOrdinal = (style: "letters" | "numbers", index: number): string =>
  style === "numbers" ? String(index + 1) : LETTER_LABELS[index % LETTER_LABELS.length];

// App-chrome surfaces (e.g. the submissions dashboard) follow the global app theme via Tailwind
// `dark:` variants. Form-preview surfaces must NOT use these — see getMultiSelectColor below.
export const MULTI_SELECT_COLORS = [
  { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
  { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
] as const;

// Explicit per-mode palettes (no `dark:` variant). The `dark:` variant keys off any ancestor
// `.dark` — including the app's <html.dark> — so a light form inside a dark editor would wrongly
// render dark chips. Form-preview surfaces pick from these by the FORM's own mode instead.
const MULTI_SELECT_COLORS_LIGHT = [
  { bg: "bg-red-50", text: "text-red-700" },
  { bg: "bg-orange-50", text: "text-orange-700" },
  { bg: "bg-amber-50", text: "text-amber-700" },
  { bg: "bg-emerald-50", text: "text-emerald-700" },
  { bg: "bg-blue-50", text: "text-blue-700" },
  { bg: "bg-purple-50", text: "text-purple-700" },
] as const;

const MULTI_SELECT_COLORS_DARK = [
  { bg: "bg-red-950/30", text: "text-red-400" },
  { bg: "bg-orange-950/30", text: "text-orange-400" },
  { bg: "bg-amber-950/30", text: "text-amber-400" },
  { bg: "bg-emerald-950/30", text: "text-emerald-400" },
  { bg: "bg-blue-950/30", text: "text-blue-400" },
  { bg: "bg-purple-950/30", text: "text-purple-400" },
] as const;

/** Chip color for form-preview surfaces — resolved from the FORM's mode, not the app's `.dark`. */
export const getMultiSelectColor = (index: number, isDark: boolean) => {
  const palette = isDark ? MULTI_SELECT_COLORS_DARK : MULTI_SELECT_COLORS_LIGHT;
  return palette[index % palette.length];
};
