import {
  FileQuestionIcon,
  LockIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import type { Value } from "platejs";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
// Lazy: pulls StaticContentBlock → platejs runtime + BaseEditorKit + Plate CSS
// (~370 kB). The RSC path renders static content server-side, so this fallback
// only runs when `rsc` is unavailable.
const FormPreviewFromPlate = lazy(() =>
  import("@/components/form-components/form-preview-from-plate").then((m) => ({
    default: m.FormPreviewFromPlate,
  })),
);
import { FormPreviewRSC } from "@/components/form-components/form-preview-rsc";
import type { StepRSC } from "@/components/form-components/form-preview-rsc";
import { BrandingFooter } from "./branding-footer";
import { AlreadySubmitted, FormClosed } from "@/routes/forms/-components/form-closed";
import { PasswordGate } from "@/routes/forms/-components/password-gate";
import { TranslationProvider, useTranslation } from "@/contexts/translation-context";
import { createPublicSubmission, getPublicDraft } from "@/lib/server-fn/public-submissions";
import { clearDraftId, readDraftId } from "@/hooks/use-draft-autosave";
import { usePublicFormTracking } from "@/lib/analytics/use-public-form-tracking";
import { getTranslations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { defaultPublicFormSettings } from "@/types/form-settings";
import type { PublicFormSettings } from "@/types/form-settings";

interface PublicForm {
  id: string;
  shortId: string;
  title: string;
  content: unknown;
  customization?: Record<string, string>;
  icon: string | null;
  cover: string | null;
  status: string;
  analytics: boolean;
  settings?: PublicFormSettings;
}

interface GatedState {
  type: "closed" | "date_expired" | "limit_reached" | "password_required";
  message?: string | null;
}

/** Embed display configuration for the public form page */
export interface PublicFormEmbedConfig {
  title: "visible" | "hidden";
  background: "transparent" | "solid";
  alignment: "center" | "left";
  dynamicHeight: boolean;
  dynamicWidth: boolean;
}

export const defaultPublicFormEmbedConfig: PublicFormEmbedConfig = {
  title: "visible",
  background: "solid",
  alignment: "center",
  dynamicHeight: false,
  dynamicWidth: false,
};

interface PublicFormPageProps {
  form: PublicForm | null;
  error: "not_found" | null;
  formId: string;
  gated?: GatedState | null;
  /** Whether this form is loaded in a popup iframe */
  isPopup?: boolean;
  /** Embed display configuration */
  embedConfig?: PublicFormEmbedConfig;
  /** Optional viewer-side theme toggle (shown only when creator selected "system") */
  themeToggle?: {
    current: "light" | "dark";
    onChange: (next: "light" | "dark" | "system") => void;
  };
  // When present, renders via FormPreviewRSC — static prose is server-rendered
  // so the client bundle no longer ships platejs/static.
  rsc?: {
    steps: StepRSC[];
    thankYou?: unknown;
    stepCount: number;
    /** Pre-rendered header composite (cover + icon + title). */
    header?: unknown;
  };
}

/**
 * Send a message to the parent window (for popup embeds)
 */
const sendToParent = (event: string, payload?: Record<string, unknown>): void => {
  if (typeof window === "undefined" || window.parent === window) return;

  try {
    window.parent.postMessage(JSON.stringify({ event, ...payload }), "*");
  } catch (e) {
    console.error("[Reform] Failed to send message to parent:", e);
  }
};

const FormNotFound = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon />
          </EmptyMedia>
          <EmptyTitle>{t("formNotFound")}</EmptyTitle>
          <EmptyDescription>{t("formNotFoundDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

const FormNotPublished = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Empty className="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockIcon />
          </EmptyMedia>
          <EmptyTitle>{t("formNotAvailable")}</EmptyTitle>
          <EmptyDescription>{t("formNotAvailableDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
};

type DraftPayload = { data: Record<string, unknown>; lastStepReached: number | null };
type DraftState =
  | { status: "loading" }
  | { status: "prompt"; draft: DraftPayload }
  | { status: "resumed"; draft: DraftPayload }
  | { status: "dismissed" };

const usePublicDraftState = (formId: string) => {
  const draftId = readDraftId(formId);
  const draftQuery = useQuery({
    queryKey: ["publicDraft", formId, draftId],
    enabled: !!draftId,
    queryFn: async () => {
      if (!draftId) return null;
      const res = await getPublicDraft({ data: { formId, draftId } });
      return res.draft ?? null;
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (draftQuery.isError) {
    console.error("[Reform] Failed to load draft:", draftQuery.error);
  }

  const [draftOverride, setDraftOverride] = useState<DraftState | null>(null);

  const computedDraftState: DraftState = useMemo(() => {
    if (!draftId) return { status: "dismissed" };
    if (draftQuery.isLoading) return { status: "loading" };
    if (draftQuery.isError || !draftQuery.data) return { status: "dismissed" };
    return {
      status: "prompt",
      draft: {
        data: draftQuery.data.data,
        lastStepReached: draftQuery.data.lastStepReached,
      },
    };
  }, [draftId, draftQuery.isLoading, draftQuery.isError, draftQuery.data]);

  const draftState: DraftState = draftOverride ?? computedDraftState;

  const handleResumeDraft = useCallback(() => {
    if (computedDraftState.status === "prompt") {
      setDraftOverride({ status: "resumed", draft: computedDraftState.draft });
    }
  }, [computedDraftState]);

  const handleStartOver = useCallback(() => {
    clearDraftId(formId);
    setDraftOverride({ status: "dismissed" });
  }, [formId]);

  return { draftState, handleResumeDraft, handleStartOver };
};

const useTransparentBackground = (transparentBackground: boolean, isPopup: boolean) => {
  useEffect(() => {
    if (transparentBackground || isPopup) {
      const originalBodyBg = document.body.style.background;
      const originalHtmlBg = document.documentElement.style.background;

      document.body.style.setProperty("background", "transparent");
      document.documentElement.style.setProperty("background", "transparent");

      return () => {
        document.body.style.setProperty("background", originalBodyBg);
        document.documentElement.style.setProperty("background", originalHtmlBg);
      };
    }
  }, [transparentBackground, isPopup]);
};

const useFieldByFieldOverflowLock = (isFieldByFieldPopup: boolean) => {
  useEffect(() => {
    if (!isFieldByFieldPopup) return;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    document.documentElement.style.setProperty("overflow", "hidden");
    document.body.style.setProperty("overflow", "hidden");
    return () => {
      document.documentElement.style.setProperty("overflow", originalHtmlOverflow);
      document.body.style.setProperty("overflow", originalBodyOverflow);
    };
  }, [isFieldByFieldPopup]);
};

const useIframeResizeNotifier = (
  isPopup: boolean,
  dynamicHeight: boolean,
  formId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    if ((!isPopup && !dynamicHeight) || typeof window === "undefined" || window.parent === window)
      return;

    sendToParent("Reform.FormLoaded", { formId });

    let lastHeight = 0;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const sendHeight = () => {
      const container = containerRef.current;
      if (!container) return;

      const height = container.scrollHeight;

      if (Math.abs(height - lastHeight) > 2) {
        lastHeight = height;
        sendToParent("Reform.Resize", { height });
      }
    };

    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(sendHeight, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    setTimeout(sendHeight, 150);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- ref is stable
  }, [isPopup, dynamicHeight, formId]);
};

export const PublicFormPage = ({
  form,
  error,
  formId,
  gated,
  rsc,
  isPopup = false,
  embedConfig = defaultPublicFormEmbedConfig,
  themeToggle,
}: PublicFormPageProps) => {
  const transparentBackground = embedConfig.background === "transparent";
  const hideTitle = embedConfig.title === "hidden";
  const alignLeft = embedConfig.alignment === "left";
  const dynamicHeight = embedConfig.dynamicHeight;
  const dynamicWidth = embedConfig.dynamicWidth;
  const containerRef = useRef<HTMLDivElement>(null);
  // Analytics writers run unconditionally (Option B): we always record visits
  // and question progress so flipping the analytics toggle on later surfaces
  // historical data instead of starting from zero. The toggle gates DISPLAY
  // (insights dashboard), not recording. `form` may be null in error states,
  // so only suppress tracking when there's no form to attribute visits to.
  const trackingBase = usePublicFormTracking({ formId, enabled: !!form });
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in JSX to render AlreadySubmitted
  const [submitted, setSubmitted] = useState(() => {
    if (form?.settings?.preventDuplicateSubmissions) {
      try {
        return localStorage.getItem(`bf-submitted-${formId}`) === "1";
      } catch {
        // localStorage unavailable
      }
    }
    return false;
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

  const { draftState, handleResumeDraft, handleStartOver } = usePublicDraftState(formId);

  const resumed = draftState.status === "resumed";
  const resumeProps =
    draftState.status === "resumed"
      ? {
          initialFormData: draftState.draft.data,
          initialCurrentStep: draftState.draft.lastStepReached ?? 0,
        }
      : {};
  const previewKey = resumed ? "resumed" : "fresh";

  const resolvedLanguage = form?.settings?.language ?? "English";

  useTransparentBackground(transparentBackground, isPopup);

  // For field-by-field popups, suppress iframe-level scrollbars — the single
  // visible field is centered within the available height, so no scroll is
  // needed and the macOS overlay scrollbar would otherwise appear.
  const isFieldByFieldPopup = isPopup && form?.settings?.presentationMode === "field-by-field";
  useFieldByFieldOverflowLock(isFieldByFieldPopup);

  useIframeResizeNotifier(isPopup, dynamicHeight, formId, containerRef);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setSubmitError(null);
      try {
        // Carry the draftId forward so the server updates the existing draft
        // row in place (preserves submissionId, notifications fire once).
        const draftId = readDraftId(formId) ?? undefined;
        await createPublicSubmission({
          data: {
            formId,
            data: values,
            isCompleted: true,
            draftId,
            visitId: trackingBase.visitId ?? undefined,
          },
        });

        // Completed: drop the localStorage pointer so a fresh visit starts a
        // fresh draft instead of resuming the one that just finalized.
        clearDraftId(formId);

        if (form?.settings?.preventDuplicateSubmissions) {
          try {
            localStorage.setItem(`bf-submitted-${formId}`, "1");
          } catch {
            // localStorage unavailable
          }
          setSubmitted(true);
        }

        if (isPopup) {
          sendToParent("Reform.FormSubmitted", {
            formId,
            payload: {
              formId,
              formName: form?.title,
              data: values,
            },
          });
        }
      } catch (err) {
        console.error("Submission error:", err);
        setSubmitError(getTranslations(resolvedLanguage).submitFailed);
        throw err; // Re-throw so the form knows it failed
      }
    },
    [
      formId,
      isPopup,
      form?.title,
      form?.settings?.preventDuplicateSubmissions,
      resolvedLanguage,
      trackingBase.visitId,
    ],
  );

  // Handle gated states (closed, date expired, limit reached) — check before !form
  // because the server returns form: null for closed forms
  if (gated && gated.type !== "password_required") {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <FormClosed message={gated.message} />
      </TranslationProvider>
    );
  }

  if (error === "not_found" || !form) {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <FormNotFound />
      </TranslationProvider>
    );
  }

  // Handle non-published status (shouldn't happen with SSR, but defensive)
  if (form.status !== "published") {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <FormNotPublished />
      </TranslationProvider>
    );
  }

  if (submitted) {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <AlreadySubmitted />
      </TranslationProvider>
    );
  }

  const settings = form.settings ?? defaultPublicFormSettings;

  const formContent = (
    <PublicFormMain
      containerRef={containerRef}
      settings={settings}
      form={form}
      transparentBackground={transparentBackground}
      isPopup={isPopup}
      dynamicHeight={dynamicHeight}
      dynamicWidth={dynamicWidth}
      alignLeft={alignLeft}
      themeToggle={themeToggle}
      draftState={draftState}
      handleResumeDraft={handleResumeDraft}
      handleStartOver={handleStartOver}
      rsc={rsc}
      previewKey={previewKey}
      hideTitle={hideTitle}
      handleSubmit={handleSubmit}
      formId={formId}
      trackingBase={trackingBase}
      resumeProps={resumeProps}
      submitError={submitError}
    />
  );

  if (gated?.type === "password_required") {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <PasswordGate formId={formId}>{formContent}</PasswordGate>
      </TranslationProvider>
    );
  }

  return <TranslationProvider language={resolvedLanguage}>{formContent}</TranslationProvider>;
};

interface ThemeToggleHandle {
  current: "light" | "dark";
  onChange: (next: "light" | "dark" | "system") => void;
}

const ThemeToggleButton = ({ themeToggle }: { themeToggle: ThemeToggleHandle }) => (
  <div className="fixed top-4 right-4 z-50">
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Toggle color theme"
      onClick={() => themeToggle.onChange(themeToggle.current === "dark" ? "light" : "dark")}
      className="rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur"
    >
      {/* Render both icons; the pre-hydration script sets `.dark` on the
          root before paint, so CSS picks the right one. Doing this in
          React state would mismatch SSR (server can't know the viewer's
          system preference), triggering a full-tree re-render that
          presents as a ~1s layout shift after hydration. */}
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="block size-4 dark:hidden" />
    </Button>
  </div>
);

const DraftResumePrompt = ({
  handleResumeDraft,
  handleStartOver,
}: {
  handleResumeDraft: () => void;
  handleStartOver: () => void;
}) => (
  // x: "-50%" centers via motion's transform (Tailwind -translate-x-1/2 would be clobbered).
  // Anchored top-6: users miss bottom toasts (eyes are on the form), so the
  // resume affordance lives where the gaze already is on first paint.
  <motion.div
    role="status"
    initial={{ opacity: 0, y: -16, x: "-50%" }}
    animate={{ opacity: 1, y: 0, x: "-50%" }}
    exit={{ opacity: 0, y: -16, x: "-50%" }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    className="fixed top-6 left-1/2 z-50 w-[min(560px,90vw)]"
  >
    <div className="flex items-center justify-between rounded-xl bg-background px-2.75 py-2.25 shadow-md ring-1 ring-border/60">
      <div className="flex items-center gap-2 ps-1">
        <RotateCcwIcon className="size-4 text-muted-foreground" />
        <span className="text-sm">We restored your in-progress answers.</span>
      </div>
      <div className="flex h-6.5 items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={handleStartOver}>
          Start over
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleResumeDraft}>
          Resume
        </Button>
      </div>
    </div>
  </motion.div>
);

const SubmitErrorToast = ({ submitError }: { submitError: string }) => (
  <div
    aria-live="assertive"
    role="alert"
    className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive shadow-sm"
  >
    {submitError}
  </div>
);

interface PublicFormMainProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  settings: PublicFormSettings;
  form: PublicForm;
  transparentBackground: boolean;
  isPopup: boolean;
  dynamicHeight: boolean;
  dynamicWidth: boolean;
  alignLeft: boolean;
  themeToggle: ThemeToggleHandle | undefined;
  draftState:
    | { status: "loading" }
    | { status: "prompt"; draft: { data: Record<string, unknown>; lastStepReached: number | null } }
    | {
        status: "resumed";
        draft: { data: Record<string, unknown>; lastStepReached: number | null };
      }
    | { status: "dismissed" };
  handleResumeDraft: () => void;
  handleStartOver: () => void;
  rsc: PublicFormPageProps["rsc"];
  previewKey: string;
  hideTitle: boolean;
  handleSubmit: (values: Record<string, unknown>) => Promise<void>;
  formId: string;
  trackingBase: ReturnType<typeof usePublicFormTracking>;
  resumeProps: { initialFormData?: Record<string, unknown>; initialCurrentStep?: number };
  submitError: string | null;
}

const PublicFormMain = ({
  containerRef,
  settings,
  form,
  transparentBackground,
  isPopup,
  dynamicHeight,
  dynamicWidth,
  alignLeft,
  themeToggle,
  draftState,
  handleResumeDraft,
  handleStartOver,
  rsc,
  previewKey,
  hideTitle,
  handleSubmit,
  formId,
  trackingBase,
  resumeProps,
  submitError,
}: PublicFormMainProps) => (
  <main
    ref={containerRef}
    id="bf-form-container"
    className={cn(
      "text-foreground",
      settings.presentationMode === "field-by-field"
        ? "relative h-screen overflow-hidden"
        : cn("overflow-x-hidden", settings.branding ? "pb-16" : "pb-8"),
      form.customization && Object.keys(form.customization).length > 0 && "bf-themed",
      // Don't apply min-h-screen for popup or dynamic-height embeds — it
      // stretches the form to 100vh of the iframe viewport, creating a
      // second inner scrollbar on top of the host page's scroll.
      !isPopup &&
        !dynamicHeight &&
        settings.presentationMode !== "field-by-field" &&
        "min-h-screen",
      transparentBackground || isPopup ? "bg-transparent" : "bg-background",
      alignLeft && "text-left",
    )}
    style={dynamicWidth ? ({ "--bf-page-width": "100%" } as React.CSSProperties) : undefined}
    aria-live="polite"
  >
    {themeToggle && <ThemeToggleButton themeToggle={themeToggle} />}
    <AnimatePresence>
      {draftState.status === "prompt" && (
        <DraftResumePrompt
          handleResumeDraft={handleResumeDraft}
          handleStartOver={handleStartOver}
        />
      )}
    </AnimatePresence>
    {rsc && settings.presentationMode !== "field-by-field" ? (
      <FormPreviewRSC
        key={previewKey}
        steps={rsc.steps}
        thankYou={(rsc.thankYou as string | null) ?? null}
        stepCount={rsc.stepCount}
        header={hideTitle ? null : rsc.header}
        onSubmit={handleSubmit}
        settings={settings}
        formId={formId}
        trackingBase={trackingBase}
        {...resumeProps}
      />
    ) : (
      <Suspense fallback={null}>
        <FormPreviewFromPlate
          key={previewKey}
          content={form.content as Value}
          title={hideTitle ? undefined : form.title}
          icon={hideTitle ? undefined : (form.icon ?? undefined)}
          cover={hideTitle ? undefined : (form.cover ?? undefined)}
          onSubmit={handleSubmit}
          hideTitle={hideTitle}
          settings={settings}
          formId={formId}
          shortId={form.shortId}
          customization={form.customization}
          isPopup={isPopup}
          trackingBase={trackingBase}
          {...resumeProps}
        />
      </Suspense>
    )}
    {submitError && <SubmitErrorToast submitError={submitError} />}
    {settings.branding && <BrandingFooter />}
  </main>
);
