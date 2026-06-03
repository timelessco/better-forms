import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { TextSwap } from "@/components/transitions/text-swap";
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
  /** Pre-computed Questions w/ global indices for analytics emitters. Omittable in non-tracking previews (emitters no-op when tracking null). */
  questions?: QuestionRef[];
  isLastStep: boolean;
  autoActionButton?: boolean;
}

// One step's form instance. Nav + data accumulation via StepFormContext.
export const StepForm = ({
  stepIndex,
  segments,
  questions,
  isLastStep,
  autoActionButton = false,
}: StepFormProps) => {
  const { totalSteps, goToPrevStep, canGoBack, isSubmitting, tracking } = useStepForm();
  const { t } = useTranslation();
  const Renderer = use(PreviewRendererContext) ?? RenderStepPreviewInput;
  const fields = useMemo(() => getFieldsFromSegments(segments), [segments]);
  const stepQuestions = useMemo<QuestionRef[]>(() => questions ?? [], [questions]);
  const hasAuthoredButton = useMemo(
    () => segments.some((seg) => seg.type === "field" && seg.field.fieldType === "Button"),
    [segments],
  );
  const showAutoActionButton = autoActionButton && !hasAuthoredButton;

  const { form, formName, handleFieldFocus, visibleFieldNames, lockedFieldNames, hideSubmit } =
    useStepPreviewForm({
      fields,
      questions: stepQuestions,
      stepIndex,
      isLastStep,
      formName: `stepForm-${stepIndex}`,
    });

  const groupedItems = useMemo(() => groupSegmentsForRendering(segments), [segments]);

  const formRef = useRef<HTMLFormElement>(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  // Field-by-field shortcuts, CAPTURE phase (intercept Enter before child handlers e.g. Base UI Checkbox).
  // Enter → advance/submit; textareas keep newline unless Cmd/Ctrl; nav buttons (outside [data-bf-input]) keep native; in-question widgets advance (Space to interact).
  // Esc → back one step. Open popover: focus is portaled (outside form), handler doesn't fire, popover closes first.
  const handleFieldByFieldKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    // React events bubble the React tree, so portaled UI (combobox, popovers) still reaches this handler. Bail if target isn't a DOM descendant of form, so popups handle own Enter/Esc (e.g. phone-input country combobox).
    const target = event.target as HTMLElement | null;
    if (target && formRef.current && !formRef.current.contains(target)) return;

    if (event.key === "Escape") {
      if (!canGoBack) return;
      // Defensive: bail if an in-form popover trigger is open — Esc shouldn't navigate away if focus stayed on trigger.
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

    // stopPropagation stops widget keydown handlers (PopoverTrigger, Checkbox) reacting to Enter, else popover flashes open for a frame before next step.
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

  // Form-level onFocus: textarea-state tracking + per-Question analytics `start`. Focus bubbles so any input reaches here.
  const handleFormFocus = (event: React.FocusEvent<HTMLFormElement>) => {
    if (autoActionButton) handleTextareaFocusChange(true)(event);
    handleFieldFocus(event);
  };

  useFocusFirstField(formRef);

  // Fire one `view` per Question on mount. No-op if tracking null (builder preview) or visitId null (pre-recordFormVisit). Last Question of final Step flags `wasLastQuestion` for funnel terminal detection.
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
                    onPrevious={canGoBack ? goToPrevStep : undefined}
                    hideSubmit={hideSubmit}
                    grouped
                  />
                )}
                {prevButton ? (
                  <RenderStepButton
                    field={prevButton}
                    isSubmitting={isSubmitting}
                    onPrevious={canGoBack ? goToPrevStep : undefined}
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

            // Conditional logic: skip fields the engine has hidden (value retained in form state).
            if (
              field.fieldType !== "Button" &&
              visibleFieldNames &&
              !visibleFieldNames.has(field.name)
            ) {
              return null;
            }

            if (field.fieldType === "Button") {
              return (
                <RenderStepButton
                  key={field.id}
                  field={field}
                  isSubmitting={isSubmitting}
                  onPrevious={canGoBack ? goToPrevStep : undefined}
                  hideSubmit={hideSubmit}
                  totalSteps={totalSteps}
                />
              );
            }

            // Fields auto-filled by a "Set value" action are locked (non-interactive)
            // while the controlling logic is active; the value still submits.
            const locked = lockedFieldNames.has(field.name);
            return (
              <div
                key={field.id}
                className={`w-full${locked ? " opacity-75" : ""}`}
                data-bf-input
                data-bf-question-id={field.id}
                inert={locked || undefined}
                aria-disabled={locked || undefined}
              >
                <Renderer element={field} form={form} />
              </div>
            );
          }

          return null;
        })}

        {showAutoActionButton && !(hideSubmit && isLastStep) && (
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
              {(() => {
                const label = isSubmitting ? t("submitting") : isLastStep ? t("submit") : t("next");
                return <TextSwap key={label}>{label}</TextSwap>;
              })()}
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
            {canGoBack && (
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
}: {
  field: ButtonField;
  isSubmitting: boolean;
  onPrevious?: () => void;
  grouped?: boolean;
  totalSteps?: number;
  hideSubmit?: boolean;
}) => {
  const { t } = useTranslation();
  const buttonRole = field.buttonRole || "submit";

  // Conditional "hide submit button" action suppresses the completion control.
  if (hideSubmit && buttonRole === "submit") return null;
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
      data-bf-button
      style={buttonStyle}
      className="h-8 gap-1.5 rounded-lg px-2.5"
      disabled={isSubmitting}
    >
      {(() => {
        const label = isSubmitting ? t("submitting") : buttonText;
        return <TextSwap key={label}>{label}</TextSwap>;
      })()}
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
