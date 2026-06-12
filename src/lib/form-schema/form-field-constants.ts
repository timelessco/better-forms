import type {
  DecimalSeparator,
  NumberFormatType,
  ThousandsSeparator,
} from "@/lib/form-schema/number-format";

/** Node types that are form inputs (the actual field elements) */
export const FORM_INPUT_NODE_TYPES = new Set([
  "formInput",
  "formTextarea",
  "formEmail",
  "formPhone",
  "formNumber",
  "formLink",
  "formDate",
  "formTime",
  "formFileUpload",
  "formOptionItem",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

/** Node types allowed as labels (preceding sibling of a form input) */
export const ALLOWED_LABEL_TYPES = new Set(["formLabel", "p", "h1", "h2", "h3", "blockquote"]);

/** Map from input node type to PlateFormField fieldType string */
export const INPUT_TYPE_TO_FIELD_TYPE: Record<string, string> = {
  formInput: "Input",
  formTextarea: "Textarea",
  formEmail: "Email",
  formPhone: "Phone",
  formNumber: "Number",
  formLink: "Link",
  formDate: "Date",
  formTime: "Time",
  formFileUpload: "FileUpload",
  formLinearScale: "LinearScale",
  formRating: "Rating",
  formSignature: "Signature",
};

/** Linear scale defaults on insert (NPS-style 1–10, step 1). */
export const LINEAR_SCALE_DEFAULTS = { min: 1, max: 10, step: 1 } as const;

/** Bounds the Scale / Scale-step menu sliders allow. */
export const LINEAR_SCALE_BOUNDS = { min: -10, max: 10, stepMin: 1, stepMax: 10 } as const;

/** Hard cap on rendered scale points — guards against a tiny step over a wide range. */
const LINEAR_SCALE_MAX_POINTS = 100;

/** Scale points: each tile = step × index, for the integer indices Start→End (the i=0 baseline
 * is dropped). So Start 0 / End 10 → step 1 ⇒ 1…10, step 2 ⇒ 2,4,…,20, step 10 ⇒ 10,20,…,100. */
export const buildScaleValues = (min: number, max: number, step: number): number[] => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const s = step > 0 ? step : 1;
  const values: number[] = [];
  for (let i = lo; i <= hi && values.length < LINEAR_SCALE_MAX_POINTS; i += 1) {
    if (i === 0) continue; // a zero tile is 0 regardless of step — skip the baseline
    // Round off any float drift to a clean label.
    values.push(Math.round(i * s * 1e6) / 1e6);
  }
  return values;
};

// `required` lives on the input node (LabelRequiredBadge toggles the next-sibling
// input). Preview + validation read the same source to stay in sync.
export const resolveRequired = (
  inputNode: Record<string, unknown>,
  _labelNode: Record<string, unknown> | null,
): boolean => Boolean(inputNode.required);

/** Map from formOptionItem variant to PlateFormField fieldType string. Dropdown / Multi-select
 * are display modes now (`showAsDropdown` on the group's first node), not variants. */
export const VARIANT_TO_FIELD_TYPE: Record<string, string> = {
  checkbox: "Checkbox",
  multiChoice: "MultiChoice",
  ranking: "Ranking",
};

/** `formNumber` bounds: `minValue`/`maxValue` (not text's `minLength`/`maxLength`
 * char counts) + `allowDecimals`, plus the "Format" display config. Surfaced so
 * the published form, preview, and submissions table all render the same way. */
export const extractNumberFields = (
  node: Record<string, unknown>,
): {
  min?: number;
  max?: number;
  allowDecimals?: boolean;
  numberFormat?: NumberFormatType;
  decimalSeparator?: DecimalSeparator;
  thousandsSeparator?: ThousandsSeparator;
} => ({
  min: node.minValue as number | undefined,
  max: node.maxValue as number | undefined,
  allowDecimals: node.allowDecimals as boolean | undefined,
  numberFormat: node.numberFormat as NumberFormatType | undefined,
  decimalSeparator: node.decimalSeparator as DecimalSeparator | undefined,
  thousandsSeparator: node.thousandsSeparator as ThousandsSeparator | undefined,
});

/** Star-rating defaults on insert (5 stars). */
export const RATING_DEFAULTS = { starCount: 5 } as const;

/** Max stars the "Stars count" stepper allows. */
export const RATING_MAX_STARS = 10;

/** `formRating` settings live on the node (`starCount`); fall back to the default,
 * clamped to 1…RATING_MAX_STARS so a stray value can't render an absurd star row. */
export const extractRatingFields = (node: Record<string, unknown>): { starCount: number } => {
  const raw = node.starCount;
  const n = typeof raw === "number" && raw > 0 ? Math.floor(raw) : RATING_DEFAULTS.starCount;
  return { starCount: Math.min(RATING_MAX_STARS, Math.max(1, n)) };
};

/** A matrix row or column as stored on the `formMatrix` node — stable `id` keys
 * the answer record (survives label edits); `label` is the visible text. */
export interface MatrixEntry {
  id: string;
  label: string;
}

/** Matrix grid seed on insert — 3 rows × 3 columns, single-select per row. */
export const MATRIX_DEFAULTS = {
  rows: ["Row 1", "Row 2", "Row 3"],
  columns: ["Column 1", "Column 2", "Column 3"],
} as const;

/** Hard caps for the matrix editor's add-row / add-column affordances. */
export const MATRIX_MAX = { rows: 50, columns: 20 } as const;

/** `formLinearScale` settings live on the node (`scaleMin`/`scaleMax`/`scaleStep`);
 * fall back to the NPS defaults so a freshly inserted field renders 1–10. */
export const extractLinearScaleFields = (
  node: Record<string, unknown>,
): { min: number; max: number; step: number } => {
  const min = typeof node.scaleMin === "number" ? node.scaleMin : LINEAR_SCALE_DEFAULTS.min;
  const max = typeof node.scaleMax === "number" ? node.scaleMax : LINEAR_SCALE_DEFAULTS.max;
  const rawStep = node.scaleStep;
  const step = typeof rawStep === "number" && rawStep > 0 ? rawStep : LINEAR_SCALE_DEFAULTS.step;
  return { min, max, step };
};
