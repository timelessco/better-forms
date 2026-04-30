import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { useContext, useMemo, useRef } from "react";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Button } from "@/components/ui/button";
import { useStepForm } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useStepPreviewForm } from "@/hooks/use-preview-form";
import { fireQuestionProgress } from "@/lib/analytics/track-client";
import { getFieldsFromSegments } from "@/lib/editor/transform-plate-for-preview";
import type { FieldSegment, PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import { StaticContentBlock } from "./static-content-block";
import { PreviewRendererContext, RenderStepPreviewInput } from "./render-step-preview-input";

interface StepFormProps {
  stepIndex: number;
  segments: PreviewSegment[];
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
  isLastStep,
  autoActionButton = false,
}: StepFormProps) => {
  const { currentStep, totalSteps, goToPrevStep, isSubmitting, tracking } = useStepForm();
  const { t } = useTranslation();
  const Renderer = useContext(PreviewRendererContext) ?? RenderStepPreviewInput;
  const fields = useMemo(() => getFieldsFromSegments(segments), [segments]);
  const hasAuthoredButton = useMemo(
    () => segments.some((seg) => seg.type === "field" && seg.field.fieldType === "Button"),
    [segments],
  );
  const showAutoActionButton = autoActionButton && !hasAuthoredButton;

  const { form, formName } = useStepPreviewForm({
    fields,
    stepIndex,
    isLastStep,
    formName: `stepForm-${stepIndex}`,
  });

  const groupedItems = useMemo(() => groupSegmentsForRendering(segments), [segments]);

  const formRef = useRef<HTMLFormElement>(null);

  // Field-by-field uses Shift+Enter to advance because plain Enter is needed
  // for newlines inside textareas. Suppress plain-Enter submit on non-textarea
  // inputs to keep the shortcut consistent across every step.
  const handleFieldByFieldKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }
    // Allow Enter to keep its native behavior on textareas (newline) and on
    // buttons (click — so Tab → Next + Enter still advances). Only suppress
    // the implicit form submit triggered by Enter on a single-line input.
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT") {
      event.preventDefault();
    }
  };

  useFocusFirstField(formRef);

  // Fire `view` analytics event when this step mounts. No-ops in builder
  // previews (tracking is null) or single-page forms (mode is null) or
  // before recordFormVisit resolves (visitId is null).
  useMountEffect(() => {
    if (!(tracking?.visitId && tracking.mode)) return;
    const isFieldByField = tracking.mode === "field-by-field";
    const firstField = fields.length > 0 ? fields[0] : null;
    const questionId = isFieldByField && firstField ? firstField.id : `step_${stepIndex}`;
    const questionType = isFieldByField && firstField ? (firstField.fieldType ?? null) : null;
    fireQuestionProgress({
      visitId: tracking.visitId,
      formId: tracking.formId,
      visitorHash: tracking.visitorHash,
      questionId,
      questionType,
      questionIndex: stepIndex,
      event: "view",
      wasLastQuestion: isLastStep,
    });
  });

  return (
    <form.AppForm>
      <form.Form
        id={formName}
        ref={formRef}
        noValidate
        data-bf-field-list
        onKeyDown={autoActionButton ? handleFieldByFieldKeyDown : undefined}
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
              <div key={field.id} className="w-full" data-bf-input>
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
              <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                Shift
              </kbd>
              +
              <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-medium text-foreground">
                Enter
              </kbd>
              <span aria-hidden="true">↵</span>
            </span>
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
