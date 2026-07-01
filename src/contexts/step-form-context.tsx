import * as React from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { useFormPersistence } from "@/hooks/use-form-persistence";

/** Tracking state from `usePublicFormTracking`, before form-preview adds `formId` + `mode`. */
export interface TrackingBase {
  visitId: string | null;
  visitorHash: string;
}

export interface PublicFormTracking {
  /** null until recordFormVisit resolves (or forever, if bot/error). */
  visitId: string | null;
  visitorHash: string;
  formId: string;
  /** "card" if the form is multi-step via author-inserted page breaks, "field-by-field" if presentation mode chunks one field per step. null disables question-progress tracking. Matches `forms.settings.presentationMode` end-to-end. */
  mode: "card" | "field-by-field" | null;
}

type StepFormContextValue = {
  currentStep: number;
  totalSteps: number;
  formData: Record<string, unknown>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  /** Commit step data and advance to the next sequential step (no logic). */
  goToNextStep: (stepData: Record<string, unknown>) => void;
  /** Commit step data and jump to an explicit target step index (logic-resolved). */
  goToStep: (stepData: Record<string, unknown>, target: number) => void;
  goToPrevStep: () => void;
  /** False at the first visited step — drives Back affordances. */
  canGoBack: boolean;
  direction: number;
  submitForm: (finalStepData: Record<string, unknown>) => Promise<void>;
  reset: () => void;
  /** Form ID for upload server fn (empty when not in a published form context, e.g. builder preview) */
  formId: string;
  /** Analytics tracking handle. `null` in builder previews / when tracking is disabled. */
  tracking: PublicFormTracking | null;
};

type StepFormState = {
  /** Visited-step stack. `currentStep` is the last entry. Back pops it, so the
   * respondent returns to the step they actually came from after a jump. */
  history: number[];
  direction: number;
  formData: Record<string, unknown>;
  isSubmitting: boolean;
  isSubmitted: boolean;
};

type StepFormAction =
  | { type: "push-step"; formData: Record<string, unknown>; target: number }
  | { type: "prev-step" }
  | { type: "submit-start" }
  | { type: "submit-success" }
  | { type: "submit-end" }
  | { type: "reset" };

export const stepFormReducer = (state: StepFormState, action: StepFormAction): StepFormState => {
  switch (action.type) {
    case "push-step":
      return {
        ...state,
        formData: action.formData,
        direction: 1,
        history: [...state.history, action.target],
      };
    case "prev-step":
      // Pop to the previously visited step; no-op at the first step.
      return state.history.length > 1
        ? { ...state, direction: -1, history: state.history.slice(0, -1) }
        : state;
    case "submit-start":
      return { ...state, isSubmitting: true };
    case "submit-success":
      return { ...state, isSubmitted: true };
    case "submit-end":
      return { ...state, isSubmitting: false };
    case "reset":
      return {
        history: [0],
        direction: 0,
        formData: {},
        isSubmitting: false,
        isSubmitted: false,
      };
    default:
      return state;
  }
};

const StepFormContext = React.createContext<StepFormContextValue | null>(null);

// Submission single-view renders the form read-only: hides interactive affordances
// (repeatable add/remove, step nav) so it reads as a record, not an editable form.
export const FormPreviewReadOnlyContext = React.createContext(false);

export const useStepForm = () => {
  const context = React.use(StepFormContext);
  if (!context) {
    throw new Error("useStepForm must be used within a StepFormProvider.");
  }
  return context;
};

interface StepFormProviderProps {
  children: React.ReactNode;
  totalSteps: number;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
  /** Form ID for localStorage key */
  formId?: string;
  /** Enable auto-save to localStorage */
  saveAnswersForLater?: boolean;
  /** Server-draft rehydration payload; takes precedence over the localStorage cache. Remount provider via `key` to apply once fetched. */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Analytics tracking handle. `null`/omit disables tracking (e.g. builder previews, no `visitId`). */
  tracking?: PublicFormTracking | null;
}

export const StepFormProvider = ({
  children,
  totalSteps,
  onSubmit,
  formId = "",
  saveAnswersForLater = false,
  initialFormData,
  initialCurrentStep,
  tracking = null,
}: StepFormProviderProps) => {
  const { loadSavedData, saveData, clearSavedData } = useFormPersistence(
    formId,
    saveAnswersForLater,
  );

  const [state, dispatch] = React.useReducer(stepFormReducer, undefined, () => ({
    // Resuming a draft at step N: seed a linear 0..N history so Back still works
    // (the real visited path isn't persisted; linear is the sensible default).
    history: Array.from({ length: (initialCurrentStep ?? 0) + 1 }, (_, i) => i),
    direction: 0,
    formData: initialFormData ?? (saveAnswersForLater ? (loadSavedData() ?? {}) : {}),
    isSubmitting: false,
    isSubmitted: false,
  }));
  const { history, direction, formData, isSubmitting, isSubmitted } = state;
  const currentStep = history[history.length - 1];
  const canGoBack = history.length > 1;

  const formDataRef = useAsRef(formData);

  const goToStep = React.useCallback(
    (stepData: Record<string, unknown>, target: number) => {
      const next = { ...formDataRef.current, ...stepData };
      if (Object.keys(next).length > 0) saveData(next);
      dispatch({ type: "push-step", formData: next, target: Math.max(0, target) });
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- formDataRef is a stable ref
    [saveData],
  );

  const goToNextStep = React.useCallback(
    (stepData: Record<string, unknown>) => {
      goToStep(stepData, Math.min(currentStep + 1, totalSteps - 1));
    },
    [goToStep, currentStep, totalSteps],
  );

  const goToPrevStep = React.useCallback(() => {
    dispatch({ type: "prev-step" });
  }, []);

  const submitForm = React.useCallback(
    async (finalStepData: Record<string, unknown>) => {
      const allData = { ...formDataRef.current, ...finalStepData };
      dispatch({ type: "submit-start" });
      try {
        if (onSubmit) {
          await onSubmit(allData);
        }
        clearSavedData();
        dispatch({ type: "submit-success" });
      } finally {
        dispatch({ type: "submit-end" });
      }
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- formDataRef is a stable ref
    [onSubmit, clearSavedData],
  );

  const reset = React.useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  const value = React.useMemo<StepFormContextValue>(
    () => ({
      currentStep,
      totalSteps,
      formData,
      isSubmitting,
      isSubmitted,
      goToNextStep,
      goToStep,
      goToPrevStep,
      canGoBack,
      direction,
      submitForm,
      reset,
      formId,
      tracking,
    }),
    [
      currentStep,
      totalSteps,
      formData,
      isSubmitting,
      isSubmitted,
      goToNextStep,
      goToStep,
      goToPrevStep,
      canGoBack,
      direction,
      submitForm,
      reset,
      formId,
      tracking,
    ],
  );

  return <StepFormContext.Provider value={value}>{children}</StepFormContext.Provider>;
};
