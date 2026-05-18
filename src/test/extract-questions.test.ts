import { describe, expect, it } from "vitest";
import { extractQuestionsForStep } from "@/lib/forms/extract-questions";
import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

const field = (id: string, fieldType: PlateFormField["fieldType"]): PreviewSegment => ({
  type: "field",
  field: { id, name: id, fieldType } as PlateFormField,
});

const stat: PreviewSegment = { type: "static", nodes: [] };

describe("extractQuestionsForStep", () => {
  it("returns the Questions in the requested Step with global questionIndex", () => {
    const steps: PreviewSegment[][] = [
      [field("q1", "Input"), field("q2", "Textarea")],
      [stat, field("q3", "Email"), field("q4", "Phone")],
    ];
    const step0 = extractQuestionsForStep(steps, 0);
    expect(step0).toEqual([
      { questionId: "q1", questionType: "Input", questionIndex: 0, stepId: "step_0", stepIndex: 0 },
      {
        questionId: "q2",
        questionType: "Textarea",
        questionIndex: 1,
        stepId: "step_0",
        stepIndex: 0,
      },
    ]);
    const step1 = extractQuestionsForStep(steps, 1);
    expect(step1).toEqual([
      { questionId: "q3", questionType: "Email", questionIndex: 2, stepId: "step_1", stepIndex: 1 },
      { questionId: "q4", questionType: "Phone", questionIndex: 3, stepId: "step_1", stepIndex: 1 },
    ]);
  });

  it("excludes Button fields from the Question list and from the global index", () => {
    const steps: PreviewSegment[][] = [
      [
        field("q1", "Input"),
        { type: "field", field: { id: "b1", name: "b1", fieldType: "Button", buttonRole: "next" } },
      ],
      [field("q2", "Input")],
    ];
    expect(extractQuestionsForStep(steps, 0)).toEqual([
      { questionId: "q1", questionType: "Input", questionIndex: 0, stepId: "step_0", stepIndex: 0 },
    ]);
    expect(extractQuestionsForStep(steps, 1)).toEqual([
      { questionId: "q2", questionType: "Input", questionIndex: 1, stepId: "step_1", stepIndex: 1 },
    ]);
  });

  it("returns [] for out-of-range stepIndex", () => {
    const steps: PreviewSegment[][] = [[field("q1", "Input")]];
    expect(extractQuestionsForStep(steps, -1)).toEqual([]);
    expect(extractQuestionsForStep(steps, 5)).toEqual([]);
  });
});
