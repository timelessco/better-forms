import { StaticContentBlock } from "@/components/form-components/static-content-block";
import { StepForm } from "@/components/form-components/step-form";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Image } from "@/components/ui/image";
import { COVER_SRCSET_WIDTHS } from "@/lib/vercel-image";
import { EmailVerificationContext } from "@/components/form-components/email-verification-context";
import type { EmailVerificationStore } from "@/components/form-components/email-verification-context";
import {
  FormPreviewReadOnlyContext,
  StepFormProvider,
  useStepForm,
} from "@/contexts/step-form-context";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { extractFormHeader } from "@/lib/editor/transform-plate-to-form";
import { DEFAULT_COVER_POSITION } from "@/lib/form-schema/form-header-factory";
import {
  chunkSegmentsForFieldByField,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import { FormLogicProvider } from "@/contexts/form-logic-context";
import { buildFormLogic } from "@/lib/logic/build-form-logic";
import { extractQuestionsForStep } from "@/lib/forms/extract-questions";
import type { QuestionRef } from "@/lib/forms/extract-questions";
import { APP_NAME, DEFAULT_ICON } from "@/lib/config/app-config";
import { cn, DEFAULT_ICON_NAME, isHexColor, isValidUrl } from "@/lib/utils";
import type { PublicFormSettings } from "@/types/form-settings";
import { IconPickerPreview } from "@/components/icon-picker";
import { SuccessCheck } from "@/components/transitions/success-check";
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import type { Value } from "platejs";
import { use, useEffect, useMemo, useRef, useState } from "react";

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

interface FormPreviewFromPlateProps {
  /** Plate editor content array */
  content: Value;
  /** Optional form title to display */
  title?: string;
  /** Optional icon emoji, URL, or 'default-icon' */
  icon?: string;
  /** Optional cover image URL or hex color code */
  cover?: string;
  /** Optional custom submit handler */
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  /** Whether to hide the form title */
  hideTitle?: boolean;
  /** Layout variant */
  layout?: "public" | "editor";
  /** Form settings for public forms */
  settings?: PublicFormSettings;
  formId?: string;
  /** Short ID for thank-you-page share URL. Omit in editor previews to suppress share UI. */
  shortId?: string;
  /** Form customization record for theming */
  customization?: Record<string, string> | null;
  /** Rehydrate step state from a server-side draft (resume-after-refresh). */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** Field-by-field bounds height to parent (popup context) not viewport units. For popup previews + real popup iframes. */
  isPopup?: boolean;
  /** Like isPopup (bounds height to parent) but without popup styling. For standard embed mockup w/ fixed-height iframe. */
  boundToParent?: boolean;
  /** Analytics base ({ visitId, visitorHash }). Public route only; undefined in builder previews disables tracking. */
  trackingBase?: TrackingBase;
  /** "Verify email" runtime store. Live public route passes mode:"live" (real OTP emails +
   * tokens sent on submit); undefined ⇒ mock (toast shows the code, nothing emailed). */
  emailVerification?: EmailVerificationStore;
  /** Read-only record view (submission single-view): stacks all steps, hides nav +
   * repeatable add/remove. Pair with an `inert` wrapper to fully disable interaction. */
  readOnly?: boolean;
}

const PAGE_MAX_WIDTH = {
  editor: `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`,
  public: `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`,
} as const;

// Form header (icon + cover). Mirrors editor's form-header.tsx rendering.
const PreviewFormHeader = ({
  title,
  icon,
  iconColor,
  cover,
  coverPosition,
  hideTitle,
  layout,
  customization,
  isPopup,
}: {
  title?: string;
  icon?: string;
  iconColor?: string | null;
  cover?: string;
  coverPosition?: number | null;
  hideTitle?: boolean;
  layout: "public" | "editor";
  customization?: Record<string, string> | null;
  isPopup?: boolean;
}) => {
  const [imageError, setImageError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const handleImageError = () => setImageError(true);
  const handleIconError = () => setIconError(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const hasCustomization = !!(customization && Object.keys(customization).length > 0);
  const isLogoMinimal =
    hasCustomization && !!customization?.logoWidth && Number.parseInt(customization.logoWidth) <= 0;
  const logoCircleSize =
    hasCustomization && customization?.logoWidth
      ? String(Math.max(48, Number.parseInt(customization.logoWidth)))
      : "100";

  // Check if we have valid cover (URL or hex color). Shown as a flush banner in the popup too
  // (Figma 26889); no cover → the uncovered title-only header (26883). Same for card + one-at-a-time.
  const hasCover = cover && (isHexColor(cover) || isValidUrl(cover)) && !imageError;
  // Popup: icon already shown as bubble, hide inside body (space + no dup).
  const hasIcon = !!icon && !iconError && !isPopup;
  const hasTitle = title && title.trim().length > 0 && !hideTitle;

  if (!hasCover && !hasIcon && !hasTitle) {
    return null;
  }

  // Full-bleed cover using container-width breakout (matches editor; cqw → nearest data-bf-cover-pane, viewport fallback)
  const coverClass =
    "relative w-[100cqw] left-[50%] right-[50%] -ml-[50cqw] -mr-[50cqw] h-[146px] sm:h-[243px]";

  const renderCover = () => {
    if (!cover) return null;

    if (isHexColor(cover)) {
      return <div className={coverClass} data-bf-cover style={{ backgroundColor: cover }} />;
    }

    if (isValidUrl(cover) && !imageError) {
      return (
        <div className={cn(coverClass, "overflow-hidden bg-muted")} data-bf-cover>
          {/* Ambient glow: blurred copy behind the card (Fit-only, gated by --bf-cover-glow). */}
          <Image
            src={cover}
            alt=""
            width={640}
            height={200}
            aria-hidden
            draggable={false}
            data-bf-cover-glow
          />
          {cover.includes("tint=true") && (
            <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
          )}
          <Image
            src={cover}
            alt="Form cover"
            width={1200}
            height={200}
            priority
            sizes="100vw"
            srcSetWidths={[...COVER_SRCSET_WIDTHS]}
            className={cn(
              "size-full object-cover",
              cover.includes("tint=true") && "relative z-0 brightness-60 grayscale",
            )}
            // Honor the reposition customization (coverPosition); default matches editor + Figma.
            style={{ objectPosition: `center ${coverPosition ?? DEFAULT_COVER_POSITION}%` }}
            onError={handleImageError}
          />
        </div>
      );
    }

    return null;
  };

  const iconWrapClass = cn("relative z-10 mb-1", hasCover ? "-mt-[50px]" : "mt-4 sm:mt-6");

  const renderIcon = () => {
    if (!icon) return null;

    if (icon === DEFAULT_ICON) {
      return (
        <div className={iconWrapClass} data-bf-logo-emoji-container={hasCover ? "true" : undefined}>
          <span data-bf-logo-icon={isLogoMinimal ? "minimal" : ""}>
            <IconPickerPreview
              icon={DEFAULT_ICON_NAME}
              iconColor={undefined}
              useThemeColor
              iconSize="48"
              size={logoCircleSize}
            />
          </span>
        </div>
      );
    }

    if (isValidUrl(icon) && !iconError) {
      return (
        <div className={iconWrapClass} data-bf-logo-container={hasCover ? "true" : undefined}>
          <Image
            src={icon}
            alt="Form icon"
            width={120}
            height={120}
            className="size-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
            data-bf-logo
            onError={handleIconError}
          />
        </div>
      );
    }

    return (
      <div className={iconWrapClass} data-bf-logo-emoji-container={hasCover ? "true" : undefined}>
        <span data-bf-logo-icon={isLogoMinimal ? "minimal" : ""}>
          <IconPickerPreview
            icon={icon}
            // Mirror form-header-node.tsx: theme color if any customization OR no explicit iconColor; explicit iconColor wins only on unthemed forms.
            // No `standaloneIcon` — its SVG renderer breaks currentColor through `<use href>` (silhouette paints black instead of text-primary-foreground).
            iconColor={hasCustomization ? undefined : iconColor || undefined}
            useThemeColor={hasCustomization || !iconColor}
            iconSize="48"
            size={logoCircleSize}
          />
        </span>
      </div>
    );
  };

  if (layout === "editor") {
    return (
      <div ref={headerRef} className="mb-7 w-full">
        {/* Cover sits in a page-width container so "fit" (calc(100% + 56px)) tracks the form
            width, not the full pane; "fill" still breaks out to 100vw via its var fallback. */}
        {hasCover && (
          <div className="mx-auto w-full" style={{ maxWidth: PAGE_MAX_WIDTH.editor }}>
            {renderCover()}
          </div>
        )}
        <div
          className="mx-auto w-full px-8 md:px-0"
          style={{ maxWidth: PAGE_MAX_WIDTH.editor }}
          data-bf-form-container
        >
          {hasIcon && renderIcon()}
          {/* Mirrors the editor's hover toolbar (form-header-node.tsx): carries no bottom gap, the
              title owns its top gap (mt-4). The h-8 reserves the toolbar's button row only when the
              editor would show one (missing cover/icon); with both present it is empty (0-height) so
              the icon's mb-1 and the title's mt-4 collapse to a constant 16px — matching the editor. */}
          <div
            className={cn(
              "flex gap-1",
              // Popup has no editor toolbar row → no spacer/margin; title sits at the card top (Figma).
              !isPopup && !hasCover && !hasIcon && "mt-8 sm:mt-12",
              !isPopup && hasCover && !hasIcon && "mt-4",
              hasIcon && "mt-0",
            )}
          >
            {!isPopup && (!hasCover || !hasIcon) && <div className="h-8" />}
          </div>
          {/* Title collapse: hideTitle toggle in the Share panel unmounts the h1; AnimatePresence
              animates the height/opacity/margin so the layout reflows smoothly instead of snapping.
              initial={false} skips the entrance on first paint (only toggles animate). The exiting
              clone keeps its last title text even though the prop is wiped to "" upstream. */}
          <LazyMotion features={domAnimation} strict>
            <AnimatePresence initial={false}>
              {hasTitle && (
                <m.h1
                  key="bf-title"
                  data-bf-title
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
                  }
                  style={{ textWrap: "pretty", overflow: "hidden" }}
                  className={cn(
                    "font-serif font-light -tracking-[0.03em] text-foreground",
                    // Popup card (Figma 26883/26889): compact 24px title, not the 48px full-page size.
                    isPopup ? "text-2xl" : "text-4xl sm:text-[48px]",
                  )}
                >
                  {title}
                </m.h1>
              )}
            </AnimatePresence>
          </LazyMotion>
        </div>
      </div>
    );
  }

  // For public layout, no negative margin tricks needed
  return (
    <div ref={headerRef} className="mb-7 w-full">
      {/* Cover in a page-width container so "fit" tracks form width; "fill" still hits 100vw. */}
      {hasCover && (
        <div className="mx-auto w-full" style={{ maxWidth: PAGE_MAX_WIDTH.public }}>
          {renderCover()}
        </div>
      )}

      <div
        className="mx-auto px-4"
        style={{ maxWidth: PAGE_MAX_WIDTH.public }}
        data-bf-form-container
      >
        <div className="flex flex-col">
          {hasIcon && renderIcon()}
          {hasTitle && (
            <h1
              data-bf-title
              style={{ textWrap: "pretty" }}
              className={cn(
                "font-serif font-light -tracking-[0.03em] text-foreground",
                isPopup ? "text-2xl" : "text-4xl sm:text-[48px]",
                // Popup header row (Figma 26883 py-12): 12px top so the title centers with the close.
                isPopup ? "mt-3" : hasIcon ? "mt-3" : "mt-6 sm:mt-8",
              )}
            >
              {title}
            </h1>
          )}
        </div>
      </div>
    </div>
  );
};

// "Share with others" row (link + copy) on thank-you page.
const ShareWithOthers = ({ shareUrl }: { shareUrl: string }) => (
  <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2 pt-4">
    <p className="text-sm text-muted-foreground">Share with others</p>
    <div className="flex h-[30px] w-full items-center gap-[6px] rounded-lg bg-muted/60 py-[3px] pr-[3px] pl-[10px]">
      <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground">
        {shareUrl}
      </span>
      <CopyButton
        text={shareUrl}
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 gap-1 rounded-[5px] border-none bg-background px-2 text-sm text-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] [&_svg]:size-[13px]"
      >
        Copy
      </CopyButton>
    </div>
  </div>
);

// Thank-you page is static-only — rendered via PlateStatic.
const RenderThankYouContent = ({
  nodes,
  onReset,
  shareUrl,
}: {
  nodes: Value;
  onReset?: () => void;
  shareUrl?: string;
}) => {
  const { t } = useTranslation();
  return (
    <div data-bf-field-list>
      <StaticContentBlock nodes={nodes} />
      {onReset && (
        <div className="flex justify-center pt-4">
          <Button
            type="button"
            onClick={onReset}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            {t("submitAnother")}
          </Button>
        </div>
      )}
      {shareUrl && <ShareWithOthers shareUrl={shareUrl} />}
    </div>
  );
};

const DefaultThankYou = ({ onReset, shareUrl }: { onReset?: () => void; shareUrl?: string }) => {
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
      {shareUrl && <ShareWithOthers shareUrl={shareUrl} />}
    </div>
  );
};

// Renders Plate content as a functional form preview. Multi-step via page-break dividers, one form per step (StepFormContext). Static content via PlateStatic; fields use custom components.
export const FormPreviewFromPlate = ({
  content,
  title: legacyTitle,
  icon: legacyIcon,
  cover: legacyCover,
  onSubmit,
  hideTitle,
  layout = "public",
  settings,
  formId,
  shortId,
  customization,
  initialFormData,
  initialCurrentStep,
  isPopup = false,
  boundToParent = false,
  trackingBase,
  emailVerification,
  readOnly = false,
}: FormPreviewFromPlateProps) => {
  const headerFromContent = useMemo(() => extractFormHeader(content), [content]);
  const hasHeaderNode = headerFromContent !== null;

  const title = hideTitle ? "" : hasHeaderNode ? headerFromContent.title : legacyTitle;
  const icon = hasHeaderNode ? (headerFromContent.icon ?? undefined) : legacyIcon;
  const iconColor = hasHeaderNode ? headerFromContent.iconColor : null;
  const cover = hasHeaderNode ? (headerFromContent.cover ?? undefined) : legacyCover;
  const coverPosition = hasHeaderNode ? headerFromContent.coverPosition : null;

  const { steps: rawSteps, thankYouNodes } = useMemo(
    () => transformPlateForPreview(content),
    [content],
  );

  const steps = useMemo(
    () =>
      settings?.presentationMode === "field-by-field"
        ? chunkSegmentsForFieldByField(rawSteps)
        : rawSteps,
    [rawSteps, settings?.presentationMode],
  );

  // Pre-compute per-Step Question lists so analytics emitters don't re-walk Plate tree each render. questionIndex accumulates across Steps.
  const stepQuestions: QuestionRef[][] = useMemo(
    () => steps.map((_, idx) => extractQuestionsForStep(steps, idx)),
    [steps],
  );

  const isFieldByFieldMode = settings?.presentationMode === "field-by-field";

  // Conditional-logic runtime context. Card mode aligns step ids with the ruleset
  // extractor; field-by-field uses synthetic ids (step-level jumps degrade to fall-through).
  const formLogic = useMemo(
    () => buildFormLogic(content, steps, isFieldByFieldMode),
    [content, steps, isFieldByFieldMode],
  );

  if (steps.length === 0 || steps.flat().length === 0) {
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

  // Per ADR-0002 tracking always on — card forms still emit per-Question view/start/complete (Step mounts once, focus per Question, complete per Question on Submit).
  const isFieldByField = settings?.presentationMode === "field-by-field";
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
    <FormPreviewReadOnlyContext.Provider value={readOnly}>
      <EmailVerificationContext.Provider value={emailVerification ?? null}>
        <StepFormProvider
          totalSteps={steps.length}
          onSubmit={onSubmit}
          formId={formId}
          saveAnswersForLater={settings?.saveAnswersForLater}
          initialFormData={initialFormData}
          initialCurrentStep={initialCurrentStep}
          tracking={tracking}
        >
          <FormLogicProvider value={formLogic}>
            <FormPreviewContent
              shortId={shortId}
              steps={steps}
              stepQuestions={stepQuestions}
              thankYouNodes={thankYouNodes}
              title={title}
              icon={icon}
              iconColor={iconColor}
              cover={cover}
              coverPosition={coverPosition}
              hideTitle={hideTitle}
              layout={layout}
              settings={settings}
              customization={customization}
              isPopup={isPopup}
              boundToParent={boundToParent}
            />
          </FormLogicProvider>
        </StepFormProvider>
      </EmailVerificationContext.Provider>
    </FormPreviewReadOnlyContext.Provider>
  );
};

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  }),
};

const useRedirectCountdown = (isSubmitted: boolean, settings?: PublicFormSettings) => {
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

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
          if (settings.redirectUrl) {
            window.location.href = settings.redirectUrl;
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, settings?.redirectOnCompletion, settings?.redirectUrl, settings?.redirectDelay]);

  return redirectCountdown;
};

interface ThankYouViewProps {
  thankYouNodes: Value | null;
  onReset?: () => void;
  shareUrl?: string;
  redirectCountdown: number | null;
}

const ThankYouView = ({
  thankYouNodes,
  onReset,
  shareUrl,
  redirectCountdown,
}: ThankYouViewProps) => {
  const { t } = useTranslation();
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {thankYouNodes && thankYouNodes.length > 0 ? (
          <RenderThankYouContent nodes={thankYouNodes} onReset={onReset} shareUrl={shareUrl} />
        ) : (
          <DefaultThankYou onReset={onReset} shareUrl={shareUrl} />
        )}
        {redirectCountdown !== null && (
          <p className="mt-4 text-center text-muted-foreground">
            {t("redirecting", {
              n: redirectCountdown,
              s: redirectCountdown !== 1 ? "s" : "",
            })}
          </p>
        )}
      </m.div>
    </LazyMotion>
  );
};

interface LayoutProps {
  steps: PreviewSegment[][];
  /** Per-step Questions (non-Button fields) w/ global indices, for analytics emitters. */
  stepQuestions: QuestionRef[][];
  thankYouNodes: Value | null;
  title?: string;
  icon?: string;
  iconColor?: string | null;
  cover?: string;
  coverPosition?: number | null;
  hideTitle?: boolean;
  layout: "public" | "editor";
  settings?: PublicFormSettings;
  customization?: Record<string, string> | null;
  isPopup?: boolean;
  boundToParent?: boolean;
  shareUrl?: string;
  redirectCountdown: number | null;
}

const FieldByFieldLayout = ({
  steps,
  stepQuestions,
  thankYouNodes,
  title,
  icon,
  cover,
  coverPosition,
  hideTitle,
  layout,
  settings,
  customization,
  isPopup,
  shareUrl,
  redirectCountdown,
}: LayoutProps) => {
  const { currentStep, isSubmitted, direction, reset } = useStepForm();
  const isLastStep = currentStep === steps.length - 1;
  const currentStepSegments = steps[currentStep] || [];
  const currentStepQuestions = stepQuestions[currentStep] || [];
  // Re-mount StepForm when the field config changes (creator edits e.g.
  // initialRows / placeholder / required) so TanStack form re-reads
  // defaultValues — without this, edits in the builder don't reflect in the
  // preview because useAppForm captures defaults only at first mount.
  // Derived from `steps` + `currentStep` (stable refs) instead of
  // `currentStepSegments` (re-created via `|| []` each render).
  const segmentsKey = useMemo(() => JSON.stringify(steps[currentStep] || []), [steps, currentStep]);

  // One-at-a-time everywhere (full-page, popup AND embed): SAME header/container as card mode
  // (PreviewFormHeader — title + optional cover, no full-bleed bg); only the below-header body
  // changes to the Figma Back/Next footer (27112:20994 / 27015:16542 / 27112:20302). The popup
  // gets its compact title + flush cover from POPUP_FORM_STYLE_VARS on the wrapper.
  return (
    <div className="w-full">
      <PreviewFormHeader
        title={title}
        icon={icon}
        cover={cover}
        coverPosition={coverPosition}
        hideTitle={hideTitle}
        layout={layout}
        customization={customization}
        isPopup={isPopup}
      />

      {/* No progress bar in one-at-a-time (removed by design). */}
      <div
        className={cn("mx-auto", layout === "editor" ? "w-full px-8 md:px-0" : "px-4")}
        style={{
          maxWidth: PAGE_MAX_WIDTH[layout],
          ...(layout === "editor"
            ? ({ "--bf-spacing": "0.5rem" } as React.CSSProperties)
            : undefined),
        }}
        data-bf-form-container
      >
        {isSubmitted ? (
          <ThankYouView
            thankYouNodes={thankYouNodes}
            onReset={reset}
            shareUrl={shareUrl}
            redirectCountdown={redirectCountdown}
          />
        ) : (
          <LazyMotion features={domAnimation} strict>
            <AnimatePresence mode="wait" custom={direction}>
              <m.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                className="w-full"
              >
                <StepForm
                  key={`${currentStep}:${segmentsKey}`}
                  stepIndex={currentStep}
                  segments={currentStepSegments}
                  questions={currentStepQuestions}
                  isLastStep={isLastStep}
                  autoActionButton
                  navVariant="footer"
                  branding={Boolean(settings?.branding)}
                />
              </m.div>
            </AnimatePresence>
          </LazyMotion>
        )}
      </div>
    </div>
  );
};

// Popup branding (Figma 26075-12633): a full-width footer BAR (gray/100 fill, centered) at the
// popup's bottom edge — distinct from the inline submit-row badge used by embed/full-page.
// "Made with " gray/600 (Inter) + the Timeless Serif italic "Reform." wordmark.
const PopupBrandingBar = () => (
  <div className="flex items-center justify-center bg-gray-100 px-2.5 py-[13px]">
    <span
      // Inline fontSize: the form's base size out-races Tailwind utilities (see FormBrandingBadge).
      style={{ fontSize: "14px" }}
      className="leading-[1.15] font-[420] tracking-[0.28px] text-gray-600"
    >
      Made with{" "}
      <span className="[font-family:'Timeless_Serif',ui-serif,Georgia,serif] italic">
        {APP_NAME}.
      </span>
    </span>
  </div>
);

const LinearLayout = ({
  steps,
  stepQuestions,
  title,
  icon,
  cover,
  coverPosition,
  hideTitle,
  layout,
  settings,
  customization,
  isPopup,
}: LayoutProps) => {
  const { currentStep, totalSteps, direction } = useStepForm();
  // Read-only record view (submission single-view): stack every step, drop the
  // step animation + nav so all answers render in one scroll.
  const readOnly = use(FormPreviewReadOnlyContext);
  const isLastStep = currentStep === steps.length - 1;
  const currentStepSegments = steps[currentStep] || [];
  const currentStepQuestions = stepQuestions[currentStep] || [];
  // Re-mount StepForm when the field config changes (creator edits e.g.
  // initialRows / placeholder / required) so TanStack form re-reads
  // defaultValues — without this, edits in the builder don't reflect in the
  // preview because useAppForm captures defaults only at first mount.
  // Derived from `steps` + `currentStep` (stable refs) instead of
  // `currentStepSegments` (re-created via `|| []` each render).
  const segmentsKey = useMemo(() => JSON.stringify(steps[currentStep] || []), [steps, currentStep]);

  return (
    <div className="w-full">
      <PreviewFormHeader
        title={title}
        icon={icon}
        cover={cover}
        coverPosition={coverPosition}
        hideTitle={hideTitle}
        layout={layout}
        customization={customization}
        isPopup={isPopup}
      />

      {settings?.progressBar && totalSteps > 1 && (
        <div
          className={cn("mx-auto mb-6", layout === "editor" ? "w-full px-8 md:px-0" : "px-4")}
          style={{ maxWidth: PAGE_MAX_WIDTH[layout] }}
          data-bf-form-container
        >
          <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
        </div>
      )}

      <div
        className={cn("mx-auto", layout === "editor" ? "w-full px-8 md:px-0" : "px-4")}
        style={{
          maxWidth: PAGE_MAX_WIDTH[layout],
          ...(layout === "editor"
            ? ({ "--bf-spacing": "0.5rem" } as React.CSSProperties)
            : undefined),
        }}
        data-bf-form-container
      >
        {readOnly ? (
          <div className="flex w-full flex-col gap-8">
            {steps.map((segments, idx) => (
              <StepForm
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={idx}
                stepIndex={idx}
                segments={segments}
                questions={stepQuestions[idx] || []}
                isLastStep={idx === steps.length - 1}
                branding={false}
              />
            ))}
          </div>
        ) : (
          <LazyMotion features={domAnimation} strict>
            <AnimatePresence mode="wait" custom={direction}>
              <m.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                className="w-full"
              >
                <StepForm
                  key={`${currentStep}:${segmentsKey}`}
                  stepIndex={currentStep}
                  segments={currentStepSegments}
                  questions={currentStepQuestions}
                  isLastStep={isLastStep}
                  // Popup uses the full-width footer bar below instead of the inline submit-row badge.
                  branding={Boolean(settings?.branding) && !isPopup}
                />
              </m.div>
            </AnimatePresence>
          </LazyMotion>
        )}
      </div>
      {isPopup && settings?.branding && <PopupBrandingBar />}
    </div>
  );
};

const FormPreviewContent = (props: {
  steps: PreviewSegment[][];
  stepQuestions: QuestionRef[][];
  thankYouNodes: Value | null;
  title?: string;
  icon?: string;
  iconColor?: string | null;
  cover?: string;
  coverPosition?: number | null;
  hideTitle?: boolean;
  layout: "public" | "editor";
  settings?: PublicFormSettings;
  customization?: Record<string, string> | null;
  isPopup?: boolean;
  boundToParent?: boolean;
  shortId?: string;
}) => {
  const { isSubmitted, reset } = useStepForm();
  const { shortId, settings, layout, isFieldByField, ...rest } = {
    ...props,
    isFieldByField: props.settings?.presentationMode === "field-by-field",
  };
  const redirectCountdown = useRedirectCountdown(isSubmitted, settings);

  // Thank-you share URL. Built from shortId since editor preview's window.location is the editor route, not the public URL.
  const shareUrl = useMemo(() => {
    if (!shortId || typeof window === "undefined") return undefined;
    return `${window.location.origin}/forms/${shortId}`;
  }, [shortId]);

  // Thank-you after submit (non-field-by-field). Field-by-field renders its own in the shared shell below.
  if (isSubmitted && !isFieldByField) {
    return (
      <div className="w-full">
        <PreviewFormHeader
          title={rest.title}
          icon={rest.icon}
          iconColor={rest.iconColor}
          cover={rest.cover}
          coverPosition={rest.coverPosition}
          hideTitle={rest.hideTitle}
          layout={layout}
          customization={rest.customization}
          isPopup={rest.isPopup}
        />
        <div
          className={cn("mx-auto w-full", layout === "editor" ? "px-8 md:px-0" : "px-4")}
          style={{ maxWidth: PAGE_MAX_WIDTH[layout] }}
          data-bf-form-container
        >
          <ThankYouView
            thankYouNodes={rest.thankYouNodes}
            onReset={reset}
            shareUrl={shareUrl}
            redirectCountdown={redirectCountdown}
          />
        </div>
      </div>
    );
  }

  const layoutProps: LayoutProps = {
    ...rest,
    settings,
    layout,
    shareUrl,
    redirectCountdown,
  };

  return isFieldByField ? (
    <FieldByFieldLayout {...layoutProps} />
  ) : (
    <LinearLayout {...layoutProps} />
  );
};
