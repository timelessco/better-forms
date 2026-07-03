import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { APP_NAME } from "@/lib/config/app-config";
import { TextSwap } from "@/components/transitions/text-swap";
import { use, useMemo, useRef, useState } from "react";
import { useFocusFirstField } from "@/hooks/use-focus-first-field";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { Button } from "@/components/ui/button";
import { FormPreviewReadOnlyContext, useStepForm } from "@/contexts/step-form-context";
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
  const { t } = useTranslation();
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
  // Branding only rides the final Submit row (last step).
  const showBranding = branding && isLastStep;

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
              <div
                key={groupKey}
                className="flex w-full flex-col gap-2"
                style={{ maxWidth: "var(--bf-input-width)" }}
              >
                <div className="flex w-full flex-row-reverse items-center justify-between">
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
                {/* Multi-step submit row is full (Prev + Submit) — branding sits right-aligned below. */}
                {showBranding && (
                  <div className="flex justify-end">
                    <FormBrandingBadge />
                  </div>
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

        {!readOnly &&
          showAutoActionButton &&
          !(hideSubmit && isLastStep) &&
          (navVariant === "footer" ? (
            // Full-page one-at-a-time footer (Figma 27112:21064): Back / Next → on the left,
            // "Made with Reform." on the right. Enter/Esc still work (handleFieldByFieldKeyDown).
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
                <Button
                  type="submit"
                  data-bf-button=""
                  disabled={isSubmitting}
                  style={{ fontSize: "14px" }}
                  className="h-auto gap-2 rounded-[8px] px-2 py-1.5 font-[420] tracking-[0.28px]"
                  suffix={<ArrowRightIcon className="size-4" />}
                >
                  {(() => {
                    const label = isSubmitting
                      ? t("submitting")
                      : isLastStep
                        ? t("submit")
                        : t("next");
                    return <TextSwap key={label}>{label}</TextSwap>;
                  })()}
                </Button>
              </div>
              {branding && <FormBrandingBadge />}
            </div>
          ) : (
            <div
              className="flex w-full items-center gap-3 pt-2"
              style={{ maxWidth: "var(--bf-input-width)" }}
            >
              <Button
                type="submit"
                data-bf-button=""
                style={{ fontSize: "13px" }}
                className="h-9 gap-1.5 rounded-lg px-4"
                disabled={isSubmitting}
              >
                {(() => {
                  const label = isSubmitting
                    ? t("submitting")
                    : isLastStep
                      ? t("submit")
                      : t("next");
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
              {showBranding && <FormBrandingBadge className="ms-auto" />}
            </div>
          ))}
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

// Inline form-footer branding (Figma 25778-10461): "Made with Reform." — Inter gray/500 + the
// Timeless Serif "Reform." wordmark. Renders beside the final Submit when settings.branding is on.
export const FormBrandingBadge = ({ className }: { className?: string }) => (
  <span
    // Inline fontSize: the form applies a base size via a non-layered rule that out-races Tailwind
    // utilities (same reason the submit button pins fontSize inline). Figma = 14px.
    style={{ fontSize: "14px" }}
    // weight 420 + 0.28px tracking come from the shared rule (data-bf-branding) since the
    // .bf-themed variation(450)/letter-spacing(0.14px) defaults would otherwise override classes.
    data-bf-branding
    className={`shrink-0 leading-[1.15] text-gray-500 ${className ?? ""}`}
  >
    Made with{" "}
    <span className="[font-family:'Timeless_Serif',ui-serif,Georgia,serif] italic">
      {APP_NAME}.
    </span>
  </span>
);

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
      <div
        className="mb-4 flex"
        style={{
          maxWidth: "var(--bf-input-width)",
          // Button alignment (Buttons → Alignment); fallback keeps the prior right-aligned default.
          justifyContent: "var(--bf-button-justify, flex-end)",
        }}
      >
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
    // Branding (Figma 25778-10461) rides the submit row right-aligned (justify-between); keep that
    // fixed. Otherwise the button row honors --bf-button-justify (Buttons → Alignment), fallback to
    // the prior default (multi-step right, single-step left).
    <div
      className={`flex items-center ${showBranding ? "justify-between gap-3" : ""}`}
      style={{
        maxWidth: "var(--bf-input-width)",
        ...(showBranding
          ? {}
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
