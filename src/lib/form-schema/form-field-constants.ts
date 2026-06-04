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
  "formMultiSelectInput",
  "formOptionItem",
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
};

// `required` lives on the input node (LabelRequiredBadge toggles the next-sibling
// input). Preview + validation read the same source to stay in sync.
export const resolveRequired = (
  inputNode: Record<string, unknown>,
  _labelNode: Record<string, unknown> | null,
): boolean => Boolean(inputNode.required);

/** Map from formOptionItem variant to PlateFormField fieldType string */
export const VARIANT_TO_FIELD_TYPE: Record<string, string> = {
  checkbox: "Checkbox",
  multiChoice: "MultiChoice",
  multiSelect: "MultiSelect",
  ranking: "Ranking",
  dropdown: "Dropdown",
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
