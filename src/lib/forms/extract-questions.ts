import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

/**
 * Lightweight per-Question reference used by analytics emitters. Each
 * Question is identified by the Plate Block's `id` (NOT the form-field
 * `name`), so the analytics rows can be joined back to the source Block.
 */
export type QuestionRef = {
  questionId: string;
  questionType: string;
  questionIndex: number;
  stepId: string;
  stepIndex: number;
};

/**
 * Walks a flattened step layout and returns the Questions for the requested
 * Step, each carrying its 0-based index across the WHOLE Form (not within
 * the Step). Button fields are excluded — they're navigation controls, not
 * Questions a Respondent answers.
 *
 * Pure function so the analytics path can memoise per-step results instead
 * of re-walking the Plate tree on every render.
 */
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

/**
 * Variant of {@link extractQuestionsForStep} that walks the RSC step shape
 * (`{ fields: PlateFormField[] }[]`) used by the published-form code path.
 */
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

/**
 * Resolves a focused DOM element back to its Question by walking up to the
 * nearest `[data-bf-question-id]` wrapper. Uniform across field types,
 * including those whose focusable element doesn't carry a `name` attribute
 * (Phone, MultiSelect, MultiChoice, Checkbox, Date, FileUpload, Ranking).
 *
 * Returns `null` if the target is outside any Question wrapper or its
 * question id isn't in the lookup map.
 */
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
