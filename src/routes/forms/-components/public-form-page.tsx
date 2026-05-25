import {
  FileQuestionIcon,
  LockIcon,
  MoonIcon,
  RotateCcwIcon,
  SunIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Value } from "platejs";
import { transformPlateStateToFormElements } from "@/lib/editor/transform-plate-to-form";

const AiChatForm = lazy(() =>
  import("@/components/form-components/ai-chat-form/ai-chat-form").then((m) => ({
    default: m.AiChatForm,
  })),
);
import { FormPreviewRSC } from "@/components/form-components/form-preview-rsc";
import type { StepRSC } from "@/components/form-components/form-preview-rsc";
import { BrandingFooter } from "./branding-footer";
import { AlreadySubmitted, FormClosed } from "@/routes/forms/-components/form-closed";
import { PasswordGate } from "@/routes/forms/-components/password-gate";
import { TranslationProvider, useTranslation } from "@/contexts/translation-context";
import { createPublicSubmission } from "@/lib/server-fn/public-submissions";
import {
  clearDraftId,
  getOrCreateDraftId,
  readDraftId,
  readLocalDraft,
} from "@/hooks/use-draft-autosave";
import { usePublicFormTracking } from "@/lib/analytics/use-public-form-tracking";
import { getTranslations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { defaultPublicFormSettings } from "@/types/form-settings";
import type { PublicFormSettings } from "@/types/form-settings";
import { EditorThemeProvider } from "@/contexts/editor-theme-context";
import { useFormCustomization } from "@/hooks/use-form-customization";
import { useFormThemeContextValue } from "@/hooks/use-form-theme";
import { Hydrate } from "@tanstack/react-start";
import { interaction, never } from "@tanstack/react-start/hydration";

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
  /** Currently-resolved app theme. Used to derive theme tokens for portaled
   * popovers (Date/MultiSelect/Phone Combobox), which lose the cascade from
   * `.bf-themed` on `<main>` because they render via createPortal. */
  resolvedAppTheme?: "light" | "dark";
  // When present, renders via FormPreviewRSC — static prose is server-rendered
  // so the client bundle no longer ships platejs/static.
  rsc?: {
    steps: StepRSC[];
    thankYou?: unknown;
    stepCount: number;
    /** Pre-rendered header composite (cover + icon + title). */
    header?: unknown;
    /** Icon background color extracted from the Plate formHeader node;
     * field-by-field only (card mode uses the pre-rendered header composite). */
    formHeaderIconColor?: string | null;
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
  // Start "loading" so SSR HTML and the first client render match (no
  // DraftResumePrompt in either). useEffect resolves on mount by reading
  // localStorage synchronously — no server roundtrip.
  const [draftState, setDraftState] = useState<DraftState>({ status: "loading" });

  useEffect(() => {
    const local = readLocalDraft(formId);
    if (!local) {
      setDraftState({ status: "dismissed" });
      return;
    }
    setDraftState({
      status: "prompt",
      draft: { data: local.data, lastStepReached: local.lastStepReached },
    });
  }, [formId]);

  const handleResumeDraft = useCallback(() => {
    setDraftState((prev) =>
      prev.status === "prompt" ? { status: "resumed", draft: prev.draft } : prev,
    );
  }, []);

  const handleStartOver = useCallback(() => {
    clearDraftId(formId);
    setDraftState({ status: "dismissed" });
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
  resolvedAppTheme = "light",
}: PublicFormPageProps) => {
  const transparentBackground = embedConfig.background === "transparent";
  const hideTitle = embedConfig.title === "hidden";
  const alignLeft = embedConfig.alignment === "left";
  const dynamicHeight = embedConfig.dynamicHeight;
  const dynamicWidth = embedConfig.dynamicWidth;
  const containerRef = useRef<HTMLDivElement>(null);

  // Portaled popovers (date picker, country combobox, multi-select) lose the
  // CSS-var cascade from `.bf-themed` on <main>. Publish themeVars +
  // hasCustomization via EditorThemeProvider so useReanchorThemeProps() can
  // re-apply them on each portaled popup. Must run before any early return.
  const { customization, hasCustomization, themeVars } = useFormCustomization(
    form,
    resolvedAppTheme,
  );
  const themeCtxValue = useFormThemeContextValue({ themeVars, hasCustomization, customization });
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

  // Local in-session escape: AI Chat → card (the standard scrolling form),
  // without persisting to settings. Toggled by AiChatForm via
  // `onSwitchToStandard`. Card (not field-by-field) so it's a plain full-page
  // form with no full-pane cover background.
  const [aiChatFallback, setAiChatFallback] = useState(false);
  const effectivePresentationMode =
    form?.settings?.presentationMode === "ai-chat" && aiChatFallback
      ? "card"
      : form?.settings?.presentationMode;

  // For field-by-field and ai-chat popups, suppress iframe-level scrollbars —
  // the single visible field is centered within the available height, so no
  // scroll is needed and the macOS overlay scrollbar would otherwise appear.
  const isFieldByFieldPopup =
    isPopup &&
    (effectivePresentationMode === "field-by-field" || effectivePresentationMode === "ai-chat");
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

  // Loader invariant: when `form` is set so is `rsc`. Defensive only.
  if (!rsc) {
    return (
      <TranslationProvider language={resolvedLanguage}>
        <FormNotFound />
      </TranslationProvider>
    );
  }

  const baseSettings = form.settings ?? defaultPublicFormSettings;
  const settings: PublicFormSettings =
    baseSettings.presentationMode === "ai-chat" && aiChatFallback
      ? { ...baseSettings, presentationMode: "card" }
      : baseSettings;

  const formContent = (
    <PublicFormMain
      containerRef={containerRef}
      settings={settings}
      onSwitchToAiChatFallback={() => setAiChatFallback(true)}
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

  const themedContent =
    gated?.type === "password_required" ? (
      <PasswordGate formId={formId}>{formContent}</PasswordGate>
    ) : (
      formContent
    );

  return (
    <TranslationProvider language={resolvedLanguage}>
      <EditorThemeProvider value={themeCtxValue}>{themedContent}</EditorThemeProvider>
    </TranslationProvider>
  );
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
      className="rounded-full bg-background/80 elevation-sm backdrop-blur dark:bg-muted/50 dark:shadow-none"
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
  // Anchored top-6: users miss bottom toasts (eyes are on the form), so the
  // resume affordance lives where the gaze already is on first paint.
  <div
    role="status"
    className="fixed top-6 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 animate-in duration-250 ease-out fade-in slide-in-from-top-4"
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
  </div>
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

interface AiChatBodyProps {
  formId: string;
  shortId: string;
  content: Value;
  settings: PublicFormSettings;
  handleSubmit: (values: Record<string, unknown>) => Promise<void>;
  onSwitchToStandard: () => void;
  initialAnswers: Record<string, unknown> | undefined;
}

const AiChatBody = ({
  formId,
  shortId,
  content,
  settings,
  handleSubmit,
  onSwitchToStandard,
  initialAnswers,
}: AiChatBodyProps) => {
  const elements = useMemo(() => transformPlateStateToFormElements(content), [content]);
  const submissionId = useMemo(() => getOrCreateDraftId(formId), [formId]);
  return (
    <Suspense fallback={null}>
      <AiChatForm
        formId={formId}
        shortId={shortId}
        submissionId={submissionId}
        content={elements}
        settings={settings}
        onSubmit={handleSubmit}
        onSwitchToStandard={onSwitchToStandard}
        initialAnswers={initialAnswers}
      />
    </Suspense>
  );
};

interface PublicFormMainProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  settings: PublicFormSettings;
  onSwitchToAiChatFallback: () => void;
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
  rsc: NonNullable<PublicFormPageProps["rsc"]>;
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
  onSwitchToAiChatFallback,
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
}: PublicFormMainProps) => {
  const isAiChat = settings.presentationMode === "ai-chat";
  // AI Chat and field-by-field own the full viewport height (chat scrolls
  // internally, composer pinned to the bottom); card forms scroll the page.
  const isFullHeight = isAiChat || settings.presentationMode === "field-by-field";
  return (
    <main
      ref={containerRef}
      id="bf-form-container"
      className={cn(
        "text-foreground",
        isFullHeight
          ? "relative h-screen overflow-hidden"
          : cn("overflow-x-hidden", settings.branding ? "pb-16" : "pb-8"),
        // AI Chat reserves space for the fixed branding footer so the composer
        // isn't hidden behind it.
        isAiChat && settings.branding && "pb-12",
        form.customization && Object.keys(form.customization).length > 0 && "bf-themed",
        // Don't apply min-h-screen for popup or dynamic-height embeds — it
        // stretches the form to 100vh of the iframe viewport, creating a
        // second inner scrollbar on top of the host page's scroll.
        !isPopup && !dynamicHeight && !isFullHeight && "min-h-screen",
        transparentBackground || isPopup ? "bg-transparent" : "bg-background",
        alignLeft && "text-left",
      )}
      style={dynamicWidth ? ({ "--bf-page-width": "100%" } as React.CSSProperties) : undefined}
      aria-live="polite"
    >
      {themeToggle && (
        // Theme toggle only matters when the viewer clicks/focuses it. Defer
        // hydration to first interaction so the icon paints from SSR HTML
        // without dragging its handler chunk into the critical path. Safe
        // because the pre-hydration script already sets the .dark class.
        <Hydrate when={interaction({ events: ["pointerdown", "focusin"] })}>
          <ThemeToggleButton themeToggle={themeToggle} />
        </Hydrate>
      )}
      {draftState.status === "prompt" && !isAiChat && (
        <DraftResumePrompt
          handleResumeDraft={handleResumeDraft}
          handleStartOver={handleStartOver}
        />
      )}
      {isAiChat ? (
        <AiChatBody
          formId={formId}
          shortId={form.shortId}
          content={form.content as Value}
          settings={settings}
          handleSubmit={handleSubmit}
          onSwitchToStandard={onSwitchToAiChatFallback}
          // AI Chat resumes in-chat (recap bubble), so it auto-resumes any draft
          // without the banner prompt the standard form uses.
          initialAnswers={
            draftState.status === "resumed" || draftState.status === "prompt"
              ? draftState.draft.data
              : undefined
          }
        />
      ) : (
        <FormPreviewRSC
          key={previewKey}
          steps={rsc.steps}
          thankYou={(rsc.thankYou as string | null) ?? null}
          stepCount={rsc.stepCount}
          header={hideTitle ? null : rsc.header}
          onSubmit={handleSubmit}
          settings={settings}
          formId={formId}
          shortId={form.shortId}
          trackingBase={trackingBase}
          fieldByFieldMeta={
            settings.presentationMode === "field-by-field"
              ? {
                  title: form.title,
                  icon: form.icon,
                  iconColor: rsc.formHeaderIconColor ?? null,
                  cover: form.cover,
                  hideTitle,
                  isPopup,
                }
              : undefined
          }
          {...resumeProps}
        />
      )}
      {submitError && <SubmitErrorToast submitError={submitError} />}
      {settings.branding && (
        // Static fixed-bottom link with no client behavior — ship SSR HTML
        // and skip hydration entirely.
        <Hydrate when={never()}>
          <BrandingFooter />
        </Hydrate>
      )}
    </main>
  );
};
