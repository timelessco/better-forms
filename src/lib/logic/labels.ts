/** Operator labels + per-field-type operator matrix for the IF/THEN authoring UI.
 * Pure — no framework imports. */
import type { OperatorId } from "./types";

export const OPERATOR_LABELS: Record<OperatorId, string> = {
  equals: "is",
  notEquals: "is not",
  contains: "contains",
  notContains: "does not contain",
  greaterThan: "greater than",
  lessThan: "less than",
  greaterThanOrEqual: "≥",
  lessThanOrEqual: "≤",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const OPERATORS_WITHOUT_OPERAND = new Set<OperatorId>(["isEmpty", "isNotEmpty"]);

export const operatorNeedsOperand = (op: OperatorId): boolean => !OPERATORS_WITHOUT_OPERAND.has(op);

/** Operators offered per field type in the authoring UI. */
const OPERATORS_BY_FIELD_TYPE: Record<string, OperatorId[]> = {
  // text-like
  Input: ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"],
  Textarea: ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"],
  Email: ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"],
  Link: ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"],
  Phone: ["equals", "notEquals", "contains", "notContains", "isEmpty", "isNotEmpty"],
  // numeric / temporal — add comparisons
  Number: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "isEmpty",
    "isNotEmpty",
  ],
  Date: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "isEmpty",
    "isNotEmpty",
  ],
  Time: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "isEmpty",
    "isNotEmpty",
  ],
  // single choice (radio or dropdown display) — one value
  MultiChoice: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  // linear scale / rating — one numeric value; offer comparisons like Number
  LinearScale: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "isEmpty",
    "isNotEmpty",
  ],
  Rating: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "isEmpty",
    "isNotEmpty",
  ],
  // multi-value (arrays) — `contains` checks membership; `equals` would compare a
  // joined string, so it's omitted to avoid misleading authors.
  Checkbox: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  Ranking: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  // file upload / signature — only presence checks are meaningful
  FileUpload: ["isEmpty", "isNotEmpty"],
  Signature: ["isEmpty", "isNotEmpty"],
  // matrix — answer is a row→column record; only presence checks are meaningful
  Matrix: ["isEmpty", "isNotEmpty"],
};

const DEFAULT_OPERATORS: OperatorId[] = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "isEmpty",
  "isNotEmpty",
];

export const operatorsForFieldType = (fieldType: string | undefined): OperatorId[] =>
  (fieldType && OPERATORS_BY_FIELD_TYPE[fieldType]) || DEFAULT_OPERATORS;
