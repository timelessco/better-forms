import { describe, expect, it } from "vitest";
import { applyOperator } from "./operators";

describe("applyOperator", () => {
  it("equals / notEquals compare as strings", () => {
    expect(applyOperator("equals", "Germany", "Germany")).toBe(true);
    expect(applyOperator("equals", "Germany", "France")).toBe(false);
    expect(applyOperator("notEquals", "Germany", "France")).toBe(true);
  });

  it("contains / notContains do substring match", () => {
    expect(applyOperator("contains", "hello world", "world")).toBe(true);
    expect(applyOperator("contains", "hello", "z")).toBe(false);
    expect(applyOperator("notContains", "hello", "z")).toBe(true);
  });

  it("numeric comparisons coerce both sides", () => {
    expect(applyOperator("greaterThan", "10", "5")).toBe(true);
    expect(applyOperator("greaterThan", "5", "10")).toBe(false);
    expect(applyOperator("lessThan", "5", "10")).toBe(true);
    expect(applyOperator("greaterThanOrEqual", "5", "5")).toBe(true);
    expect(applyOperator("lessThanOrEqual", "5", "5")).toBe(true);
  });

  it("non-numeric input fails numeric comparisons", () => {
    expect(applyOperator("greaterThan", "abc", "5")).toBe(false);
  });

  it("isEmpty / isNotEmpty handle null, empty string, and empty arrays", () => {
    expect(applyOperator("isEmpty", "", undefined)).toBe(true);
    expect(applyOperator("isEmpty", null, undefined)).toBe(true);
    expect(applyOperator("isEmpty", undefined, undefined)).toBe(true);
    expect(applyOperator("isEmpty", [], undefined)).toBe(true);
    expect(applyOperator("isEmpty", ["", ""], undefined)).toBe(true);
    expect(applyOperator("isEmpty", "x", undefined)).toBe(false);
    expect(applyOperator("isNotEmpty", "x", undefined)).toBe(true);
    expect(applyOperator("isNotEmpty", ["a"], undefined)).toBe(true);
  });

  it("compares ISO dates and times chronologically via lexicographic fallback", () => {
    expect(applyOperator("greaterThan", "2026-06-01", "2026-01-01")).toBe(true);
    expect(applyOperator("lessThan", "2026-01-01", "2026-06-01")).toBe(true);
    expect(applyOperator("greaterThanOrEqual", "2026-06-01", "2026-06-01")).toBe(true);
    expect(applyOperator("greaterThan", "14:30", "09:15")).toBe(true);
    expect(applyOperator("lessThan", "09:15", "14:30")).toBe(true);
  });

  it("empty answers are non-comparable in numeric operators (not coerced to 0)", () => {
    expect(applyOperator("greaterThanOrEqual", "", "0")).toBe(false);
    expect(applyOperator("lessThan", undefined, "5")).toBe(false);
    expect(applyOperator("greaterThan", "   ", "-1")).toBe(false);
    expect(applyOperator("lessThanOrEqual", null, "10")).toBe(false);
    // a real zero still compares
    expect(applyOperator("greaterThanOrEqual", "0", "0")).toBe(true);
  });

  it("treats Matrix object answers (row→column record) as empty/filled correctly", () => {
    // Unanswered matrix is `{}`; partially-answered rows seed `[]`.
    expect(applyOperator("isEmpty", {}, undefined)).toBe(true);
    expect(applyOperator("isEmpty", { row1: [] }, undefined)).toBe(true);
    expect(applyOperator("isEmpty", { row1: "" }, undefined)).toBe(true);
    expect(applyOperator("isNotEmpty", {}, undefined)).toBe(false);
    // Any answered cell makes it non-empty.
    expect(applyOperator("isNotEmpty", { row1: "col2" }, undefined)).toBe(true);
    expect(applyOperator("isNotEmpty", { row1: ["col2"] }, undefined)).toBe(true);
    expect(applyOperator("isEmpty", { row1: "col2" }, undefined)).toBe(false);
  });

  it("matches multi-select array answers via contains (membership)", () => {
    // Checkbox/MultiSelect/Ranking answers are arrays of the selected option values.
    expect(applyOperator("contains", ["red", "blue"], "blue")).toBe(true);
    expect(applyOperator("contains", ["red", "blue"], "green")).toBe(false);
    expect(applyOperator("notContains", ["red", "blue"], "green")).toBe(true);
    expect(applyOperator("isEmpty", [], undefined)).toBe(true);
  });

  it("compares single-choice and numeric scale/rating answers as scalars", () => {
    // Single option / dropdown answers are the chosen option string.
    expect(applyOperator("equals", "Premium", "Premium")).toBe(true);
    expect(applyOperator("notEquals", "Basic", "Premium")).toBe(true);
    // LinearScale / Rating answers are numeric strings → numeric comparisons.
    expect(applyOperator("greaterThanOrEqual", "4", "3")).toBe(true);
    expect(applyOperator("lessThan", "2", "3")).toBe(true);
    expect(applyOperator("equals", "5", "5")).toBe(true);
  });
});
