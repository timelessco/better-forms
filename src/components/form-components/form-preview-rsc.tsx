// Client-side consumer of `getPublicFormViewRSC`. Imports no Plate code — the
// static prose is pre-rendered server-side; only field widgets fill slots.
import { CompositeComponent } from "@tanstack/react-start/rsc";
import { useCallback, useEffect, useRef, useState } from "react";

import { RenderFieldComponent } from "@/components/form-components/render-step-preview-input";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { StepFormProvider, useStepForm } from "@/contexts/step-form-context";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { cn } from "@/lib/utils";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import type {
  ButtonGroupSlotProps,
  FieldSlotProps,
} from "@/lib/server-fn/public-form-view-rsc.types";
import type { PublicFormSettings } from "@/types/form-settings";

// `src` is the opaque Composite Component payload; `fields` travels alongside
// so the client can build the TanStack Form instance.
export interface StepRSC {
  src: unknown;
  fields: PlateFormField[];
}

// CompositeComponent's src generic collapses to `never` when the server fn's
// return type doesn't thread through to this file cleanly — local-alias the
// slot prop shape so slot components typecheck.
const TypedComposite = CompositeComponent as unknown as React.ComponentType<{
  src: unknown;
  Field?: React.ComponentType<FieldSlotProps>;
  ButtonGroup?: React.ComponentType<ButtonGroupSlotProps>;
  children?: React.ReactNode;
}>;

interface FormPreviewRSCProps {
  steps: StepRSC[];
  thankYou?: string | null;
  stepCount: number;
  /**
   * Pre-rendered header composite (cover + icon + title). Server-rendered so
   * the client ships no cover/icon rendering code. `null` when the form has
   * no header content, `undefined` when the viewer requested `hideTitle`.
   */
  header?: unknown;
  settings?: PublicFormSettings;
  formId: string;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  /** Rehydrate step state from a server-side draft (resume-after-refresh). */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Analytics tracking base ({ visitId, visitorHash }). Only passed by the
   * public form route — builder previews leave this undefined to disable
   * tracking. */
  trackingBase?: TrackingBase;
}

const PAGE_MAX_WIDTH = `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`;

const NoContentPlaceholderIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mx-auto mb-4 opacity-50"
  >
    <title>No content placeholder</title>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const SuccessCheckmarkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-green-600"
  >
    <title>Success checkmark</title>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const DefaultThankYou = ({ onReset }: { onReset?: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        {SuccessCheckmarkIcon}
      </div>
      <h2 className="mb-2 text-2xl font-bold">{t("thankYou")}</h2>
      <p className="mb-6 text-muted-foreground">{t("responseSubmitted")}</p>
      {onReset && (
        <Button type="button" onClick={onReset} variant="outline" size="sm" className="rounded-lg">
          {t("submitAnother")}
        </Button>
      )}
    </div>
  );
};

const StepButton = ({
  buttonText,
  buttonRole,
  isSubmitting,
  onPrevious,
  grouped = false,
  totalSteps = 1,
}: {
  buttonText: string;
  buttonRole: "next" | "previous" | "submit";
  isSubmitting: boolean;
  onPrevious?: () => void;
  grouped?: boolean;
  totalSteps?: number;
}) => {
  const buttonStyle = { fontSize: "13px" } as const;

  if (buttonRole === "previous") {
    const button = (
      <Button
        type="button"
        onClick={onPrevious}
        style={buttonStyle}
        className="h-8 gap-1.5 rounded-lg px-2.5"
        prefix={<ChevronLeftIcon className="size-4" />}
      >
        {buttonText}
      </Button>
    );
    return grouped ? (
      button
    ) : (
      <div className="flex justify-start" style={{ maxWidth: "var(--bf-input-width)" }}>
        {button}
      </div>
    );
  }

  if (buttonRole === "next") {
    const button = (
      <Button
        type="submit"
        style={buttonStyle}
        className="h-8 gap-1.5 rounded-lg px-2.5"
        suffix={<ChevronRightIcon className="size-4" />}
        disabled={isSubmitting}
      >
        {buttonText}
      </Button>
    );
    return grouped ? (
      button
    ) : (
      <div className="mb-4 flex justify-end" style={{ maxWidth: "var(--bf-input-width)" }}>
        {button}
      </div>
    );
  }

  // Submit
  const isMultiStep = totalSteps > 1;
  const submitButton = (
    <Button
      type="submit"
      style={buttonStyle}
      className="h-8 gap-1.5 rounded-lg px-2.5"
      disabled={isSubmitting}
    >
      {buttonText}
    </Button>
  );
  return grouped ? (
    submitButton
  ) : (
    <div
      className={`flex ${isMultiStep ? "justify-end" : "justify-start"}`}
      style={{ maxWidth: "var(--bf-input-width)" }}
    >
      {submitButton}
    </div>
  );
};

const StepFormRSC = ({
  stepIndex,
  stepRSC,
  isLastStep,
}: {
  stepIndex: number;
  stepRSC: StepRSC;
  isLastStep: boolean;
}) => {
  const { currentStep, totalSteps, goToPrevStep, isSubmitting } = useStepForm();
  const { t } = useTranslation();
  const fields = stepRSC.fields;

  const { form, formName } = useStepPreviewForm({
    fields,
    stepIndex,
    isLastStep,
    formName: `stepForm-${stepIndex}`,
  });

  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstField(formRef);

  const FieldSlot = useCallback(
    ({ fieldId, field }: FieldSlotProps) => {
      if (field.fieldType === "Button") {
        const btn = field as PlateFormField & {
          buttonText?: string;
          buttonRole?: "next" | "previous" | "submit";
        };
        const role = btn.buttonRole ?? "submit";
        const defaultText =
          role === "next" ? t("next") : role === "previous" ? t("previous") : t("submit");
        return (
          <StepButton
            buttonText={
              role === "submit" && isSubmitting ? t("submitting") : btn.buttonText || defaultText
            }
            buttonRole={role}
            isSubmitting={isSubmitting}
            onPrevious={currentStep > 0 ? goToPrevStep : undefined}
            totalSteps={totalSteps}
          />
        );
      }
      return <RenderFieldComponent key={fieldId} element={field} form={form} />;
    },
    [form, isSubmitting, currentStep, goToPrevStep, totalSteps, t],
  );

  const ButtonGroupSlot = useCallback(
    ({ buttons }: ButtonGroupSlotProps) => {
      const prev = buttons.find((b) => b.buttonRole === "previous");
      const action = buttons.find((b) => b.buttonRole === "next" || b.buttonRole === "submit");
      const actionRole = action?.buttonRole ?? "submit";
      const actionDefaultText =
        actionRole === "next" ? t("next") : actionRole === "previous" ? t("previous") : t("submit");
      const actionText =
        actionRole === "submit" && isSubmitting
          ? t("submitting")
          : action?.buttonText || actionDefaultText;

      return (
        <div
          className="flex w-full flex-row-reverse items-center justify-between"
          style={{ maxWidth: "var(--bf-input-width)" }}
        >
          {action && (
            <StepButton
              buttonText={actionText}
              buttonRole={actionRole}
              isSubmitting={isSubmitting}
              onPrevious={currentStep > 0 ? goToPrevStep : undefined}
              grouped
              totalSteps={totalSteps}
            />
          )}
          {prev ? (
            <StepButton
              buttonText={prev.buttonText || t("previous")}
              buttonRole="previous"
              isSubmitting={isSubmitting}
              onPrevious={currentStep > 0 ? goToPrevStep : undefined}
              grouped
            />
          ) : (
            <div />
          )}
        </div>
      );
    },
    [t, isSubmitting, currentStep, goToPrevStep, totalSteps],
  );

  return (
    <form.AppForm>
      <form.Form
        id={formName}
        ref={formRef}
        noValidate
        data-bf-field-list
        className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <TypedComposite src={stepRSC.src} Field={FieldSlot} ButtonGroup={ButtonGroupSlot} />
      </form.Form>
    </form.AppForm>
  );
};

const FormPreviewRSCContent = ({
  steps,
  thankYou,
  header,
  settings,
}: {
  steps: StepRSC[];
  thankYou?: string | null;
  header?: unknown;
  settings?: PublicFormSettings;
}) => {
  const { currentStep, totalSteps, isSubmitted, direction, reset } = useStepForm();
  const { t } = useTranslation();
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isSubmitted) return;
    if (!settings?.redirectOnCompletion || !settings?.redirectUrl) return;

    const delay = settings.redirectDelay ?? 0;
    if (delay === 0) {
      window.location.href = settings.redirectUrl;
      return;
    }

    setRedirectCountdown(delay);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (settings.redirectUrl) window.location.href = settings.redirectUrl;
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSubmitted, settings?.redirectOnCompletion, settings?.redirectUrl, settings?.redirectDelay]);

  if (isSubmitted) {
    return (
      <div className="w-full">
        {header ? <TypedComposite src={header} /> : null}
        <div
          className="mx-auto w-full px-4"
          style={{ maxWidth: PAGE_MAX_WIDTH }}
          data-bf-form-container
        >
          <div className="animate-in duration-300 fade-in slide-in-from-bottom-2">
            {thankYou ? (
              <div data-bf-field-list className="space-y-4">
                <TypedComposite src={thankYou} />
                {reset && (
                  <div className="flex justify-center pt-4">
                    <Button
                      type="button"
                      onClick={reset}
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                    >
                      {t("submitAnother")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <DefaultThankYou onReset={reset} />
            )}
            {redirectCountdown !== null && (
              <p className="mt-4 text-center text-muted-foreground">
                {t("redirecting", {
                  n: redirectCountdown,
                  s: redirectCountdown !== 1 ? "s" : "",
                })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isLastStep = currentStep === steps.length - 1;
  const currentStepRSC = steps[currentStep];

  return (
    <div className="w-full">
      {header ? <TypedComposite src={header} /> : null}

      {settings?.progressBar && totalSteps > 1 && (
        <div
          className="mx-auto mb-6 px-4"
          style={{ maxWidth: PAGE_MAX_WIDTH }}
          data-bf-form-container
        >
          <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        </div>
      )}

      <div className="mx-auto px-4" style={{ maxWidth: PAGE_MAX_WIDTH }} data-bf-form-container>
        <div
          key={currentStep}
          className={cn(
            "w-full animate-in duration-200 fade-in",
            direction >= 0 ? "slide-in-from-right-2" : "slide-in-from-left-2",
          )}
        >
          {currentStepRSC && (
            <StepFormRSC
              key={currentStep}
              stepIndex={currentStep}
              stepRSC={currentStepRSC}
              isLastStep={isLastStep}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const FormPreviewRSC = ({
  steps,
  thankYou,
  stepCount,
  header,
  settings,
  formId,
  onSubmit,
  initialFormData,
  initialCurrentStep,
  trackingBase,
}: FormPreviewRSCProps) => {
  if (steps.length === 0 || stepCount === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 text-muted-foreground">{NoContentPlaceholderIcon}</div>
        <h3 className="mb-2 text-lg">No Content Yet</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Add content to the editor to see the preview.
        </p>
      </div>
    );
  }

  // RSC variant only handles card-mode presentation; field-by-field renders
  // through FormPreviewFromPlate. Mode is `card` for multi-step forms,
  // `null` for single-page (disables question-progress tracking).
  const trackingMode: PublicFormTracking["mode"] = stepCount > 1 ? "card" : null;
  const tracking: PublicFormTracking | null =
    trackingBase && formId
      ? {
          visitId: trackingBase.visitId,
          visitorHash: trackingBase.visitorHash,
          formId,
          mode: trackingMode,
        }
      : null;

  return (
    <StepFormProvider
      totalSteps={stepCount}
      onSubmit={onSubmit}
      formId={formId}
      saveAnswersForLater={settings?.saveAnswersForLater}
      initialFormData={initialFormData}
      initialCurrentStep={initialCurrentStep}
      tracking={tracking}
    >
      <FormPreviewRSCContent
        steps={steps}
        thankYou={thankYou}
        header={header}
        settings={settings}
      />
    </StepFormProvider>
  );
};
