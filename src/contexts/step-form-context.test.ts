import { describe, expect, it } from "vitest";
import { stepFormReducer } from "./step-form-context";

const base = {
  history: [0],
  direction: 0,
  formData: {},
  isSubmitting: false,
  isSubmitted: false,
};

describe("stepFormReducer history stack", () => {
  it("push-step appends the resolved target index and merges formData", () => {
    const next = stepFormReducer(base, { type: "push-step", target: 2, formData: { a: 1 } });
    expect(next.history).toEqual([0, 2]);
    expect(next.direction).toBe(1);
    expect(next.formData).toEqual({ a: 1 });
  });

  it("prev-step pops to the previously visited step (origin, not current-1)", () => {
    const state = { ...base, history: [0, 2, 3] };
    const next = stepFormReducer(state, { type: "prev-step" });
    expect(next.history).toEqual([0, 2]);
    expect(next.direction).toBe(-1);
  });

  it("prev-step at the first step is a no-op", () => {
    expect(stepFormReducer(base, { type: "prev-step" })).toBe(base);
  });

  it("reset returns to a single-entry history", () => {
    const state = { ...base, history: [0, 1, 2], isSubmitted: true };
    expect(stepFormReducer(state, { type: "reset" }).history).toEqual([0]);
  });
});
