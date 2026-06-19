import { describe, expect, it } from "vitest";
import { buildScaleValues, resolveRequired } from "@/lib/form-schema/form-field-constants";

describe("buildScaleValues", () => {
  it("normal scale min 1, max 5, step 1 → [1,2,3,4,5]", () => {
    expect(buildScaleValues(1, 5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it("drops the i=0 baseline tile (Start 0 / End 10, step 1 ⇒ 1…10)", () => {
    expect(buildScaleValues(0, 10, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("scales each tile by step (Start 0 / End 10, step 2 ⇒ 2,4,…,20)", () => {
    expect(buildScaleValues(0, 10, 2)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  });

  it("step 10 over 0…10 ⇒ 10,20,…,100", () => {
    expect(buildScaleValues(0, 10, 10)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("min > max swaps the bounds (5,1) → same as (1,5)", () => {
    expect(buildScaleValues(5, 1, 1)).toEqual(buildScaleValues(1, 5, 1));
    expect(buildScaleValues(5, 1, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it("step = 0 is coerced to step 1", () => {
    expect(buildScaleValues(1, 5, 0)).toEqual([1, 2, 3, 4, 5]);
  });

  it("negative step is coerced to step 1", () => {
    expect(buildScaleValues(1, 5, -3)).toEqual([1, 2, 3, 4, 5]);
  });

  it("negative range works and still skips 0 (e.g. -3…3, step 1)", () => {
    expect(buildScaleValues(-3, 3, 1)).toEqual([-3, -2, -1, 1, 2, 3]);
  });

  it("guard caps runaway point counts at 100", () => {
    // Range of 10000 indices would explode without the LINEAR_SCALE_MAX_POINTS guard.
    const values = buildScaleValues(1, 10000, 1);
    expect(values).toHaveLength(100);
    expect(values[0]).toBe(1);
    expect(values[99]).toBe(100);
  });

  it("guard counts indices, not values — a large step still yields ≤100 points", () => {
    const values = buildScaleValues(1, 500, 7);
    expect(values).toHaveLength(100);
    expect(values[0]).toBe(7); // 1 * 7
  });

  it("rounds float drift to clean labels", () => {
    // 0.1 step is not exactly representable; values must be rounded, not 0.30000000000000004.
    expect(buildScaleValues(1, 3, 0.1)).toEqual([0.1, 0.2, 0.3]);
  });

  it("min === max yields a single non-zero tile", () => {
    expect(buildScaleValues(4, 4, 1)).toEqual([4]);
  });

  it("min === max === 0 yields an empty list (the only tile is the dropped baseline)", () => {
    expect(buildScaleValues(0, 0, 1)).toEqual([]);
  });
});

describe("resolveRequired", () => {
  it.each([
    [{ required: true }, true],
    [{ required: false }, false],
    [{}, false],
    [{ required: 1 }, true],
    [{ required: 0 }, false],
    [{ required: "" }, false],
    [{ required: "yes" }, true],
    [{ required: null }, false],
    [{ required: undefined }, false],
  ])("inputNode %o → %s", (inputNode, expected) => {
    expect(resolveRequired(inputNode as Record<string, unknown>, null)).toBe(expected);
  });

  it("ignores the label node entirely", () => {
    expect(resolveRequired({ required: true }, { required: false })).toBe(true);
    expect(resolveRequired({ required: false }, { required: true })).toBe(false);
  });
});
