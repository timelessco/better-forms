import * as React from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { useFormPersistence } from "@/hooks/use-form-persistence";

/** Subset of tracking state produced by `usePublicFormTracking`, before the
 * form-preview component augments it with `formId` + `mode`. */
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
  goToNextStep: (stepData: Record<string, unknown>) => void;
  goToPrevStep: () => void;
  direction: number;
  submitForm: (finalStepData: Record<string, unknown>) => Promise<void>;
  reset: () => void;
  /** Form ID for upload server fn (empty when not in a published form context, e.g. builder preview) */
  formId: string;
  /** Analytics tracking handle. `null` in builder previews / when tracking is disabled. */
  tracking: PublicFormTracking | null;
};

const StepFormContext = React.createContext<StepFormContextValue | null>(null);

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
  /** Rehydration payload for resuming a server-side draft. Takes precedence
   * over saveAnswersForLater's localStorage cache. Caller should remount the
   * provider (via `key`) to apply these once a draft is fetched. */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Analytics tracking handle. Pass `null` (or omit) to disable tracking — e.g.
   * builder previews where no `visitId` exists. */
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

  const [currentStep, setCurrentStep] = React.useState(initialCurrentStep ?? 0);
  const [direction, setDirection] = React.useState(0);
  const [formData, setFormData] = React.useState<Record<string, unknown>>(() => {
    if (initialFormData) return initialFormData;
    if (saveAnswersForLater) {
      return loadSavedData() ?? {};
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const formDataRef = useAsRef(formData);

  const goToNextStep = React.useCallback(
    (stepData: Record<string, unknown>) => {
      const next = { ...formDataRef.current, ...stepData };
      setFormData(next);
      if (Object.keys(next).length > 0) saveData(next);
      setDirection(1);
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- formDataRef is a stable ref
    [totalSteps, saveData],
  );

  const goToPrevStep = React.useCallback(() => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const submitForm = React.useCallback(
    async (finalStepData: Record<string, unknown>) => {
      const allData = { ...formDataRef.current, ...finalStepData };
      setIsSubmitting(true);
      try {
        if (onSubmit) {
          await onSubmit(allData);
        }
        clearSavedData();
        setIsSubmitted(true);
      } finally {
        setIsSubmitting(false);
      }
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- formDataRef is a stable ref
    [onSubmit, clearSavedData],
  );

  const reset = React.useCallback(() => {
    setCurrentStep(0);
    setDirection(0);
    setFormData({});
    setIsSubmitting(false);
    setIsSubmitted(false);
  }, []);

  const value = React.useMemo<StepFormContextValue>(
    () => ({
      currentStep,
      totalSteps,
      formData,
      isSubmitting,
      isSubmitted,
      goToNextStep,
      goToPrevStep,
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
      goToPrevStep,
      direction,
      submitForm,
      reset,
      formId,
      tracking,
    ],
  );

  return <StepFormContext.Provider value={value}>{children}</StepFormContext.Provider>;
};
