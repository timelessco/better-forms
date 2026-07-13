// Shared step-runner primitives for the twin step renderers (StepForm client + StepFormRSC).
// Keyboard/tracking hooks, the inner nav <Button>, the auto-action footer, and the branding badge
// live here so the two renderers can't drift.
import type { CSSProperties } from "react";

import { TextSwap } from "@/components/transitions/text-swap";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { useStepForm } from "@/contexts/step-form-context";
import type { PublicFormTracking } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { enqueueQuestionProgress } from "@/lib/analytics/track-client";
import { APP_NAME } from "@/lib/config/app-config";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import { cn } from "@/lib/utils";

/** Auto-action nav style: "hint" = keyboard-hint row (popup/embed); "footer" = full-page
 *  Back / Next → button row (Figma 27112:21064). */
type NavVariant = "hint" | "footer";

// Field-by-field shortcuts, CAPTURE phase (intercept Enter before child handlers e.g. Base UI Checkbox).
// Enter → advance/submit; textareas keep newline unless Cmd/Ctrl; nav buttons (outside [data-bf-input]) keep native; in-question widgets advance (Space to interact).
// Esc → back one step. Open popover: focus is portaled (outside form), handler doesn't fire, popover closes first.
export const useFieldByFieldKeyboard =
  (
    formRef: React.RefObject<HTMLFormElement | null>,
    { canGoBack, goToPrevStep }: { canGoBack: boolean; goToPrevStep: () => void },
  ) =>
  (event: React.KeyboardEvent<HTMLFormElement>) => {
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

// Fire one `view` per Question on mount. No-op if tracking null (builder preview) or visitId null (pre-recordFormVisit). Last Question of final Step flags `wasLastQuestion` for funnel terminal detection.
export const useQuestionViewTracking = (
  questions: QuestionRef[],
  { tracking, isLastStep }: { tracking: PublicFormTracking | null; isLastStep: boolean },
) => {
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
};

// Branding button-row layout driven by Buttons → Alignment (generate-theme-css BUTTON_ALIGN_BRANDING):
// left button → badge right, right → badge left, center → badge centered below. The badge's `order`
// (set via [data-bf-branding] in styles.css) does the left/right swap; the row owns direction/justify.
export const brandingRowStyle: CSSProperties = {
  flexDirection: "var(--bf-branding-dir, row)" as CSSProperties["flexDirection"],
  justifyContent: "var(--bf-branding-justify, space-between)",
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

// Matches editor button: h-8, 13px font, px-2.5.
const STEP_NAV_BTN_CLS = "h-8 gap-1.5 rounded-lg px-2.5";
const STEP_NAV_BTN_STYLE = { fontSize: "13px" } as const;

// Inner nav <Button> shared by both renderers. Previous = ghost-flat + leading chevron (never a
// filled primary, which would clash with the themed Submit/Next); next/submit = themed data-bf-button
// + trailing chevron. Divergent branding/justify wrappers stay in the callers.
export const StepNavButton = ({
  role,
  onPrevious,
  isSubmitting = false,
  children,
}: {
  role: "next" | "previous" | "submit";
  onPrevious?: () => void;
  isSubmitting?: boolean;
  children: React.ReactNode;
}) => {
  if (role === "previous") {
    return (
      <Button
        type="button"
        variant="ghost-flat"
        onClick={onPrevious}
        style={STEP_NAV_BTN_STYLE}
        className={cn(STEP_NAV_BTN_CLS, "text-gray-900")}
        prefix={<ChevronLeftIcon className="size-4" />}
      >
        {children}
      </Button>
    );
  }
  // Trailing chevron matches the Next button (Figma "→"); it also gives the label trailing room so
  // `.bf-themed` letter-spacing doesn't clip the last glyph ("Submit" → "Submi").
  return (
    <Button
      type="submit"
      data-bf-button=""
      style={STEP_NAV_BTN_STYLE}
      className={STEP_NAV_BTN_CLS}
      suffix={<ChevronRightIcon className="size-4" />}
      disabled={isSubmitting}
    >
      {children}
    </Button>
  );
};

// Auto Submit/Next footer for field-by-field steps (server/authored steps with no Button field).
// "footer" = full-page Back / Next → row (Figma 27112:21064); "hint" = keyboard-hint row (popup/embed).
// Submit label uses TextSwap in both variants; the submit control is suppressed on the final step
// when a "hide submit button" logic action fired. Reads nav state from StepFormContext.
export const AutoActionFooter = ({
  navVariant,
  branding,
  isLastStep,
  hideSubmit,
  isTextareaFocused,
}: {
  navVariant: NavVariant;
  branding: boolean;
  isLastStep: boolean;
  hideSubmit: boolean;
  isTextareaFocused: boolean;
}) => {
  const { canGoBack, goToPrevStep, isSubmitting } = useStepForm();
  const { t } = useTranslation();
  const submitVisible = !(hideSubmit && isLastStep);
  const label = isSubmitting ? t("submitting") : isLastStep ? t("submit") : t("next");

  if (navVariant === "footer") {
    // Full-page one-at-a-time footer (Figma 27112:21064): Back / Next grouped, "Made with Reform."
    // opposite per Buttons → Alignment. Enter/Esc still work (useFieldByFieldKeyboard).
    return (
      <div
        className={`flex w-full items-center gap-3 ${branding ? "" : "justify-between"}`}
        style={branding ? brandingRowStyle : undefined}
      >
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
          {submitVisible && (
            <Button
              type="submit"
              data-bf-button=""
              disabled={isSubmitting}
              style={{ fontSize: "14px" }}
              className="h-auto gap-2 rounded-[8px] px-2 py-1.5 font-[420] tracking-[0.28px]"
              suffix={<ArrowRightIcon className="size-4" />}
            >
              <TextSwap key={label}>{label}</TextSwap>
            </Button>
          )}
        </div>
        {branding && <FormBrandingBadge />}
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center gap-3 pt-2"
      style={{ maxWidth: "var(--bf-input-width)" }}
    >
      {submitVisible && (
        <Button
          type="submit"
          data-bf-button=""
          style={{ fontSize: "13px" }}
          className="h-9 gap-1.5 rounded-lg px-4"
          disabled={isSubmitting}
        >
          <TextSwap key={label}>{label}</TextSwap>
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
      {branding && <FormBrandingBadge className="ms-auto" />}
    </div>
  );
};
