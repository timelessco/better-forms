import { useMemo, useRef } from "react";
import { revalidateLogic, useAppForm } from "@/components/ui/tanstack-form";
import { useStepForm } from "@/contexts/step-form-context";
import { fireQuestionProgress, fireUpdateVisit } from "@/lib/analytics/track-client";
import {
  generateDefaultValuesFromFields,
  generateZodSchemaFromFields,
} from "@/lib/form-schema/generate-preview-schema";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { logger } from "@/lib/utils";
import { useDraftAutoSave } from "./use-draft-autosave";
import type { AppForm } from "./use-form-builder";

/** Tracks which visits have already fired `didStartForm: true`. Module-scope so
 * it survives re-renders and step changes within the same visit, but resets on
 * full page reload (which also produces a new visitId, so no double-fire). */
const didStartFiredVisits = new Set<string>();

interface UseStepPreviewFormOptions {
  fields: PlateFormField[];
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
  stepIndex,
  isLastStep,
  formName = "stepPreviewForm",
}: UseStepPreviewFormOptions): {
  form: AppForm;
  formName: string;
} => {
  const { formData, goToNextStep, submitForm, formId, tracking } = useStepForm();
  const { saveDraft } = useDraftAutoSave(formId);

  // `start` event is fired on the first blur per step. Reset the latch when
  // the active step changes so the next step gets its own start event.
  const hasStartedRef = useRef<{ stepIndex: number; fired: boolean }>({
    stepIndex: -1,
    fired: false,
  });
  if (hasStartedRef.current.stepIndex !== stepIndex) {
    hasStartedRef.current = { stepIndex, fired: false };
  }

  const validationSchema = useMemo(() => generateZodSchemaFromFields(fields), [fields]);

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

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: validationSchema,
      onDynamicAsyncDebounceMs: 300,
    },
    // Draft autosave: merge this step's current values with previously-captured
    // step data and persist as an in-progress submission. `onBlurDebounceMs`
    // collapses rapid tabbing through fields into a single save.
    listeners: {
      onBlur: ({ formApi }) => {
        if (formId) {
          void saveDraft({
            values: { ...formData, ...formApi.state.values },
            lastStepReached: stepIndex,
          });
        }

        // Analytics: first blur per step → `start`; first blur per visit →
        // `didStartForm: true`. No-ops when tracking is disabled / pending.
        if (tracking?.visitId && tracking.mode) {
          if (!hasStartedRef.current.fired) {
            hasStartedRef.current.fired = true;
            const isFieldByField = tracking.mode === "field-by-field";
            const firstField = fields.length > 0 ? fields[0] : null;
            const questionId = isFieldByField && firstField ? firstField.id : `step_${stepIndex}`;
            const questionType =
              isFieldByField && firstField ? (firstField.fieldType ?? null) : null;
            fireQuestionProgress({
              visitId: tracking.visitId,
              formId: tracking.formId,
              visitorHash: tracking.visitorHash,
              questionId,
              questionType,
              questionIndex: stepIndex,
              event: "start",
            });
          }
          if (!didStartFiredVisits.has(tracking.visitId)) {
            didStartFiredVisits.add(tracking.visitId);
            fireUpdateVisit({ visitId: tracking.visitId, didStartForm: true });
          }
        }
      },
      onBlurDebounceMs: 1000,
    },
    onSubmit: async ({ value }) => {
      // Errors bubble to public-form-page, which renders an inline banner.
      // No toast here — keeps the published form's bundle free of sonner.
      logger(`Step ${stepIndex + 1} submitted with values:`, value);

      // Analytics: fire `complete` for this step before navigating away. The
      // server fn is fire-and-forget so it doesn't delay submitForm.
      if (tracking?.visitId && tracking.mode) {
        const isFieldByField = tracking.mode === "field-by-field";
        const firstField = fields.length > 0 ? fields[0] : null;
        const questionId = isFieldByField && firstField ? firstField.id : `step_${stepIndex}`;
        const questionType = isFieldByField && firstField ? (firstField.fieldType ?? null) : null;
        fireQuestionProgress({
          visitId: tracking.visitId,
          formId: tracking.formId,
          visitorHash: tracking.visitorHash,
          questionId,
          questionType,
          questionIndex: stepIndex,
          event: "complete",
          wasLastQuestion: isLastStep,
        });
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

  return { form: form as unknown as AppForm, formName };
};
