// Client consumer of getPublicFormViewRSC. No Plate code — prose pre-rendered server-side; only field widgets fill slots.
import { CompositeComponent } from "@tanstack/react-start/rsc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  RenderFieldComponent,
  RenderStepPreviewInput,
} from "@/components/form-components/render-step-preview-input";
import { SuccessCheck } from "@/components/transitions/success-check";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { FormBrandingBadge } from "@/components/form-components/step-form";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { EmailVerificationContext } from "@/components/form-components/email-verification-context";
import type { EmailVerificationStore } from "@/components/form-components/email-verification-context";
import { StepFormProvider, useStepForm } from "@/contexts/step-form-context";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { FormLogicProvider } from "@/contexts/form-logic-context";
import type { FormLogicValue } from "@/lib/logic/build-form-logic";
import { useTranslation } from "@/contexts/translation-context";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { enqueueQuestionProgress } from "@/lib/analytics/track-client";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { cn } from "@/lib/utils";
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
  /** Server-rendered header composite (cover+icon+title); client ships no cover/icon code. null = no header, undefined = hideTitle. Used by card AND field-by-field (the popup gets a flush cover + compact title via POPUP_FORM_STYLE_VARS). */
  header?: unknown;
  settings?: PublicFormSettings;
  formId: string;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  /** Rehydrate step state from a server-side draft (resume-after-refresh). */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Analytics base ({ visitId, visitorHash }). Public route only; undefined in builder previews disables tracking. */
  trackingBase?: TrackingBase;
  /** "Verify email" runtime store (mode "live" on the public route → real OTP emails + tokens on submit). */
  emailVerification?: EmailVerificationStore;
  /** Conditional-logic payload (plain JSON from the RSC server fn). null = no logic. */
  logic?: FormLogicValue | null;
  /** Field-by-field meta. Required when presentationMode="field-by-field" — the client uses the same server `header` composite as card mode; this carries the popup flag + iconColor (picker bg from the server-side formHeader node). */
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
  navVariant = "hint",
  branding = false,
}: {
  stepIndex: number;
  stepRSC: StepRSC;
  isLastStep: boolean;
  questions: QuestionRef[];
  /** Field-by-field: server strips Button fields, so render an auto Submit/Next here w/ Enter/Esc shortcuts. */
  autoActionButton?: boolean;
  /** Auto-action nav style: "hint" = keyboard-hint row (popup/embed); "footer" = full-page Back/Next → row. */
  navVariant?: "hint" | "footer";
  /** Show the "Made with Reform." badge in the footer (full-page, every step). */
  branding?: boolean;
}) => {
  const { totalSteps, goToPrevStep, canGoBack, isSubmitting } = useStepForm();
  const { t } = useTranslation();
  const fields = stepRSC.fields;

  const {
    form,
    formName,
    handleFieldFocus,
    visibleFieldNames,
    lockedFieldNames,
    requiredFieldNames,
    hideSubmit,
  } = useStepPreviewForm({
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
      if (!canGoBack) return;
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
        // Conditional "hide submit button" action suppresses the completion control.
        if (hideSubmit && role === "submit") return null;
        const defaultText =
          role === "next" ? t("next") : role === "previous" ? t("previous") : t("submit");
        return (
          <StepButton
            buttonText={
              role === "submit" && isSubmitting ? t("submitting") : btn.buttonText || defaultText
            }
            buttonRole={role}
            isSubmitting={isSubmitting}
            onPrevious={canGoBack ? goToPrevStep : undefined}
            totalSteps={totalSteps}
          />
        );
      }
      // Conditional logic: skip hidden fields. Auto-filled ("Set value") fields stay editable
      // so a mistaken auto-fill can be corrected — only dimmed to hint that logic set the value.
      if (visibleFieldNames && !visibleFieldNames.has(field.name)) return null;
      const autoFilled = lockedFieldNames.has(field.name);
      // Reflect logic-driven requiredness (a passing "Require field" action) on the label.
      const rendered = requiredFieldNames
        ? { ...field, required: requiredFieldNames.has(field.name) }
        : field;
      // Mention labels render label+input client-side (reactive resolution); the server omitted
      // ServerFieldLabel for these (see public-form-view-rsc.impl). RenderStepPreviewInput owns the wrapper.
      const hasMentionLabel = "labelNodes" in rendered && rendered.labelNodes;
      return (
        <div data-bf-question-id={field.id} className={`w-full${autoFilled ? " opacity-75" : ""}`}>
          {hasMentionLabel ? (
            <RenderStepPreviewInput key={fieldId} element={rendered} form={form} />
          ) : (
            <RenderFieldComponent key={fieldId} element={rendered} form={form} />
          )}
        </div>
      );
    },
    [
      form,
      isSubmitting,
      canGoBack,
      goToPrevStep,
      totalSteps,
      t,
      visibleFieldNames,
      lockedFieldNames,
      requiredFieldNames,
      hideSubmit,
    ],
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
          {action && !(hideSubmit && actionRole === "submit") && (
            <StepButton
              buttonText={actionText}
              buttonRole={actionRole}
              isSubmitting={isSubmitting}
              onPrevious={canGoBack ? goToPrevStep : undefined}
              grouped
              totalSteps={totalSteps}
            />
          )}
          {prev ? (
            <StepButton
              buttonText={prev.buttonText || t("previous")}
              buttonRole="previous"
              isSubmitting={isSubmitting}
              onPrevious={canGoBack ? goToPrevStep : undefined}
              grouped
            />
          ) : (
            <div />
          )}
        </div>
      );
    },
    [t, isSubmitting, canGoBack, goToPrevStep, totalSteps, hideSubmit],
  );

  return (
    <form.AppForm>
      <form.Form
        id={formName}
        ref={formRef}
        noValidate
        data-bf-field-list
        // Footer variant is flex `gap-7`; mark it so CSS zeroes the field's block margin (flex
        // items don't margin-collapse, else field→footer doubles to 56px). See styles.css.
        data-bf-fbf-footer={navVariant === "footer" ? "" : undefined}
        onKeyDownCapture={autoActionButton ? handleFieldByFieldKeyDown : undefined}
        onFocus={handleFormFocus}
        onBlur={autoActionButton ? handleTextareaFocusChange(false) : undefined}
        className={
          navVariant === "footer"
            ? "flex flex-col gap-7 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            : "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        }
      >
        <TypedComposite src={stepRSC.src} Field={FieldSlot} ButtonGroup={ButtonGroupSlot} />
        {autoActionButton &&
          (navVariant === "footer" ? (
            // Full-page one-at-a-time footer (Figma 27112:21064): Back / Next → left, branding right.
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Back appears only when there's a previous step (Figma 27015:16542 step 1 = Next only). */}
                {canGoBack && (
                  <Button
                    type="button"
                    variant="ghost-flat"
                    onClick={goToPrevStep}
                    style={{ fontSize: "14px" }}
                    className="h-auto rounded-[8px] px-2 py-1.5 font-[420] tracking-[0.28px] text-gray-900"
                  >
                    {t("back")}
                  </Button>
                )}
                {!(hideSubmit && isLastStep) && (
                  <Button
                    type="submit"
                    data-bf-button=""
                    disabled={isSubmitting}
                    style={{ fontSize: "14px" }}
                    className="h-auto gap-2 rounded-[8px] px-2 py-1.5 font-[420] tracking-[0.28px]"
                    suffix={<ArrowRightIcon className="size-4" />}
                  >
                    {isSubmitting ? t("submitting") : isLastStep ? t("submit") : t("next")}
                  </Button>
                )}
              </div>
              {branding && <FormBrandingBadge />}
            </div>
          ) : (
            <div
              className="flex w-full items-center gap-3 pt-2"
              style={{ maxWidth: "var(--bf-input-width)" }}
            >
              {!(hideSubmit && isLastStep) && (
                <Button
                  type="submit"
                  style={{ fontSize: "13px" }}
                  className="h-9 gap-1.5 rounded-lg px-4"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("submitting") : isLastStep ? t("submit") : t("next")}
                </Button>
              )}
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
              {canGoBack && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                    Esc
                  </kbd>
                  to go back
                </span>
              )}
            </div>
          ))}
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

const FieldByFieldRSCContent = ({
  steps,
  thankYou,
  header,
  settings,
  meta,
}: {
  steps: StepRSC[];
  thankYou?: string | null;
  header?: unknown;
  settings?: PublicFormSettings;
  meta: NonNullable<FormPreviewRSCProps["fieldByFieldMeta"]>;
}) => {
  const { currentStep, isSubmitted, direction, reset } = useStepForm();
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

  const { isPopup } = meta;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepRSC = steps[currentStep];
  // Full-page one-at-a-time: clean centered card (Figma 27112:20994) — no cover, avatar circle +
  // title + field + Back/Next footer. Popup keeps the cover-bg layout below.
  const isFullPage = !isPopup;

  const submittedView = (
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
          {t("redirecting", { n: redirectCountdown, s: redirectCountdown !== 1 ? "s" : "" })}
        </p>
      )}
    </div>
  );

  if (isFullPage) {
    // SAME header as card mode (cover banner + icon + title); only the below-header field/nav is the
    // Figma Back/Next footer. No progress bar in one-at-a-time.
    return (
      <div className="w-full">
        {header ? <TypedComposite src={header} /> : null}
        <div
          className="mx-auto w-full px-4 sm:px-6"
          style={{ maxWidth: PAGE_MAX_WIDTH }}
          data-bf-form-container
        >
          {isSubmitted ? (
            submittedView
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
                  navVariant="footer"
                  branding={Boolean(settings?.branding)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Popup/embed one-at-a-time: clean layout (no cover-bg) — same title-only header as the card
  // popup, only the body is the Figma Back/Next footer (26883 / 27015-16542).
  return (
    <div className="relative flex size-full min-h-full flex-col overflow-hidden">
      {/* Server header composite (cover banner + title). Popup gets a flush cover + compact title
          from POPUP_FORM_STYLE_VARS; no cover → uncovered title-only header (Figma 26883/26889). */}
      {header ? <TypedComposite src={header} /> : null}

      <div
        // Top-aligned stack under the header (matches the preview); 20px below the footer so it
        // doesn't sit flush at the popup edge (Figma 27015:16550 pb-20).
        className="relative z-10 mx-auto w-full px-4 pb-[20px] sm:px-6"
        style={{ maxWidth: PAGE_MAX_WIDTH }}
        data-bf-form-container
      >
        {/* No progress bar in one-at-a-time. */}
        <div className="w-full">
          {isSubmitted ? (
            submittedView
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
                  navVariant="footer"
                  branding={Boolean(settings?.branding)}
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
  emailVerification,
  fieldByFieldMeta,
  logic,
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

  const content = (
    <EmailVerificationContext.Provider value={emailVerification ?? null}>
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
            header={header}
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
    </EmailVerificationContext.Provider>
  );

  // Provide the conditional-logic payload so the public form runs the same engine
  // (visibility/jumps/set-value/hide-submit) the builder preview does.
  return logic ? <FormLogicProvider value={logic}>{content}</FormLogicProvider> : content;
};
