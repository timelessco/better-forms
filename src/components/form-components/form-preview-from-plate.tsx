import { StaticContentBlock } from "@/components/form-components/static-content-block";
import { StepForm } from "@/components/form-components/step-form";
import { ProgressBar } from "@/routes/forms/-components/progress-bar";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { StepFormProvider, useStepForm } from "@/contexts/step-form-context";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { extractFormHeader } from "@/lib/editor/transform-plate-to-form";
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import { DEFAULT_ICON } from "@/lib/config/app-config";
import { cn, DEFAULT_ICON_NAME, isValidUrl } from "@/lib/utils";
import type { PublicFormSettings } from "@/types/form-settings";
import { IconPickerPreview } from "@/components/icon-picker";
import { AnimatePresence, motion } from "motion/react";
import type { Value } from "platejs";
import { useEffect, useMemo, useRef, useState } from "react";

const SuccessCheckmarkIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-green-600"
  >
    <title>Success checkmark</title>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

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
  /** Form ID for localStorage persistence */
  formId?: string;
  /** Form customization record for theming */
  customization?: Record<string, string> | null;
  /** Rehydrate step state from a server-side draft (resume-after-refresh). */
  initialFormData?: Record<string, unknown>;
  initialCurrentStep?: number;
  /** When true, field-by-field mode bounds height to its parent (popup context)
   *  instead of using viewport units. Use for popup previews and real popup
   *  iframes — the parent already provides a definite bounded height. */
  isPopup?: boolean;
  /** Analytics tracking base ({ visitId, visitorHash }). Only passed by the
   * public form route — builder previews leave this undefined to disable
   * tracking. */
  trackingBase?: TrackingBase;
}

export const isHexColor = (str: string): boolean => /^#([0-9A-Fa-f]{3}){1,2}$/.test(str);

const PAGE_MAX_WIDTH = {
  editor: `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`,
  public: `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`,
} as const;

/**
 * Form header component with proper icon and cover handling
 * Matches the editor's form-header.tsx rendering patterns
 */
const PreviewFormHeader = ({
  title,
  icon,
  iconColor,
  cover,
  hideTitle,
  layout,
  customization,
  isPopup,
}: {
  title?: string;
  icon?: string;
  iconColor?: string | null;
  cover?: string;
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

  const hasCustomization = !!(customization && Object.keys(customization).length > 0);
  const isLogoMinimal =
    hasCustomization && !!customization?.logoWidth && Number.parseInt(customization.logoWidth) <= 0;
  const logoCircleSize =
    hasCustomization && customization?.logoWidth
      ? String(Math.max(48, Number.parseInt(customization.logoWidth)))
      : "100";

  // Check if we have valid cover (URL or hex color)
  const hasCover = cover && (isHexColor(cover) || isValidUrl(cover)) && !imageError;
  // In popup mode the icon is already shown as the popup bubble, so hide it
  // inside the popup body to save space and avoid duplication.
  const hasIcon = !!icon && !iconError && !isPopup;
  const hasTitle = title && title.trim().length > 0 && !hideTitle;

  if (!hasCover && !hasIcon && !hasTitle) {
    return null;
  }

  // Full-bleed cover using viewport-width trick (matches editor's form-header-node.tsx)
  const coverClass =
    "relative w-screen left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] h-[120px] sm:h-[200px]";

  const renderCover = () => {
    if (!cover) return null;

    if (isHexColor(cover)) {
      return <div className={coverClass} data-bf-cover style={{ backgroundColor: cover }} />;
    }

    if (isValidUrl(cover) && !imageError) {
      return (
        <div className={cn(coverClass, "overflow-hidden bg-muted")} data-bf-cover>
          {cover.includes("tint=true") && (
            <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
          )}
          <img
            src={cover}
            alt="Form cover"
            width={1200}
            height={200}
            className={cn(
              "h-full w-full object-cover",
              cover.includes("tint=true") && "relative z-0 brightness-60 grayscale",
            )}
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
              standaloneIcon
            />
          </span>
        </div>
      );
    }

    if (isValidUrl(icon) && !iconError) {
      return (
        <div className={iconWrapClass} data-bf-logo-container={hasCover ? "true" : undefined}>
          <img
            src={icon}
            alt="Form icon"
            width={120}
            height={120}
            className="h-[100px] w-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
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
            iconColor={iconColor || undefined}
            useThemeColor={!iconColor}
            iconSize="48"
            size={logoCircleSize}
            standaloneIcon
          />
        </span>
      </div>
    );
  };

  if (layout === "editor") {
    return (
      <div ref={headerRef} className="mb-4 w-full sm:mb-8">
        {hasCover && renderCover()}
        <div
          className="mx-auto w-full px-8 md:px-0"
          style={{ maxWidth: PAGE_MAX_WIDTH.editor }}
          data-bf-form-container
        >
          {hasIcon && renderIcon()}
          {/* Spacer matching the editor's hover toolbar (Customize / Add icon / Add cover buttons + margin) */}
          <div
            className={cn(
              "mb-2 flex gap-1",
              !hasCover && !hasIcon && "mt-8 sm:mt-12",
              hasCover && !hasIcon && "mt-4",
              !hasCover && hasIcon && "mt-0",
            )}
          >
            <div className="h-8" />
          </div>
          {hasTitle && (
            <h1
              data-bf-title
              style={{ textWrap: "pretty" }}
              className="font-serif text-4xl font-light -tracking-[0.03em] text-foreground sm:text-[48px]"
            >
              {title}
            </h1>
          )}
        </div>
      </div>
    );
  }

  // For public layout, no negative margin tricks needed
  return (
    <div ref={headerRef} className="mb-4 w-full sm:mb-8">
      {hasCover && renderCover()}

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
              className={`font-serif text-4xl font-light -tracking-[0.03em] text-foreground sm:text-[48px] ${hasIcon ? "mt-3 sm:mt-4" : "mt-6 sm:mt-8"}`}
            >
              {title}
            </h1>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact "Share with others" row — link + copy button — shown on the
 * thank-you page so respondents can pass the form along.
 */
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

/**
 * Thank-you page is static-only — rendered entirely via PlateStatic.
 */
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
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        {SuccessCheckmarkIcon}
      </div>
      <h2 className="mb-2 text-2xl font-bold">{t("thankYou")}</h2>
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

/**
 * Renders Plate editor content as a functional form preview.
 * Supports multi-step forms with page breaks as step dividers.
 * Uses separate forms per step with StepFormContext for state management.
 *
 * Static content (headings, paragraphs, blockquotes, code blocks, etc.)
 * is rendered via PlateStatic for full rich-text fidelity.
 * Form fields (Input, Textarea, Button) use custom form components.
 */
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
  customization,
  initialFormData,
  initialCurrentStep,
  isPopup = false,
  trackingBase,
}: FormPreviewFromPlateProps) => {
  const headerFromContent = useMemo(() => extractFormHeader(content), [content]);
  const hasHeaderNode = headerFromContent !== null;

  const title = hideTitle ? "" : hasHeaderNode ? headerFromContent.title : legacyTitle;
  const icon = hasHeaderNode ? (headerFromContent.icon ?? undefined) : legacyIcon;
  const iconColor = hasHeaderNode ? headerFromContent.iconColor : null;
  const cover = hasHeaderNode ? (headerFromContent.cover ?? undefined) : legacyCover;

  const { steps: rawSteps, thankYouNodes } = useMemo(
    () => transformPlateForPreview(content),
    [content],
  );

  // Field-by-field mode: re-chunk so each field becomes its own step, with
  // preceding static content carried into the same step as the next field.
  // Skip authored Button fields entirely — page boundaries are invisible here,
  // so a standalone Next/Previous button step would just be noise. The
  // auto-rendered submit/next button on each input step handles navigation.
  const steps = useMemo(() => {
    if (settings?.presentationMode !== "field-by-field") return rawSteps;
    const flattened: PreviewSegment[][] = [];
    let pending: PreviewSegment[] = [];
    for (const step of rawSteps) {
      for (const seg of step) {
        if (seg.type === "field" && seg.field.fieldType === "Button") continue;
        pending.push(seg);
        if (seg.type === "field") {
          flattened.push(pending);
          pending = [];
        }
      }
    }
    if (pending.length > 0) flattened.push(pending);
    return flattened.length > 0 ? flattened : rawSteps;
  }, [rawSteps, settings?.presentationMode]);

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

  // Determine analytics mode from presentation settings + step count.
  // `null` disables question-progress tracking on single-page forms.
  const isFieldByField = settings?.presentationMode === "field-by-field";
  const trackingMode: PublicFormTracking["mode"] = isFieldByField
    ? "field-by-field"
    : steps.length > 1
      ? "card"
      : null;
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
      totalSteps={steps.length}
      onSubmit={onSubmit}
      formId={formId}
      saveAnswersForLater={settings?.saveAnswersForLater}
      initialFormData={initialFormData}
      initialCurrentStep={initialCurrentStep}
      tracking={tracking}
    >
      <FormPreviewContent
        formId={formId}
        steps={steps}
        thankYouNodes={thankYouNodes}
        title={title}
        icon={icon}
        iconColor={iconColor}
        cover={cover}
        hideTitle={hideTitle}
        layout={layout}
        settings={settings}
        customization={customization}
        isPopup={isPopup}
      />
    </StepFormProvider>
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

const FormPreviewContent = ({
  steps,
  thankYouNodes,
  title,
  icon,
  iconColor,
  cover,
  hideTitle,
  layout,
  settings,
  customization,
  isPopup,
  formId,
}: {
  steps: PreviewSegment[][];
  thankYouNodes: Value | null;
  title?: string;
  icon?: string;
  iconColor?: string | null;
  cover?: string;
  hideTitle?: boolean;
  layout: "public" | "editor";
  settings?: PublicFormSettings;
  customization?: Record<string, string> | null;
  isPopup?: boolean;
  formId?: string;
}) => {
  const { currentStep, totalSteps, isSubmitted, direction, reset } = useStepForm();
  const { t } = useTranslation();
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

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

  const isLastStep = currentStep === steps.length - 1;
  const currentStepSegments = steps[currentStep] || [];
  const isFieldByField = settings?.presentationMode === "field-by-field";
  const coverIsImage = cover && isValidUrl(cover);
  const coverIsColor = cover && isHexColor(cover);

  // Public-form share URL — used on the thank-you page so respondents can pass
  // the form along. Built from the formId since `window.location.href` in the
  // editor preview is the editor route, not the public form URL.
  const shareUrl = useMemo(() => {
    if (!formId || typeof window === "undefined") return undefined;
    return `${window.location.origin}/forms/${formId}`;
  }, [formId]);

  const thankYouContent = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {thankYouNodes && thankYouNodes.length > 0 ? (
        <RenderThankYouContent nodes={thankYouNodes} onReset={reset} shareUrl={shareUrl} />
      ) : (
        <DefaultThankYou onReset={reset} shareUrl={shareUrl} />
      )}
      {redirectCountdown !== null && (
        <p className="mt-4 text-center text-muted-foreground">
          {t("redirecting", {
            n: redirectCountdown,
            s: redirectCountdown !== 1 ? "s" : "",
          })}
        </p>
      )}
    </motion.div>
  );

  // Show thank you content after submission (non-field-by-field layout).
  // Field-by-field renders its own thank-you inside the shared shell below.
  if (isSubmitted && !isFieldByField) {
    return (
      <div className="w-full">
        <PreviewFormHeader
          title={title}
          icon={icon}
          iconColor={iconColor}
          cover={cover}
          hideTitle={hideTitle}
          layout={layout}
          customization={customization}
          isPopup={isPopup}
        />
        <div
          className={cn("mx-auto w-full", layout === "editor" ? "px-8 md:px-0" : "px-4")}
          style={{ maxWidth: PAGE_MAX_WIDTH[layout] }}
          data-bf-form-container
        >
          {thankYouContent}
        </div>
      </div>
    );
  }

  if (isFieldByField) {
    // In popup mode the avatar/icon is already used as the popup bubble, so
    // hide it inside the popup to save space and avoid duplication.
    const hasIcon = !!icon && !isPopup;
    const showHeader = !hideTitle && (title || hasIcon);
    const isPublic = layout === "public";
    const hasTint = isPublic && coverIsImage && cover.includes("tint=true");
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden",
          layout === "public"
            ? isPopup
              ? "max-h-full min-h-full"
              : "min-h-screen"
            : "min-h-[600px]",
        )}
        style={
          isPublic
            ? {
                backgroundImage: coverIsImage ? `url("${cover}")` : undefined,
                backgroundColor: coverIsColor ? cover : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
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
            style={isPopup ? undefined : { maxWidth: PAGE_MAX_WIDTH[layout] }}
          >
            {hasIcon &&
              icon &&
              (icon === DEFAULT_ICON ? (
                <span className="flex-shrink-0" data-bf-logo-icon>
                  <IconPickerPreview
                    icon={DEFAULT_ICON_NAME}
                    iconColor={undefined}
                    useThemeColor
                    iconSize="40"
                    size="80"
                    standaloneIcon
                  />
                </span>
              ) : isValidUrl(icon) ? (
                <img
                  src={icon}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
                  data-bf-logo
                />
              ) : (
                <span className="flex-shrink-0" data-bf-logo-icon>
                  <IconPickerPreview
                    icon={icon}
                    iconColor={iconColor || undefined}
                    useThemeColor={!iconColor}
                    iconSize="40"
                    size="80"
                    standaloneIcon
                  />
                </span>
              ))}
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
          style={{
            maxWidth: PAGE_MAX_WIDTH[layout],
            ...(layout === "editor"
              ? ({ "--bf-spacing": "0.5rem" } as React.CSSProperties)
              : undefined),
          }}
          data-bf-form-container
        >
          {!isSubmitted && settings?.progressBar && totalSteps > 1 && (
            <div className="mb-4 w-full">
              <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
            </div>
          )}

          <div className="w-full">
            {isSubmitted ? (
              thankYouContent
            ) : (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
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
                    key={currentStep}
                    stepIndex={currentStep}
                    segments={currentStepSegments}
                    isLastStep={isLastStep}
                    autoActionButton
                  />
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PreviewFormHeader
        title={title}
        icon={icon}
        cover={cover}
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
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
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
              key={currentStep}
              stepIndex={currentStep}
              segments={currentStepSegments}
              isLastStep={isLastStep}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
