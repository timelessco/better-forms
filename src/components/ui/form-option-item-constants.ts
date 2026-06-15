// Shared by form-option-item-node (editor runtime) and plain React consumers. Separate file so
// importing these doesn't pull the platejs runtime into the client bundle.

export const LETTER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// "Labels" setting on an option group — how each option's leading marker renders.
export type OptionLabelStyle = "none" | "letters" | "numbers";

/** Ordinal shown in an option's badge: A/B/C… for letters, 1/2/3… for numbers. */
export const getOptionOrdinal = (style: "letters" | "numbers", index: number): string =>
  style === "numbers" ? String(index + 1) : LETTER_LABELS[index % LETTER_LABELS.length];

// App-chrome surfaces (e.g. the submissions dashboard) follow the global app theme via Tailwind
// `dark:` variants. Form-preview multi-selects render neutral chips now, so this palette is
// app-chrome only.
export const MULTI_SELECT_COLORS = [
  { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
  { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
] as const;
