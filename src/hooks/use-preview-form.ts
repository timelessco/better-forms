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

/** Visits that already fired `didStartForm: true`. Module-scope survives re-renders/step changes; resets on reload (new visitId, no double-fire). */
const didStartFiredVisits = new Set<string>();

interface UseStepPreviewFormOptions {
  fields: PlateFormField[];
  /** Questions in this Step for per-Question start/complete analytics. Pass `[]` to disable tracking (RSC/builder previews). */
  questions?: QuestionRef[];
  stepIndex: number;
  isLastStep: boolean;
  formName?: string;
}

/** TanStack Form instance for one step of a multi-step form. Navigation + data accumulation via StepFormContext. */
export const useStepPreviewForm = ({
  fields,
  questions = [],
  stepIndex,
  isLastStep,
  formName = "stepPreviewForm",
}: UseStepPreviewFormOptions): {
  form: AppForm;
  formName: string;
  /** Form-level onFocus → per-Question `start` emitter, deduped per (visitId, questionId). */
  handleFieldFocus: (event: React.FocusEvent<HTMLFormElement>) => void;
} => {
  const { formData, goToNextStep, submitForm, formId, tracking } = useStepForm();
  const { saveDraft } = useDraftAutoSave(formId);

  // `start` dedup latch keyed `visitId::questionId`, per Step mount. Cross-step idempotency via server upsert (coalesce on startedAt); StepForm remounts on back-nav, resetting this.
  const startFiredRef = useRef<Set<string>>(new Set());

  const validationSchema = useMemo(() => generateZodSchemaFromFields(fields), [fields]);

  // Question id → ref, keyed by Plate Block id (= data-bf-question-id), so focus on any descendant resolves even for fields without `name` (Phone, MultiSelect, etc.).
  const questionsById = useMemo<Map<string, QuestionRef>>(() => {
    const map = new Map<string, QuestionRef>();
    for (const q of questions) {
      map.set(q.questionId, q);
    }
    return map;
  }, [questions]);

  const defaultValues = useMemo(() => {
    const fieldDefaults = generateDefaultValuesFromFields(fields);
    // Merge context data — for back-nav to previous step.
    const merged: Record<string, unknown> = { ...fieldDefaults };
    for (const field of fields) {
      if (!(field.name in formData)) continue;
      const persisted = formData[field.name];
      // For repeatable fields, pad short persisted arrays up to the
      // editor-configured `initialRows` minimum. Without this, a creator
      // bumping `initialRows` from 1 → 4 wouldn't see 4 rows in preview if
      // localStorage already holds 2 values from a prior Next-click.
      if ("isFieldArray" in field && field.isFieldArray === true && Array.isArray(persisted)) {
        const rawRows = "initialRows" in field ? field.initialRows : undefined;
        const minRows = typeof rawRows === "number" && rawRows > 0 ? Math.floor(rawRows) : 1;
        if (persisted.length < minRows) {
          const seed = "defaultValue" in field && field.defaultValue ? field.defaultValue : "";
          merged[field.name] = [
            ...persisted,
            ...Array.from({ length: minRows - persisted.length }, () => seed),
          ];
          continue;
        }
      }
      merged[field.name] = persisted;
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
    // Draft autosave: merge step values into in-progress submission. Two
    // triggers, both debounced to keep write volume sane:
    //   - onBlur: covers tab-out / close-without-typing for typed inputs
    //     (`start` event lives on focus, not blur — see ADR-0002);
    //   - onChange: covers value changes that don't blur an input, notably
    //     `pushValue`/`removeValue` on repeatable array fields — otherwise an
    //     empty added row would be dropped on the next mount.
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
      onChange: ({ formApi }) => {
        if (formId) {
          void saveDraft({
            values: { ...formData, ...formApi.state.values },
            lastStepReached: stepIndex,
          });
        }
      },
      onChangeDebounceMs: 1000,
    },
    onSubmit: async ({ value }) => {
      // Errors bubble to public-form-page (inline banner); no toast — keeps published bundle sonner-free.
      logger(`Step ${stepIndex + 1} submitted with values:`, value);

      // Emit `complete` for every Question before nav; last Question of final Step gets wasLastQuestion (funnel terminal). Flush after so next Step's mount doesn't race ahead.
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
