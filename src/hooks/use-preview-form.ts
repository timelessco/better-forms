import { useMemo, useRef } from "react";
import { revalidateLogic, useAppForm } from "@/components/ui/tanstack-form";
import { useStepForm } from "@/contexts/step-form-context";
import {
  enqueueQuestionProgress,
  fireUpdateVisit,
  flushQuestionProgressBuffer,
} from "@/lib/analytics/track-client";
import {
  generateDefaultValuesFromFields,
  generateZodSchemaFromFields,
} from "@/lib/form-schema/generate-preview-schema";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { resolveQuestionFromFocus } from "@/lib/forms/extract-questions";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import { logger } from "@/lib/utils";
import { useDraftAutoSave } from "./use-draft-autosave";
import type { AppForm } from "./use-form-builder";

/** Tracks which visits have already fired `didStartForm: true`. Module-scope so
 * it survives re-renders and step changes within the same visit, but resets on
 * full page reload (which also produces a new visitId, so no double-fire). */
const didStartFiredVisits = new Set<string>();

interface UseStepPreviewFormOptions {
  fields: PlateFormField[];
  /** Pre-computed Questions in this Step (global indices, stepId, stepIndex).
   * Used by the per-Question `start` (on first focus) and `complete` (on
   * submit) analytics emitters. Omit / pass `[]` when tracking is disabled
   * (e.g. RSC-rendered preview, builder previews). */
  questions?: QuestionRef[];
  stepIndex: number;
  isLastStep: boolean;
  formName?: string;
}

/**
 * Creates a TanStack Form instance for a single step in a multi-step form.
 * Uses StepFormContext for navigation and data accumulation.
 */
export const useStepPreviewForm = ({
  fields,
  questions = [],
  stepIndex,
  isLastStep,
  formName = "stepPreviewForm",
}: UseStepPreviewFormOptions): {
  form: AppForm;
  formName: string;
  /** Form-level onFocus handler. Routes focus events to the per-Question
   * `start` emitter, deduped per `(visitId, questionId)` for the Visit. */
  handleFieldFocus: (event: React.FocusEvent<HTMLFormElement>) => void;
} => {
  const { formData, goToNextStep, submitForm, formId, tracking } = useStepForm();
  const { saveDraft } = useDraftAutoSave(formId);

  // Per-Question `start` dedup latch keyed by `${visitId}::${questionId}`.
  // Dedupes within a single Step mount. Cross-step idempotency is guaranteed
  // by the server upsert (coalesce on `startedAt`); `StepForm` is keyed on
  // `currentStep` and remounts on back-navigation, which resets this ref.
  const startFiredRef = useRef<Set<string>>(new Set());

  const validationSchema = useMemo(() => generateZodSchemaFromFields(fields), [fields]);

  // Lookup from Question id → ref. Keyed by the Plate Block id (the same
  // value rendered as `data-bf-question-id` on each Question wrapper), so
  // focus on any descendant — including field types that don't expose `name`
  // on the focusable element (Phone, MultiSelect, MultiChoice, Checkbox,
  // Date, FileUpload, Ranking) — resolves cleanly.
  const questionsById = useMemo<Map<string, QuestionRef>>(() => {
    const map = new Map<string, QuestionRef>();
    for (const q of questions) {
      map.set(q.questionId, q);
    }
    return map;
  }, [questions]);

  const defaultValues = useMemo(() => {
    const fieldDefaults = generateDefaultValuesFromFields(fields);
    // Merge context data (for when user goes back to previous step)
    const merged: Record<string, unknown> = { ...fieldDefaults };
    for (const field of fields) {
      if (field.name in formData) {
        merged[field.name] = formData[field.name];
      }
    }
    return merged;
  }, [fields, formData]);

  const handleFieldFocus = (event: React.FocusEvent<HTMLFormElement>): void => {
    if (!(tracking?.visitId && tracking.mode)) return;
    const q = resolveQuestionFromFocus(event.target as Element, questionsById);
    if (!q) return;

    const visitId = tracking.visitId;
    const key = `${visitId}::${q.questionId}`;
    if (!startFiredRef.current.has(key)) {
      startFiredRef.current.add(key);
      enqueueQuestionProgress({
        visitId,
        formId: tracking.formId,
        visitorHash: tracking.visitorHash,
        questionId: q.questionId,
        questionType: q.questionType,
        questionIndex: q.questionIndex,
        stepId: q.stepId,
        stepIndex: q.stepIndex,
        event: "start",
      });
    }
    if (!didStartFiredVisits.has(visitId)) {
      didStartFiredVisits.add(visitId);
      fireUpdateVisit({ visitId, didStartForm: true });
    }
  };

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: validationSchema,
      onDynamicAsyncDebounceMs: 300,
    },
    // Draft autosave: merge this step's current values with previously-captured
    // step data and persist as an in-progress submission. `onBlurDebounceMs`
    // collapses rapid tabbing through fields into a single save. The per-
    // Question `start` event lives on `handleFieldFocus` (on first focus),
    // not on blur — see ADR-0002.
    listeners: {
      onBlur: ({ formApi }) => {
        if (formId) {
          void saveDraft({
            values: { ...formData, ...formApi.state.values },
            lastStepReached: stepIndex,
          });
        }
      },
      onBlurDebounceMs: 1000,
    },
    onSubmit: async ({ value }) => {
      // Errors bubble to public-form-page, which renders an inline banner.
      // No toast here — keeps the published form's bundle free of sonner.
      logger(`Step ${stepIndex + 1} submitted with values:`, value);

      // Analytics: emit `complete` for every Question in this Step before
      // navigating. The last Question of the final Step carries the
      // `wasLastQuestion` flag so the funnel can identify terminal Questions.
      // Flush the buffer afterwards so the next Step's mount doesn't race
      // ahead of the prior Step's events.
      if (tracking?.visitId && tracking.mode && questions.length > 0) {
        const visitId = tracking.visitId;
        const lastIndex = questions.length - 1;
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          enqueueQuestionProgress({
            visitId,
            formId: tracking.formId,
            visitorHash: tracking.visitorHash,
            questionId: q.questionId,
            questionType: q.questionType,
            questionIndex: q.questionIndex,
            stepId: q.stepId,
            stepIndex: q.stepIndex,
            event: "complete",
            wasLastQuestion: isLastStep && i === lastIndex,
          });
        }
        flushQuestionProgressBuffer();
      }

      if (isLastStep) {
        await submitForm(value);
      } else {
        goToNextStep(value);
      }
    },
    canSubmitWhenInvalid: false,
    onSubmitInvalid({ formApi }) {
      try {
        const errorMap = formApi.state.errorMap.onDynamic;
        const inputs = Array.from(
          document.querySelectorAll(`#${formName} input`),
        ) as HTMLInputElement[];

        let firstInput: HTMLInputElement | undefined;
        for (const input of inputs) {
          if (errorMap?.[input.name]) {
            firstInput = input;
            break;
          }
        }
        firstInput?.focus();
      } catch {
        // ignore
      }
    },
  });

  return { form: form as unknown as AppForm, formName, handleFieldFocus };
};
