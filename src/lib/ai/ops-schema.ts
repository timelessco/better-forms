import { z } from "zod";

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

export const fieldTypeEnum = z.enum(FIELD_TYPES);

export const setHeaderOp = z.object({
  type: z.literal("set-header"),
  title: z.string().optional(),
  iconKeyword: z.string().optional(),
  coverColor: z.string().optional(),
});

export const addFieldOp = z.object({
  type: z.literal("add-field"),
  fieldType: fieldTypeEnum,
  label: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const addSectionOp = z.object({
  type: z.literal("add-section"),
  title: z.string(),
  level: z.enum(["1", "2", "3"]).optional(),
});

// TOKEN_NAMES subset the AI emits. Card/popover excluded — derived from base/accent.
export const AI_THEME_TOKEN_KEYS = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
] as const;

const themeTokensShape: Record<string, z.ZodString> = {};
for (const base of AI_THEME_TOKEN_KEYS) {
  themeTokensShape[`light:${base}`] = z.string();
  themeTokensShape[`dark:${base}`] = z.string();
}

export const themeTokensSchema = z.object(themeTokensShape);

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
export const freeThemeSchema = z.object({
  themeColor: z.enum(FREE_THEME_COLOR_OPTIONS),
  baseColor: z.enum(FREE_BASE_COLOR_OPTIONS),
  font: z.string(),
  radius: z.enum(RADIUS_OPTIONS),
  defaultMode: z.enum(FREE_DEFAULT_MODE_OPTIONS),
});

export type FreeThemeArgs = z.infer<typeof freeThemeSchema>;

export const setThemeOp = z.object({
  type: z.literal("set-theme"),
  // Optional, but if present all 30 keys required — forces a complete theme,
  // not tokens: null.
  tokens: themeTokensSchema.optional(),
  font: z.string().optional(),
  radius: z.enum(RADIUS_OPTIONS).optional(),
});

export const replaceFieldOp = z.object({
  type: z.literal("replace-field"),
  label: z.string().optional(),
  fieldType: fieldTypeEnum.optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const addPageBreakOp = z.object({
  type: z.literal("add-page-break"),
  isThankYou: z.boolean().optional(),
});

export const opSchema = z.discriminatedUnion("type", [
  setHeaderOp,
  addFieldOp,
  addSectionOp,
  setThemeOp,
  replaceFieldOp,
  addPageBreakOp,
]);

export const formGenSchema = z.object({
  ops: z.array(opSchema),
});

export type SetHeaderOp = z.infer<typeof setHeaderOp>;
export type AddFieldOp = z.infer<typeof addFieldOp>;
export type AddSectionOp = z.infer<typeof addSectionOp>;
export type SetThemeOp = z.infer<typeof setThemeOp>;
export type ReplaceFieldOp = z.infer<typeof replaceFieldOp>;
export type AddPageBreakOp = z.infer<typeof addPageBreakOp>;
export type Op = z.infer<typeof opSchema>;
export type FormGenResult = z.infer<typeof formGenSchema>;

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
