import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { use, useMemo, useRef, useState } from "react";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Button } from "@/components/ui/button";
import { useStepForm } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { enqueueQuestionProgress } from "@/lib/analytics/track-client";
import { getFieldsFromSegments } from "@/lib/editor/transform-plate-for-preview";
import type { FieldSegment, PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import { StaticContentBlock } from "./static-content-block";
import { PreviewRendererContext, RenderStepPreviewInput } from "./render-step-preview-input";

interface StepFormProps {
  stepIndex: number;
  segments: PreviewSegment[];
  /** Pre-computed Questions in this Step with global question indices. Used
   * by the per-Question analytics emitters; safe to omit in non-tracking
   * previews (the emitters no-op when `tracking` is null). */
  questions?: QuestionRef[];
  isLastStep: boolean;
  autoActionButton?: boolean;
}

/**
 * Individual step form component with its own form instance.
 * Uses StepFormContext for navigation and data accumulation.
 */
export const StepForm = ({
  stepIndex,
  segments,
  questions,
  isLastStep,
  autoActionButton = false,
}: StepFormProps) => {
  const { currentStep, totalSteps, goToPrevStep, isSubmitting, tracking } = useStepForm();
  const { t } = useTranslation();
  const Renderer = use(PreviewRendererContext) ?? RenderStepPreviewInput;
  const fields = useMemo(() => getFieldsFromSegments(segments), [segments]);
  const stepQuestions = useMemo<QuestionRef[]>(() => questions ?? [], [questions]);
  const hasAuthoredButton = useMemo(
    () => segments.some((seg) => seg.type === "field" && seg.field.fieldType === "Button"),
    [segments],
  );
  const showAutoActionButton = autoActionButton && !hasAuthoredButton;

  const { form, formName, handleFieldFocus } = useStepPreviewForm({
    fields,
    questions: stepQuestions,
    stepIndex,
    isLastStep,
    formName: `stepForm-${stepIndex}`,
  });

  const groupedItems = useMemo(() => groupSegmentsForRendering(segments), [segments]);

  const formRef = useRef<HTMLFormElement>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  // Field-by-field shortcuts. Runs in CAPTURE phase so we intercept Enter
  // before child handlers (e.g. Base UI Checkbox toggling on Enter).
  // - Enter → advance/submit. Textareas keep native newline unless Cmd/Ctrl
  //   is held. Navigation buttons (Next/Submit, outside [data-bf-input]) keep
  //   native Enter. Widget triggers and checkbox/option buttons inside a
  //   question get Enter→advance; users press Space to interact with those.
  // - Esc → go back one step. When a popover is open, focus is inside the
  //   portaled content (outside the form), so this handler doesn't fire and
  //   the popover gets to close first.
  const handleFieldByFieldKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      if (currentStep === 0) return;
      // Defensive: bail if a popover trigger inside this form is currently
      // open. Focus should normally be in the popover (portaled), but if it
      // somehow stays on the trigger we don't want Esc to navigate away.
      if (formRef.current?.querySelector('[aria-expanded="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      goToPrevStep();
      return;
    }

    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    const isInQuestion = target.closest("[data-bf-input]") !== null;
    const isNavButton =
      (target.tagName === "BUTTON" || target.getAttribute("role") === "button") && !isInQuestion;
    if (isNavButton) return;

    const isTextarea = target.tagName === "TEXTAREA";
    const isMetaEnter = event.metaKey || event.ctrlKey;

    if (isTextarea && !isMetaEnter) return;

    // stopPropagation prevents widget keydown handlers (Base UI PopoverTrigger,
    // Checkbox, etc.) from also reacting to Enter — otherwise the popover
    // flashes open for a frame before the next step replaces it.
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

  // Compose form-level onFocus: textarea-state tracking (field-by-field
  // chrome) plus the per-Question analytics `start` emitter. Focus bubbles
  // so any input inside the form-tag reaches this handler.
  const handleFormFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    if (autoActionButton) handleTextareaFocusChange(true)(event);
    handleFieldFocus(event);
  };

  useFocusFirstField(formRef);

  // Fire one `view` event per Question in this Step on mount. No-ops in
  // builder previews (tracking is null) or before recordFormVisit resolves
  // (visitId is null). The last Question of the final Step carries the
  // `wasLastQuestion` flag so the funnel can identify terminal Questions.
  useMountEffect(() => {
    if (!(tracking?.visitId && tracking.mode)) return;
    const visitId = tracking.visitId;
    const lastIndex = stepQuestions.length - 1;
    for (let i = 0; i < stepQuestions.length; i++) {
      const q = stepQuestions[i];
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
        {groupedItems.map((item) => {
          if (item.type === "buttonGroup") {
            const prevButton = item.buttons.find((b) => b.buttonRole === "previous");
            const actionButton = item.buttons.find(
              (b) => b.buttonRole === "next" || b.buttonRole === "submit",
            );

            const groupKey = `button-group-${item.buttons.map((b) => b.id).join("-")}`;

            return (
              <div
                key={groupKey}
                className="flex w-full flex-row-reverse items-center justify-between"
                style={{ maxWidth: "var(--bf-input-width)" }}
              >
                {actionButton && (
                  <RenderStepButton
                    field={actionButton}
                    isSubmitting={isSubmitting}
                    onPrevious={currentStep > 0 ? goToPrevStep : undefined}
                    grouped
                  />
                )}
                {prevButton ? (
                  <RenderStepButton
                    field={prevButton}
                    isSubmitting={isSubmitting}
                    onPrevious={currentStep > 0 ? goToPrevStep : undefined}
                    grouped
                  />
                ) : (
                  <div /> // Spacer for justify-between
                )}
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

            if (field.fieldType === "Button") {
              return (
                <RenderStepButton
                  key={field.id}
                  field={field}
                  isSubmitting={isSubmitting}
                  onPrevious={currentStep > 0 ? goToPrevStep : undefined}
                  totalSteps={totalSteps}
                />
              );
            }

            return (
              <div key={field.id} className="w-full" data-bf-input data-bf-question-id={field.id}>
                <Renderer element={field} form={form} />
              </div>
            );
          }

          return null;
        })}

        {showAutoActionButton && (
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

type ButtonField = {
  id: string;
  name: string;
  fieldType: "Button";
  buttonText?: string;
  buttonRole: "next" | "previous" | "submit";
};

type GroupedSegment = PreviewSegment | { type: "buttonGroup"; buttons: ButtonField[] };

/**
 * Groups segments for rendering, combining all button FieldSegments into a single group.
 * Buttons are collected from anywhere in the step and rendered together at the end,
 * ensuring Previous and Next/Submit always appear on the same row.
 */
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

/**
 * Renders button elements for step forms.
 * Previous uses onClick, Next/Submit use type="submit" to trigger form validation.
 */
const RenderStepButton = ({
  field,
  isSubmitting,
  onPrevious,
  grouped = false,
  totalSteps = 1,
}: {
  field: ButtonField;
  isSubmitting: boolean;
  onPrevious?: () => void;
  grouped?: boolean;
  totalSteps?: number;
}) => {
  const { t } = useTranslation();
  const buttonRole = field.buttonRole || "submit";
  const defaultText =
    buttonRole === "next" ? t("next") : buttonRole === "previous" ? t("previous") : t("submit");
  const buttonText = field.buttonText || defaultText;

  // Matches editor button: h-8, 13px font, px-2.5
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

  const isMultiStep = totalSteps > 1;
  const submitButton = (
    <Button
      type="submit"
      style={buttonStyle}
      className="h-8 gap-1.5 rounded-lg px-2.5"
      disabled={isSubmitting}
    >
      {isSubmitting ? t("submitting") : buttonText}
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
