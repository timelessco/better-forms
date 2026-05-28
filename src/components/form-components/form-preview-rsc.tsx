// Client consumer of getPublicFormViewRSC. No Plate code — prose pre-rendered server-side; only field widgets fill slots.
import { CompositeComponent } from "@tanstack/react-start/rsc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RenderFieldComponent } from "@/components/form-components/render-step-preview-input";
import { ServerFormIcon } from "@/components/form-components/server-form-icon";
import { SuccessCheck } from "@/components/transitions/success-check";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { StepFormProvider, useStepForm } from "@/contexts/step-form-context";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { enqueueQuestionProgress } from "@/lib/analytics/track-client";
import { DEFAULT_ICON } from "@/lib/config/app-config";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { cn, DEFAULT_ICON_NAME, isHexColor, isValidUrl } from "@/lib/utils";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { extractQuestionsForStepRSC } from "@/lib/forms/extract-questions";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import type {
  ButtonGroupSlotProps,
  FieldSlotProps,
} from "@/lib/server-fn/public-form-view-rsc.types";
import type { PresentationMode, PublicFormSettings } from "@/types/form-settings";

// `src` = opaque Composite payload; `fields` travels alongside to build the TanStack Form instance.
export interface StepRSC {
  src: unknown;
  fields: PlateFormField[];
}

// CompositeComponent's src generic collapses to `never` when server fn return type doesn't thread here. Local-alias slot prop shape so slots typecheck.
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
  /** Server-rendered header composite (cover+icon+title); client ships no cover/icon code. null = no header, undefined = hideTitle. Skipped for field-by-field (renders own client-side). */
  header?: unknown;
  settings?: PublicFormSettings;
  formId: string;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  /** Rehydrate step state from a server-side draft (resume-after-refresh). */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Analytics base ({ visitId, visitorHash }). Public route only; undefined in builder previews disables tracking. */
  trackingBase?: TrackingBase;
  /** Field-by-field meta. Required when presentationMode="field-by-field" — client renders icon+title+cover-as-bg instead of pre-rendered card header. iconColor = picker bg (from server-side formHeader node). */
  fieldByFieldMeta?: {
    title?: string;
    icon?: string | null;
    iconColor?: string | null;
    cover?: string | null;
    hideTitle?: boolean;
    isPopup?: boolean;
  };
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

const DefaultThankYou = ({ onReset }: { onReset?: () => void }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
        <SuccessCheck size={32} className="text-green-600" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">{t("thankYou")}</h2>
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
  questions,
  autoActionButton = false,
}: {
  stepIndex: number;
  stepRSC: StepRSC;
  isLastStep: boolean;
  questions: QuestionRef[];
  /** Field-by-field: server strips Button fields, so render an auto Submit/Next here w/ Enter/Esc shortcuts. */
  autoActionButton?: boolean;
}) => {
  const { currentStep, totalSteps, goToPrevStep, isSubmitting } = useStepForm();
  const { t } = useTranslation();
  const fields = stepRSC.fields;

  const { form, formName, handleFieldFocus } = useStepPreviewForm({
    fields,
    stepIndex,
    isLastStep,
    formName: `stepForm-${stepIndex}`,
    questions,
  });

  const formRef = useRef<HTMLFormElement>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  useFocusFirstField(formRef);

  // Field-by-field shortcuts: Enter advances/submits (textarea keeps newline unless ⌘/Ctrl), Esc back. Mirrors step-form.tsx.
  const handleFieldByFieldKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && formRef.current && !formRef.current.contains(target)) return;

    if (event.key === "Escape") {
      if (currentStep === 0) return;
      if (formRef.current?.querySelector('[aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      goToPrevStep();
      return;
    }

    if (event.key !== "Enter") return;
    if (!target) return;
    const isInQuestion = target.closest("[data-bf-input]") !== null;
    const isNavButton =
      (target.tagName === "BUTTON" || target.getAttribute("role") === "button") && !isInQuestion;
    if (isNavButton) return;

    const isTextarea = target.tagName === "TEXTAREA";
    const isMetaEnter = event.metaKey || event.ctrlKey;
    if (isTextarea && !isMetaEnter) return;

    event.preventDefault();
    event.stopPropagation();
    formRef.current?.requestSubmit();
  };

  const handleTextareaFocusChange =
    (focused: boolean) => (event: React.FocusEvent<HTMLFormElement>) => {
      if ((event.target as HTMLElement).tagName === "TEXTAREA") {
        setIsTextareaFocused(focused);
      }
    };

  const handleFormFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    if (autoActionButton) handleTextareaFocusChange(true)(event);
    handleFieldFocus(event);
  };

  const { tracking } = useStepForm();

  // Fire one `view` per Question on mount (mirrors step-form.tsx). Server upsert collapses re-mount dups.
  useMountEffect(() => {
    if (!(tracking?.visitId && tracking.mode)) return;
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
        event: "view",
        wasLastQuestion: isLastStep && i === lastIndex,
      });
    }
  });

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
      return (
        <div data-bf-question-id={field.id} className="w-full">
          <RenderFieldComponent key={fieldId} element={field} form={form} />
        </div>
      );
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
        onKeyDownCapture={autoActionButton ? handleFieldByFieldKeyDown : undefined}
        onFocus={handleFormFocus}
        onBlur={autoActionButton ? handleTextareaFocusChange(false) : undefined}
        className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <TypedComposite src={stepRSC.src} Field={FieldSlot} ButtonGroup={ButtonGroupSlot} />
        {autoActionButton && (
          <div
            className="flex w-full items-center gap-3 pt-2"
            style={{ maxWidth: "var(--bf-input-width)" }}
          >
            <Button
              type="submit"
              style={{ fontSize: "13px" }}
              className="h-9 gap-1.5 rounded-lg px-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("submitting") : isLastStep ? t("submit") : t("next")}
            </Button>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              press{" "}
              {isTextareaFocused && (
                <>
                  <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                    ⌘
                  </kbd>
                  +
                </>
              )}
              <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                Enter
              </kbd>
              <span aria-hidden="true">↵</span>
            </span>
            {currentStep > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                  Esc
                </kbd>
                to go back
              </span>
            )}
          </div>
        )}
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
  const currentStepQuestions = useMemo(
    () => extractQuestionsForStepRSC(steps, currentStep),
    [steps, currentStep],
  );

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- single state (redirectCountdown) updated via initial set + interval functional updater; not cascading independent state
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
              questions={currentStepQuestions}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const WHITE_HEX = "#ffffff";
const BLACK_HEX = "#000000";

// Field-by-field sprite icon honoring picker iconColor: that bg + contrasting fg (white on dark, black on white). Mirrors IconPickerPreview. No color → theme-tinted ServerFormIcon (card-mode parity).
const ColoredSpriteIcon = ({
  iconName,
  iconColor,
  iconSize = "40",
  size = "80",
}: {
  iconName: string;
  iconColor: string;
  iconSize?: string;
  size?: string;
}) => {
  const fgColor = iconColor.toLowerCase() === WHITE_HEX ? BLACK_HEX : WHITE_HEX;
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: iconColor,
        color: fgColor,
      }}
    >
      <svg height={iconSize} style={{ color: "currentColor" }} viewBox="0 0 18 18" width={iconSize}>
        <use href={`/api/icons/${iconName}.svg#${iconName}`} />
      </svg>
    </div>
  );
};

const FieldByFieldHeaderIconRSC = ({
  icon,
  iconColor,
}: {
  icon: string;
  iconColor?: string | null;
}) => {
  if (icon === DEFAULT_ICON) {
    return (
      <span className="flex-shrink-0" data-bf-logo-icon>
        {iconColor ? (
          <ColoredSpriteIcon iconName={DEFAULT_ICON_NAME} iconColor={iconColor} />
        ) : (
          <ServerFormIcon iconName={DEFAULT_ICON_NAME} iconSize="40" size="80" />
        )}
      </span>
    );
  }

  if (isValidUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        width={80}
        height={80}
        className="size-20 flex-shrink-0 rounded-md object-cover"
        data-bf-logo
      />
    );
  }

  return (
    <span className="flex-shrink-0" data-bf-logo-icon>
      {iconColor ? (
        <ColoredSpriteIcon iconName={icon} iconColor={iconColor} />
      ) : (
        <ServerFormIcon iconName={icon} iconSize="40" size="80" />
      )}
    </span>
  );
};

const FieldByFieldRSCContent = ({
  steps,
  thankYou,
  settings,
  meta,
}: {
  steps: StepRSC[];
  thankYou?: string | null;
  settings?: PublicFormSettings;
  meta: NonNullable<FormPreviewRSCProps["fieldByFieldMeta"]>;
}) => {
  const { currentStep, totalSteps, isSubmitted, direction, reset } = useStepForm();
  const { t } = useTranslation();
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const currentStepQuestions = useMemo(
    () => extractQuestionsForStepRSC(steps, currentStep),
    [steps, currentStep],
  );

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- single state updated via initial set + interval functional updater
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

  const { title, icon, iconColor, cover, hideTitle, isPopup } = meta;
  const coverImage = cover && isValidUrl(cover) ? cover : null;
  const coverColor = cover && isHexColor(cover) ? cover : null;
  // Popup: avatar already the bubble, hide inside (space + no dup).
  const hasIcon = !!icon && !isPopup;
  // hideTitle hides only the title; keep the header when there's an icon. Cover stays (it's the bg).
  const showHeader = hasIcon || (!!title && !hideTitle);
  const hasTint = coverImage?.includes("tint=true") ?? false;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepRSC = steps[currentStep];

  return (
    <div
      className="relative flex size-full min-h-full flex-col overflow-hidden"
      style={{
        backgroundImage: coverImage ? `url("${coverImage}")` : undefined,
        backgroundColor: coverColor ?? undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      data-bf-cover
    >
      {hasTint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-primary opacity-50 mix-blend-color"
        />
      )}

      {showHeader && (
        <div
          className={cn(
            "relative z-10 flex items-center gap-4",
            isPopup ? "px-4.5 pt-3" : "mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8",
          )}
          style={isPopup ? undefined : { maxWidth: PAGE_MAX_WIDTH }}
        >
          {hasIcon && icon && <FieldByFieldHeaderIconRSC icon={icon} iconColor={iconColor} />}
          {title && (
            <h1
              data-bf-title
              style={{ textWrap: "pretty" }}
              className={cn(
                "font-serif leading-none font-light -tracking-[0.03em] text-foreground",
                isPopup ? "text-2xl sm:text-3xl" : "text-6xl sm:text-[48px]",
              )}
            >
              {title}
            </h1>
          )}
        </div>
      )}

      <div
        className="relative z-10 mx-auto flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden px-4 pb-12 sm:px-6"
        style={{ maxWidth: PAGE_MAX_WIDTH }}
        data-bf-form-container
      >
        {!isSubmitted && settings?.progressBar && totalSteps > 1 && (
          <div className="mb-4 w-full">
            <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
          </div>
        )}

        <div className="w-full">
          {isSubmitted ? (
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
          ) : (
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
                  questions={currentStepQuestions}
                  autoActionButton
                />
              )}
            </div>
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
  fieldByFieldMeta,
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

  const presentationMode: PresentationMode = settings?.presentationMode ?? "card";
  const isFieldByField = presentationMode === "field-by-field";
  // Per ADR-0002 tracking always on — card forms still emit per-Question view/start/complete.
  const trackingMode: PublicFormTracking["mode"] = isFieldByField ? "field-by-field" : "card";
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
      {isFieldByField && fieldByFieldMeta ? (
        <FieldByFieldRSCContent
          steps={steps}
          thankYou={thankYou}
          settings={settings}
          meta={fieldByFieldMeta}
        />
      ) : (
        <FormPreviewRSCContent
          steps={steps}
          thankYou={thankYou}
          header={header}
          settings={settings}
        />
      )}
    </StepFormProvider>
  );
};
