import type { OperatorId } from "./types";

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every((v) => isEmptyValue(v));
  // Matrix answers are a row→column record; `{}` (or all-empty rows) means unanswered.
  if (typeof value === "object") return Object.values(value).every((v) => isEmptyValue(v));
  return false;
};

const asString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

/** Pure predicate for one condition. Numeric comparisons coerce; bad numbers → false. */
export const applyOperator = (
  operator: OperatorId,
  answer: unknown,
  operand: string | undefined,
): boolean => {
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
      return asString(answer).includes(asString(operand));
    case "notContains":
      return !asString(answer).includes(asString(operand));
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
      const sa = asString(answer);
      const sb = asString(operand);
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
