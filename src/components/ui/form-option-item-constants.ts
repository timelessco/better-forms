// Constants used by both the platejs-based `form-option-item-node` (editor
// runtime) and plain React consumers (public form field renderers, submission
// summaries). Kept in a separate file so importing these values doesn't drag
// the platejs runtime into the client bundle.

export const LETTER_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const MULTI_SELECT_COLORS = [
  { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400" },
  { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
] as const;
