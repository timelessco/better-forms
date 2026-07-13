import { use, useMemo, useRef, useState } from "react";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { FormPreviewReadOnlyContext, useStepForm } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { getFieldsFromSegments } from "@/lib/editor/transform-plate-for-preview";
import type { FieldSegment, PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import { StaticContentBlock } from "./static-content-block";
import { PreviewRendererContext, RenderStepPreviewInput } from "./render-step-preview-input";
import {
  AutoActionFooter,
  brandingRowStyle,
  FormBrandingBadge,
  StepNavButton,
  useFieldByFieldKeyboard,
  useQuestionViewTracking,
} from "./step-runner";

interface StepFormProps {
  stepIndex: number;
  segments: PreviewSegment[];
  /** Pre-computed Questions w/ global indices for analytics emitters. Omittable in non-tracking previews (emitters no-op when tracking null). */
  questions?: QuestionRef[];
  isLastStep: boolean;
  autoActionButton?: boolean;
  /** Show the "Made with Reform." footer badge beside the final Submit (settings.branding). */
  branding?: boolean;
  /** Auto-action nav style: "hint" = keyboard-hint row (popup/embed); "footer" = full-page
   *  Back / Next → button row (Figma 27112:21064). */
  navVariant?: "hint" | "footer";
}

// One step's form instance. Nav + data accumulation via StepFormContext.
export const StepForm = ({
  stepIndex,
  segments,
  questions,
  isLastStep,
  autoActionButton = false,
  branding = false,
  navVariant = "hint",
}: StepFormProps) => {
  const { totalSteps, goToPrevStep, canGoBack, isSubmitting, tracking } = useStepForm();
  // Read-only submission view: suppress every nav/action affordance (button groups,
  // authored Buttons, auto Next/Submit) so stacked steps read as a flat record.
  const readOnly = use(FormPreviewReadOnlyContext);
  const Renderer = use(PreviewRendererContext) ?? RenderStepPreviewInput;
  const fields = useMemo(() => getFieldsFromSegments(segments), [segments]);
  const stepQuestions = useMemo<QuestionRef[]>(() => questions ?? [], [questions]);
  const hasAuthoredButton = useMemo(
    () => segments.some((seg) => seg.type === "field" && seg.field.fieldType === "Button"),
    [segments],
  );
  const showAutoActionButton = autoActionButton && !hasAuthoredButton;

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
    questions: stepQuestions,
    stepIndex,
    isLastStep,
    formName: `stepForm-${stepIndex}`,
  });

  const groupedItems = useMemo(() => groupSegmentsForRendering(segments), [segments]);
  // Branding rides EVERY step's action row (Next and Submit), not just the final Submit — so
  // multi-step card forms show "Made with Reform." throughout, matching one-at-a-time (Figma 27112-20324).
  const showBranding = branding;

  const formRef = useRef<HTMLFormElement>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  const handleFieldByFieldKeyDown = useFieldByFieldKeyboard(formRef, { canGoBack, goToPrevStep });

  const handleTextareaFocusChange =
    (focused: boolean) => (event: React.FocusEvent<HTMLFormElement>) => {
      if ((event.target as HTMLElement).tagName === "TEXTAREA") {
        setIsTextareaFocused(focused);
      }
    };

  // Form-level onFocus: textarea-state tracking + per-Question analytics `start`. Focus bubbles so any input reaches here.
  const handleFormFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    if (autoActionButton) handleTextareaFocusChange(true)(event);
    handleFieldFocus(event);
  };

  useFocusFirstField(formRef);

  useQuestionViewTracking(stepQuestions, { tracking, isLastStep });

  return (
    <form.AppForm>
      <form.Form
        id={formName}
        ref={formRef}
        noValidate
        data-bf-field-list
        // Footer variant is flex `gap-7`; mark it so CSS can zero the field's block margin (flex
        // items don't margin-collapse, else field→footer doubles to 56px). See styles.css.
        data-bf-fbf-footer={navVariant === "footer" ? "" : undefined}
        onKeyDownCapture={autoActionButton ? handleFieldByFieldKeyDown : undefined}
        onFocus={handleFormFocus}
        onBlur={autoActionButton ? handleTextareaFocusChange(false) : undefined}
        // footer variant: flex-col gap-7 (28px) so field→footer matches the Figma card. Otherwise
        // pb-7 gives 28px breathing room so the submit/branding row doesn't sit flush at the bottom.
        className={
          navVariant === "footer"
            ? "flex flex-col gap-7 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            : "pb-7 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        }
      >
        {groupedItems.map((item) => {
          if (item.type === "buttonGroup") {
            if (readOnly) return null;
            const prevButton = item.buttons.find((b) => b.buttonRole === "previous");
            const actionButton = item.buttons.find(
              (b) => b.buttonRole === "next" || b.buttonRole === "submit",
            );

            const groupKey = `button-group-${item.buttons.map((b) => b.id).join("-")}`;

            return (
              // Prev + Next/Submit grouped left (8px gap), branding pushed right (Figma 27112-20305).
              <div
                key={groupKey}
                className="flex w-full items-center justify-between gap-3"
                style={{ maxWidth: "var(--bf-input-width)" }}
              >
                <div className="flex items-center gap-2">
                  {prevButton && (
                    <RenderStepButton
                      field={prevButton}
                      isSubmitting={isSubmitting}
                      onPrevious={canGoBack ? goToPrevStep : undefined}
                      grouped
                    />
                  )}
                  {actionButton && (
                    <RenderStepButton
                      field={actionButton}
                      isSubmitting={isSubmitting}
                      onPrevious={canGoBack ? goToPrevStep : undefined}
                      hideSubmit={hideSubmit}
                      grouped
                    />
                  )}
                </div>
                {showBranding && <FormBrandingBadge />}
              </div>
            );
          }

          if (item.type === "static") {
            return (
              <StaticContentBlock
                key={`static-${item.nodes.length}-${JSON.stringify(item.nodes[0]).slice(0, 32)}`}
                nodes={item.nodes}
              />
            );
          }

          if (item.type === "field") {
            const { field } = item;

            // Conditional logic: skip fields the engine has hidden (value retained in form state).
            if (
              field.fieldType !== "Button" &&
              visibleFieldNames &&
              !visibleFieldNames.has(field.name)
            ) {
              return null;
            }

            if (field.fieldType === "Button") {
              if (readOnly) return null;
              return (
                <RenderStepButton
                  key={field.id}
                  field={field}
                  isSubmitting={isSubmitting}
                  onPrevious={canGoBack ? goToPrevStep : undefined}
                  hideSubmit={hideSubmit}
                  totalSteps={totalSteps}
                  showBranding={showBranding}
                />
              );
            }

            // Fields auto-filled by a "Set value" action stay editable so a mistaken auto-fill
            // can be corrected; they're only dimmed to hint that logic set the value.
            const autoFilled = lockedFieldNames.has(field.name);
            // Reflect logic-driven requiredness on the label (a passing "Require field" action),
            // not just the authored flag.
            const rendered = requiredFieldNames
              ? { ...field, required: requiredFieldNames.has(field.name) }
              : field;
            return (
              <div
                key={field.id}
                className={`w-full${autoFilled ? " opacity-75" : ""}`}
                data-bf-input
                data-bf-question-id={field.id}
              >
                <Renderer element={rendered} form={form} />
              </div>
            );
          }

          return null;
        })}

        {!readOnly && showAutoActionButton && !(hideSubmit && isLastStep) && (
          <AutoActionFooter
            navVariant={navVariant}
            branding={showBranding}
            isLastStep={isLastStep}
            hideSubmit={hideSubmit}
            isTextareaFocused={isTextareaFocused}
          />
        )}
      </form.Form>
    </form.AppForm>
  );
};

type ButtonField = {
  id: string;
  name: string;
  fieldType: "Button";
  buttonText?: string;
  buttonRole: "next" | "previous" | "submit";
};

type GroupedSegment = PreviewSegment | { type: "buttonGroup"; buttons: ButtonField[] };

// Collapse all button segments into one group at the end, so Previous + Next/Submit share a row.
const groupSegmentsForRendering = (segments: PreviewSegment[]): GroupedSegment[] => {
  const result: GroupedSegment[] = [];
  const allButtons: ButtonField[] = [];

  for (const seg of segments) {
    if (seg.type === "field" && seg.field.fieldType === "Button") {
      allButtons.push(seg.field as ButtonField);
    } else {
      result.push(seg);
    }
  }

  if (allButtons.length > 1) {
    result.push({ type: "buttonGroup", buttons: allButtons });
  } else if (allButtons.length === 1) {
    result.push({ type: "field", field: allButtons[0] } as FieldSegment);
  }

  return result;
};

// Step-form button. Previous uses onClick; Next/Submit use type="submit" to trigger validation.
const RenderStepButton = ({
  field,
  isSubmitting,
  onPrevious,
  grouped = false,
  totalSteps = 1,
  hideSubmit = false,
  showBranding = false,
}: {
  field: ButtonField;
  isSubmitting: boolean;
  onPrevious?: () => void;
  grouped?: boolean;
  totalSteps?: number;
  hideSubmit?: boolean;
  showBranding?: boolean;
}) => {
  const { t } = useTranslation();
  const buttonRole = field.buttonRole || "submit";

  // Conditional "hide submit button" action suppresses the completion control.
  if (hideSubmit && buttonRole === "submit") return null;
  const defaultText =
    buttonRole === "next" ? t("next") : buttonRole === "previous" ? t("previous") : t("submit");
  const buttonText = field.buttonText || defaultText;

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
      // Branding rides the Next row opposite the button per Buttons → Alignment; without branding
      // the button honors --bf-button-justify (fallback right).
      <div
        className={`mb-4 flex items-center gap-3`}
        style={{
          maxWidth: "var(--bf-input-width)",
          ...(showBranding
            ? brandingRowStyle
            : { justifyContent: "var(--bf-button-justify, flex-end)" }),
        }}
      >
        {button}
        {showBranding && <FormBrandingBadge />}
      </div>
    );
  }

  const isMultiStep = totalSteps > 1;
  const submitButton = (
    // Render text directly (not TextSwap) — the inline-block+blur span clipped the last glyph
    // ("Submit" → "Submi"); the Next button and live renderer render text directly too.
    <StepNavButton role="submit" isSubmitting={isSubmitting}>
      {isSubmitting ? t("submitting") : buttonText}
    </StepNavButton>
  );
  return grouped ? (
    submitButton
  ) : (
    // Branding rides the submit row opposite the button per Buttons → Alignment. Without branding
    // the button honors --bf-button-justify (fallback: multi-step right, single-step left).
    <div
      className={`flex items-center gap-3`}
      style={{
        maxWidth: "var(--bf-input-width)",
        ...(showBranding
          ? brandingRowStyle
          : {
              justifyContent: `var(--bf-button-justify, ${isMultiStep ? "flex-end" : "flex-start"})`,
            }),
      }}
    >
      {submitButton}
      {showBranding && <FormBrandingBadge />}
    </div>
  );
};
