import * as v from "valibot";

export const FIELD_TYPES = [
  "input",
  "textarea",
  "email",
  "phone",
  "number",
  "link",
  "date",
  "time",
  "fileUpload",
  "checkbox",
  "multiChoice",
  "multiSelect",
  "ranking",
] as const;

export const fieldTypeEnum = v.picklist(FIELD_TYPES);

export const setHeaderOp = v.object({
  type: v.literal("set-header"),
  title: v.optional(v.string()),
  iconKeyword: v.optional(v.string()),
  coverColor: v.optional(v.string()),
});

export const addFieldOp = v.object({
  type: v.literal("add-field"),
  fieldType: fieldTypeEnum,
  label: v.string(),
  required: v.optional(v.boolean()),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export const addSectionOp = v.object({
  type: v.literal("add-section"),
  title: v.string(),
  level: v.optional(v.picklist(["1", "2", "3"])),
});

// Overridable (semantic) tokens the AI emits. Everything else (primary-foreground, secondary,
// muted, accent, border, ring, *-foreground, card/popover) is structural — derived from the
// base/accent palette and no longer overridable, so the AI must not emit them.
export const AI_THEME_TOKEN_KEYS = [
  "background",
  "foreground",
  "primary",
  "destructive",
  "input",
] as const;

const themeTokensShape: Record<string, v.StringSchema<undefined>> = {};
for (const base of AI_THEME_TOKEN_KEYS) {
  themeTokensShape[`light:${base}`] = v.string();
  themeTokensShape[`dark:${base}`] = v.string();
}

export const themeTokensSchema = v.object(themeTokensShape);

export const RADIUS_OPTIONS = ["none", "small", "medium", "large"] as const;

// Free-plan picks — mirror Customize sidebar's basic Theme so the gate accepts it.
export const FREE_THEME_COLOR_OPTIONS = [
  "neutral",
  "zinc",
  "rose",
  "blue",
  "green",
  "amber",
  "orange",
  "violet",
  "emerald",
  "cyan",
  "indigo",
  "pink",
  "red",
] as const;

export const FREE_BASE_COLOR_OPTIONS = ["neutral", "zinc", "slate", "stone", "gray"] as const;

export const FREE_DEFAULT_MODE_OPTIONS = ["light", "dark", "system"] as const;

// Free-plan schema — only FREE_CUSTOMIZATION_KEYS (gate). No light/dark tokens,
// no custom CSS.
export const freeThemeSchema = v.object({
  themeColor: v.picklist(FREE_THEME_COLOR_OPTIONS),
  baseColor: v.picklist(FREE_BASE_COLOR_OPTIONS),
  font: v.string(),
  radius: v.picklist(RADIUS_OPTIONS),
  defaultMode: v.picklist(FREE_DEFAULT_MODE_OPTIONS),
});

export type FreeThemeArgs = v.InferOutput<typeof freeThemeSchema>;

export const setThemeOp = v.object({
  type: v.literal("set-theme"),
  // Optional, but if present all 30 keys required — forces a complete theme,
  // not tokens: null.
  tokens: v.optional(themeTokensSchema),
  font: v.optional(v.string()),
  radius: v.optional(v.picklist(RADIUS_OPTIONS)),
});

export const replaceFieldOp = v.object({
  type: v.literal("replace-field"),
  label: v.optional(v.string()),
  fieldType: v.optional(fieldTypeEnum),
  placeholder: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export const addPageBreakOp = v.object({
  type: v.literal("add-page-break"),
  isThankYou: v.optional(v.boolean()),
});

export const opSchema = v.variant("type", [
  setHeaderOp,
  addFieldOp,
  addSectionOp,
  setThemeOp,
  replaceFieldOp,
  addPageBreakOp,
]);

export const formGenSchema = v.object({
  ops: v.array(opSchema),
});

export type SetHeaderOp = v.InferOutput<typeof setHeaderOp>;
export type AddFieldOp = v.InferOutput<typeof addFieldOp>;
export type AddSectionOp = v.InferOutput<typeof addSectionOp>;
export type SetThemeOp = v.InferOutput<typeof setThemeOp>;
export type ReplaceFieldOp = v.InferOutput<typeof replaceFieldOp>;
export type AddPageBreakOp = v.InferOutput<typeof addPageBreakOp>;
export type Op = v.InferOutput<typeof opSchema>;
export type FormGenResult = v.InferOutput<typeof formGenSchema>;

export type PartialOp = Partial<Op> & { type?: Op["type"] };

export const isOpReady = (op: PartialOp | undefined): op is Op => {
  if (!op?.type) return false;

  switch (op.type) {
    case "set-header":
      return Boolean(op.title || op.iconKeyword || op.coverColor);
    case "add-field":
      return Boolean(op.fieldType && op.label && op.label.length > 0);
    case "add-section":
      return Boolean(op.title && op.title.length > 0);
    case "set-theme":
      return Boolean(op.tokens || op.font || op.radius);
    case "replace-field":
      return Boolean(op.label || op.fieldType || op.placeholder || op.options);
    case "add-page-break":
      return true;
    default:
      return false;
  }
};
