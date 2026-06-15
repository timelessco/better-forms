import type { OperatorId } from "./types";

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  // Consent/toggle: an unchecked boolean (false) is "empty"; checked (true) is filled.
  if (typeof value === "boolean") return value === false;
  if (Array.isArray(value)) return value.every((v) => isEmptyValue(v));
  // Matrix answers are a row→column record; `{}` (or all-empty rows) means unanswered.
  if (typeof value === "object") return Object.values(value).every((v) => isEmptyValue(v));
  return false;
};

/** Coerce an answer to a comparison string: arrays join with ", ", nullish → "". */
export const asString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

/** Operand-requiring operators are a no-op when the author left the operand blank. */
const OPERATORS_NEEDING_OPERAND = new Set<OperatorId>([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "greaterThan",
  "lessThan",
  "greaterThanOrEqual",
  "lessThanOrEqual",
]);

/** Membership test for array (multi-select) answers — whole-element match, never substring. */
const arrayContains = (answer: unknown[], operand: string | undefined): boolean =>
  answer.map((v) => asString(v)).includes(asString(operand));

/** Pad an unpadded `H:MM` time to `HH:MM` so lexicographic order is chronological. */
const normalizeForCompare = (s: string): string => (/^\d:\d{2}$/.test(s) ? `0${s}` : s);

/** Pure predicate for one condition. Numeric comparisons coerce; bad numbers → false. */
export const applyOperator = (
  operator: OperatorId,
  answer: unknown,
  operand: string | undefined,
): boolean => {
  // Incomplete condition (blank operand) on an operand-requiring operator never matches.
  if (OPERATORS_NEEDING_OPERAND.has(operator) && (operand === undefined || operand === "")) {
    return false;
  }
  switch (operator) {
    case "isEmpty":
      return isEmptyValue(answer);
    case "isNotEmpty":
      return !isEmptyValue(answer);
    case "equals":
      return asString(answer) === asString(operand);
    case "notEquals":
      return asString(answer) !== asString(operand);
    case "contains":
      return Array.isArray(answer)
        ? arrayContains(answer, operand)
        : asString(answer).includes(asString(operand));
    case "notContains":
      return Array.isArray(answer)
        ? !arrayContains(answer, operand)
        : !asString(answer).includes(asString(operand));
    case "greaterThan":
    case "lessThan":
    case "greaterThanOrEqual":
    case "lessThanOrEqual": {
      // Empty answer is non-comparable — don't let Number("") === 0 fire threshold rules.
      if (isEmptyValue(answer)) return false;
      const a = Number(asString(answer));
      const b = Number(operand);
      const aIsNum = !Number.isNaN(a);
      const bIsNum = !Number.isNaN(b);
      // Both numeric → numeric compare. Both non-numeric → lexicographic, which is
      // chronological for ISO dates (YYYY-MM-DD) and zero-padded times (HH:MM).
      // A numeric/non-numeric mismatch is non-comparable → false.
      if (aIsNum !== bIsNum) return false;
      const sa = normalizeForCompare(asString(answer));
      const sb = normalizeForCompare(asString(operand));
      switch (operator) {
        case "greaterThan":
          return aIsNum ? a > b : sa > sb;
        case "lessThan":
          return aIsNum ? a < b : sa < sb;
        case "greaterThanOrEqual":
          return aIsNum ? a >= b : sa >= sb;
        default:
          return aIsNum ? a <= b : sa <= sb;
      }
    }
    default:
      return false;
  }
};
