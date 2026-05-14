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

// `required` is owned by the input node. The editor's LabelRequiredBadge
// toggles it on the next-sibling input from the formLabel, and the preview
// and validation must read from the same source so the two stay in sync.
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
};

/**
 * `formNumber` stores numeric bounds on the node as `minValue` / `maxValue`
 * (distinct from text fields' `minLength` / `maxLength` character counts) plus
 * an `allowDecimals` flag. Surface them so both the published form and the
 * preview schema can enforce the same limits.
 */
export const extractNumberFields = (
  node: Record<string, unknown>,
): { min?: number; max?: number; allowDecimals?: boolean } => ({
  min: node.minValue as number | undefined,
  max: node.maxValue as number | undefined,
  allowDecimals: node.allowDecimals as boolean | undefined,
});
