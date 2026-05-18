import { describe, expect, it } from "vitest";
import { rollupToSteps } from "@/lib/analytics/step-rollup";
import type { QuestionDropoffRow } from "@/types/analytics";

const makeQuestion = (
  overrides: Partial<QuestionDropoffRow> & { questionId: string },
): QuestionDropoffRow => ({
  questionIndex: 0,
  questionLabel: undefined,
  stepId: "step_0",
  stepIndex: 0,
  viewCount: 0,
  startCount: 0,
  completeCount: 0,
  dropoffCount: 0,
  terminalDropoffCount: 0,
  dropoffRate: 0,
  completionRate: 0,
  ...overrides,
});

describe("rollupToSteps", () => {
  it("returns empty array for empty input", () => {
    expect(rollupToSteps([])).toEqual([]);
  });

  it("rolls up two questions in the same step into one step row with summed counts", () => {
    const questions: QuestionDropoffRow[] = [
      makeQuestion({
        questionId: "q1",
        questionIndex: 0,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 100,
        startCount: 80,
        completeCount: 70,
        dropoffCount: 30,
        terminalDropoffCount: 5,
      }),
      makeQuestion({
        questionId: "q2",
        questionIndex: 1,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 70,
        startCount: 60,
        completeCount: 50,
        dropoffCount: 20,
        terminalDropoffCount: 3,
      }),
    ];

    const result = rollupToSteps(questions);

    expect(result).toHaveLength(1);
    const [step] = result;
    expect(step.stepId).toBe("step_0");
    expect(step.stepIndex).toBe(0);
    expect(step.viewCount).toBe(170);
    expect(step.startCount).toBe(140);
    expect(step.completeCount).toBe(120);
    expect(step.dropoffCount).toBe(50);
    expect(step.terminalDropoffCount).toBe(8);
    // dropoffRate = round((50 / 170) * 100) = 29
    expect(step.dropoffRate).toBe(29);
    // completionRate = round((120 / 170) * 100) = 71
    expect(step.completionRate).toBe(71);
    expect(step.questions.map((q) => q.questionId)).toEqual(["q1", "q2"]);
  });

  it("rolls up three questions across two steps and orders by stepIndex", () => {
    const questions: QuestionDropoffRow[] = [
      // Intentionally out of order: step_1 first, then step_0.
      makeQuestion({
        questionId: "q3",
        questionIndex: 2,
        stepId: "step_1",
        stepIndex: 1,
        viewCount: 50,
        completeCount: 40,
      }),
      makeQuestion({
        questionId: "q1",
        questionIndex: 0,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 100,
        completeCount: 90,
      }),
      makeQuestion({
        questionId: "q2",
        questionIndex: 1,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 90,
        completeCount: 80,
      }),
    ];

    const result = rollupToSteps(questions);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.stepId)).toEqual(["step_0", "step_1"]);
    expect(result[0].viewCount).toBe(190);
    expect(result[0].completeCount).toBe(170);
    expect(result[0].questions.map((q) => q.questionId)).toEqual(["q1", "q2"]);
    expect(result[1].viewCount).toBe(50);
    expect(result[1].questions.map((q) => q.questionId)).toEqual(["q3"]);
  });

  it("skips rows with null stepId (legacy pre-cut data)", () => {
    const questions: QuestionDropoffRow[] = [
      makeQuestion({
        questionId: "legacy",
        questionIndex: 0,
        stepId: null,
        stepIndex: null,
        viewCount: 999,
      }),
      makeQuestion({
        questionId: "q1",
        questionIndex: 0,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 10,
      }),
    ];

    const result = rollupToSteps(questions);

    expect(result).toHaveLength(1);
    expect(result[0].stepId).toBe("step_0");
    expect(result[0].viewCount).toBe(10);
  });

  it("returns null rates when a step has zero views", () => {
    const questions: QuestionDropoffRow[] = [
      makeQuestion({
        questionId: "q1",
        questionIndex: 0,
        stepId: "step_0",
        stepIndex: 0,
        viewCount: 0,
        completeCount: 0,
        dropoffCount: 0,
      }),
    ];

    const result = rollupToSteps(questions);

    expect(result).toHaveLength(1);
    expect(result[0].dropoffRate).toBeNull();
    expect(result[0].completionRate).toBeNull();
  });
});
