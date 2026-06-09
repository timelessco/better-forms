import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@tanstack/react-form";
import { revalidateLogic, useAppForm } from "@/components/ui/tanstack-form";
import { useStepForm } from "@/contexts/step-form-context";
import { useFormLogic } from "@/contexts/form-logic-context";
import { evaluate } from "@/lib/logic/engine";
import { THANK_YOU_STEP } from "@/lib/logic/types";
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

/** First step after `fromIndex` that has at least one visible field (or is static-only).
 * Returns -1 when none remain → the form should finish. */
const nextVisibleStepIndex = (
  stepFieldNames: string[][],
  visibility: Record<string, boolean>,
  fromIndex: number,
): number => {
  for (let i = fromIndex + 1; i < stepFieldNames.length; i++) {
    const names = stepFieldNames[i];
    if (names.length === 0) return i; // static-only step stays in the flow
    if (names.some((name) => visibility[name] !== false)) return i;
  }
  return -1;
};

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
  /** Field names currently visible per conditional logic — step-form hides the rest.
   * `null` when no logic context is mounted (render everything). */
  visibleFieldNames: Set<string> | null;
  /** Field names auto-filled by an active "Set value" action — dimmed, still editable. */
  lockedFieldNames: Set<string>;
  /** Field names that are effectively required (authored OR a passing "Require field" action),
   * so the rendered label shows the mark. `null` when no logic context is mounted. */
  requiredFieldNames: Set<string> | null;
  /** True when a passing hide-submit action should suppress the completion button. */
  hideSubmit: boolean;
} => {
  const { formData, goToNextStep, goToStep, submitForm, currentStep, formId, tracking } =
    useStepForm();
  const { saveDraft } = useDraftAutoSave(formId);
  const logic = useFormLogic();

  // Mirror of the live form values, used to recompute visibility/required reactively.
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>(() => ({}));
  const mergedAnswers = useMemo<Record<string, unknown>>(
    () => ({ ...formData, ...liveValues }),
    [formData, liveValues],
  );
  const evaluation = useMemo(
    () => (logic ? evaluate(logic.ruleset, mergedAnswers, logic.allFields) : null),
    [logic, mergedAnswers],
  );
  const visibleFieldNames = useMemo<Set<string> | null>(() => {
    if (!evaluation) return null;
    return new Set(
      fields.filter((f) => evaluation.visibility[f.name] !== false).map((f) => f.name),
    );
  }, [evaluation, fields]);
  const lockedFieldNames = useMemo<Set<string>>(
    () => new Set(evaluation ? Object.keys(evaluation.setValues) : []),
    [evaluation],
  );
  // Effective-required field names (authored OR a passing "Require field" action) so the
  // rendered label can show the mark even when the requiredness comes from logic.
  const requiredFieldNames = useMemo<Set<string> | null>(
    () =>
      evaluation
        ? new Set(
            fields.filter((f) => evaluation.effectiveRequired[f.name] === true).map((f) => f.name),
          )
        : null,
    [evaluation, fields],
  );

  // `start` dedup latch keyed `visitId::questionId`, per Step mount. Cross-step idempotency via server upsert (coalesce on startedAt); StepForm remounts on back-nav, resetting this.
  const startFiredRef = useRef<Set<string>>(new Set());

  // Validate only currently-visible fields, with logic-driven effective-required applied.
  // Hidden fields are excluded so they never block submit; a passing require-action adds requiredness.
  const effectiveFields = useMemo(() => {
    if (!evaluation) return fields;
    return fields
      .filter((f) => evaluation.visibility[f.name] !== false)
      .map((f) => ({ ...f, required: evaluation.effectiveRequired[f.name] === true }));
  }, [fields, evaluation]);

  const validationSchema = useMemo(
    () => generateZodSchemaFromFields(effectiveFields),
    [effectiveFields],
  );

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

      // Resolve navigation against the *final* answers (avoids the one-render lag of the
      // memoized evaluation). No logic context → fall back to sequential next/submit.
      if (!logic) {
        if (isLastStep) await submitForm(value);
        else goToNextStep(value);
        return;
      }

      const finalAnswers = { ...formData, ...value };
      const submitEval = evaluate(logic.ruleset, finalAnswers, logic.allFields);
      const finish = async () => {
        if (submitEval.hideSubmit) return; // completion blocked while the condition holds
        await submitForm(value);
        if (submitEval.redirectUrl) globalThis.location.href = submitEval.redirectUrl;
      };

      const currentStepId = logic.stepIds[currentStep];
      const jumpTo = currentStepId ? submitEval.resolveJump(currentStepId) : null;
      if (jumpTo === THANK_YOU_STEP) {
        await finish();
        return;
      }
      let target = jumpTo ? logic.stepIds.indexOf(jumpTo) : -1;
      if (target < 0) {
        target = nextVisibleStepIndex(logic.stepFieldNames, submitEval.visibility, currentStep);
      }
      if (target < 0) await finish();
      else goToStep(value, target);
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

  // Mirror live values into state so visibility/required (and thus the schema) recompute
  // as the respondent types — enables same-step progressive disclosure. Only runs work
  // when logic is present; otherwise the empty `liveValues` keeps everything visible.
  const storeValues = useStore(form.store, (state) => state.values) as Record<string, unknown>;
  useEffect(() => {
    if (logic) setLiveValues(storeValues);
  }, [logic, storeValues]);

  // Auto-fill fields targeted by a "Set value" action. Apply only when the *computed*
  // value changes (not every render) so the respondent can still edit in between.
  const appliedSetValuesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!evaluation) return;
    const prev = appliedSetValuesRef.current;
    const next = evaluation.setValues;
    const onThisStep = (name: string) => fields.some((f) => f.name === name);
    // Apply changed set-values (only this step's fields live in this form instance;
    // cross-step targets are applied by their own step when it mounts).
    for (const [name, val] of Object.entries(next)) {
      if (prev[name] !== val && onThisStep(name)) form.setFieldValue(name, val);
    }
    // Clear an auto-fill when its condition stops matching — but only if the field still holds
    // the value we forced. If the respondent has since edited it, keep their correction.
    for (const name of Object.keys(prev)) {
      if (!(name in next) && onThisStep(name) && form.getFieldValue(name) === prev[name]) {
        form.setFieldValue(name, "");
      }
    }
    appliedSetValuesRef.current = { ...next };
  }, [evaluation, fields, form]);

  // "Move to next field": when a passing rule targets a field rendered on this step, scroll it
  // into view and focus it. Tracked by ref so it fires only when the target changes, never
  // stealing focus on every keystroke while the same rule keeps passing.
  const focusedFieldRef = useRef<string | null>(null);
  useEffect(() => {
    const target = evaluation?.focusField ?? null;
    if (target === focusedFieldRef.current) return;
    focusedFieldRef.current = target;
    if (!target || !fields.some((f) => f.name === target)) return; // not on this step
    const el = document.querySelector<HTMLElement>(`#${formName} [name="${target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }, [evaluation, fields, formName]);

  return {
    form: form as unknown as AppForm,
    formName,
    handleFieldFocus,
    visibleFieldNames,
    lockedFieldNames,
    requiredFieldNames,
    hideSubmit: evaluation?.hideSubmit ?? false,
  };
};
