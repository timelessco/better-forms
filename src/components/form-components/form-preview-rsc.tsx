// Client consumer of getPublicFormViewRSC. No Plate code — prose pre-rendered server-side; only field widgets fill slots.
import { CompositeComponent } from "@tanstack/react-start/rsc";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  RenderFieldComponent,
  RenderStepPreviewInput,
} from "@/components/form-components/render-step-preview-input";
import { Button } from "@/components/ui/button";
import {
  AutoActionFooter,
  brandingRowStyle,
  FormBrandingBadge,
  StepNavButton,
  useFieldByFieldKeyboard,
  useQuestionViewTracking,
} from "@/components/form-components/step-runner";
import {
  buildTracking,
  DefaultThankYou,
  NoContentPlaceholder,
} from "@/components/form-components/preview-shared";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { EmailVerificationContext } from "@/components/form-components/email-verification-context";
import type { EmailVerificationStore } from "@/components/form-components/email-verification-context";
import { StepFormProvider, useStepForm } from "@/contexts/step-form-context";
import type { TrackingBase } from "@/contexts/step-form-context";
import { FormLogicProvider } from "@/contexts/form-logic-context";
import type { FormLogicValue } from "@/lib/logic/build-form-logic";
import { useTranslation } from "@/contexts/translation-context";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useRedirectCompletion } from "@/hooks/use-redirect-completion";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
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

// Wraps the shared StepNavButton in the RSC-specific justify wrappers (branding wrappers stay here).
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
  const { t } = useTranslation();

  if (buttonRole === "previous") {
    const button = (
      // Always "Back" (like the one-at-a-time footer) — ignore any authored/legacy "Previous" text.
      <StepNavButton role="previous" onPrevious={onPrevious}>
        {t("back")}
      </StepNavButton>
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
      <StepNavButton role="next" isSubmitting={isSubmitting}>
        {buttonText}
      </StepNavButton>
    );
    return grouped ? (
      button
    ) : (
      <div className="mb-4 flex justify-end" style={{ maxWidth: "var(--bf-input-width)" }}>
        {button}
      </div>
    );
  }

  const isMultiStep = totalSteps > 1;
  const submitButton = (
    <StepNavButton role="submit" isSubmitting={isSubmitting}>
      {buttonText}
    </StepNavButton>
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
  const { totalSteps, goToPrevStep, canGoBack, isSubmitting, tracking } = useStepForm();
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

  const handleFieldByFieldKeyDown = useFieldByFieldKeyboard(formRef, { canGoBack, goToPrevStep });

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

  // Server upsert collapses re-mount dups.
  useQuestionViewTracking(questions, { tracking, isLastStep });

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
        // Prev + Next/Submit grouped; branding placed opposite per Buttons → Alignment (Figma 27112-20305).
        <div
          className={`flex w-full items-center gap-3 ${branding ? "" : "justify-between"}`}
          style={{
            maxWidth: "var(--bf-input-width)",
            ...(branding ? brandingRowStyle : undefined),
          }}
        >
          <div className="flex items-center gap-2">
            {prev && (
              <StepButton
                buttonText={prev.buttonText || t("previous")}
                buttonRole="previous"
                isSubmitting={isSubmitting}
                onPrevious={canGoBack ? goToPrevStep : undefined}
                grouped
              />
            )}
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
          </div>
          {branding && <FormBrandingBadge />}
        </div>
      );
    },
    [t, isSubmitting, canGoBack, goToPrevStep, totalSteps, hideSubmit, branding],
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
        {autoActionButton && (
          <AutoActionFooter
            navVariant={navVariant}
            branding={branding}
            isLastStep={isLastStep}
            hideSubmit={hideSubmit}
            isTextareaFocused={isTextareaFocused}
          />
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
  const redirectCountdown = useRedirectCompletion(isSubmitted, settings);
  const currentStepQuestions = useMemo(
    () => extractQuestionsForStepRSC(steps, currentStep),
    [steps, currentStep],
  );

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
  const redirectCountdown = useRedirectCompletion(isSubmitted, settings);
  const currentStepQuestions = useMemo(
    () => extractQuestionsForStepRSC(steps, currentStep),
    [steps, currentStep],
  );

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
    return <NoContentPlaceholder />;
  }

  const presentationMode: PresentationMode = settings?.presentationMode ?? "card";
  const isFieldByField = presentationMode === "field-by-field";
  const tracking = buildTracking(trackingBase, formId, presentationMode);

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
