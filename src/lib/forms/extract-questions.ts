import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

/** Per-Question ref for analytics. Keyed by Plate Block `id` (NOT field `name`)
 * so rows join back to the source Block. */
export type QuestionRef = {
  questionId: string;
  questionType: string;
  questionIndex: number;
  stepId: string;
  stepIndex: number;
};

/** Questions for a step; `questionIndex` is 0-based across the WHOLE form, not
 * the step. Buttons excluded (nav, not Questions). Pure → analytics can memoise. */
export const extractQuestionsForStep = (
  steps: readonly PreviewSegment[][],
  stepIndex: number,
): QuestionRef[] => {
  if (stepIndex < 0 || stepIndex >= steps.length) return [];

  let globalIndex = 0;
  for (let s = 0; s < stepIndex; s++) {
    for (const seg of steps[s]) {
      if (seg.type === "field" && seg.field.fieldType !== "Button") {
        globalIndex++;
      }
    }
  }

  const stepId = `step_${stepIndex}`;
  const out: QuestionRef[] = [];
  for (const seg of steps[stepIndex]) {
    if (seg.type !== "field") continue;
    if (seg.field.fieldType === "Button") continue;
    out.push({
      questionId: seg.field.id,
      questionType: seg.field.fieldType,
      questionIndex: globalIndex,
      stepId,
      stepIndex,
    });
    globalIndex++;
  }
  return out;
};

/** {@link extractQuestionsForStep} for the RSC step shape
 * (`{ fields: PlateFormField[] }[]`) on the published-form path. */
export const extractQuestionsForStepRSC = (
  steps: readonly { fields: PlateFormField[] }[],
  stepIndex: number,
): QuestionRef[] => {
  if (stepIndex < 0 || stepIndex >= steps.length) return [];

  let globalIndex = 0;
  for (let s = 0; s < stepIndex; s++) {
    for (const field of steps[s].fields) {
      if (field.fieldType !== "Button") globalIndex++;
    }
  }

  const stepId = `step_${stepIndex}`;
  const out: QuestionRef[] = [];
  for (const field of steps[stepIndex].fields) {
    if (field.fieldType === "Button") continue;
    out.push({
      questionId: field.id,
      questionType: field.fieldType,
      questionIndex: globalIndex,
      stepId,
      stepIndex,
    });
    globalIndex++;
  }
  return out;
};

/** Focused element → its Question via nearest `[data-bf-question-id]` wrapper.
 * Works for fields whose focusable element has no `name` (Phone, MultiSelect,
 * Date, FileUpload, etc.). `null` if outside a wrapper or id not in the map. */
export const resolveQuestionFromFocus = (
  target: Element | null,
  questionsById: ReadonlyMap<string, QuestionRef>,
): QuestionRef | null => {
  if (!target) return null;
  const wrapper = target.closest("[data-bf-question-id]");
  const questionId = wrapper?.getAttribute("data-bf-question-id");
  if (!questionId) return null;
  return questionsById.get(questionId) ?? null;
};
