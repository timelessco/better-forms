import { SPRITE_PATH } from "@/lib/config/app-config";
import { Link, useSearch } from "@tanstack/react-router";
import { XIcon } from "@/components/ui/icons";
import { useState, useCallback, useMemo } from "react";
import { PopoverContainerContext } from "@/components/ui/popover";
import type { Value } from "platejs";
import { FormPreviewFromPlate } from "@/components/form-components/form-preview-from-plate";
import { extractFormHeader } from "@/lib/editor/transform-plate-to-form";
import { RenderStepPreviewInputEager } from "@/components/form-components/render-step-preview-input-eager";
import { PreviewRendererContext } from "@/components/form-components/render-step-preview-input";
import { Button } from "@/components/ui/button";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { useEditorColorMode } from "@/hooks/use-editor-color-mode";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useFormCustomization } from "@/hooks/use-form-customization";
import { useFormThemeContextValue } from "@/hooks/use-form-theme";
import { useForm } from "@/hooks/use-live-hooks";
import { useResolvedTheme } from "@/components/theme-provider";
import { EditorThemeProvider } from "@/contexts/editor-theme-context";
import { cn, isValidUrl } from "@/lib/utils";
import { POPUP_FORM_STYLE_VARS } from "@/lib/popup-style";
import { buildPublicFormSettings } from "@/types/form-settings";
import type { PublicFormSettings } from "@/types/form-settings";

const noop = async () => {};

export const PreviewMode = ({ formId, workspaceId }: { formId: string; workspaceId: string }) => {
  const { data: savedDocs, isLoading } = useForm(formId);
  const doc = savedDocs?.[0];

  if (!isLoading && savedDocs !== undefined && savedDocs.length === 0) {
    return (
      <div className="flex size-full items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-lg">Form Not Found</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This form does not exist or has been deleted.
          </p>
          <Link to="/workspace/$workspaceId" params={{ workspaceId }}>
            <Button>Back to Workspace</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !doc) {
    return <div className="flex size-full items-center justify-center">Loading…</div>;
  }

  return <PreviewModeContent doc={doc} formId={formId} />;
};

// Structural doc shape so both the builder's server-backed form and the landing page's
// localStorage draft can drive the same preview surfaces.
export interface PreviewDoc {
  title?: string | null;
  icon?: string | null;
  cover?: string | null;
  content?: unknown;
  draftSettings?: Parameters<typeof buildPublicFormSettings>[0];
  customization?: unknown;
}

export const PreviewModeContent = ({ doc, formId }: { doc: PreviewDoc; formId: string }) => {
  const resolvedAppTheme = useResolvedTheme();
  const { editorColorMode } = useEditorColorMode();

  const { customization, hasCustomization, themeVars, effectiveTheme } = useFormCustomization(
    doc,
    resolvedAppTheme,
    editorColorMode,
  );
  const content = (doc?.content as Value) || [];
  // Preview shows what the user is about to publish — read the draft.
  const docSettings = doc?.draftSettings;

  const search = useSearch({ strict: false });
  // "Show branding" toggle writes the draft setting immediately AND mirrors to embedBranding (via the
  // share-form's debounced navigate). Read the draft FIRST — the search param lags 300ms, so on the
  // embed/popup tabs the badge would otherwise stay until a tab switch flushed the search. Drives the
  // form's inline "Made with Reform." badge live.
  const branding =
    (docSettings?.branding as boolean | undefined) ?? (search.embedBranding as boolean) ?? true;
  const previewSettings = useMemo<PublicFormSettings>(
    () => buildPublicFormSettings(docSettings, { branding }),
    [docSettings, branding],
  );

  const embedType = (search.embedType as EmbedType) ?? "fullpage";
  const hideTitle = (search.embedHideTitle as boolean) ?? false;
  const transparentBackground = (search.embedTransparent as boolean) ?? false;
  const height = (search.embedHeight as number) ?? 558;
  const dynamicHeight = (search.embedDynamicHeight as boolean) ?? true;
  const popupPosition = (search.embedPopupPosition as string) ?? "bottom-right";
  const popupWidth = (search.embedPopupWidth as number) ?? 376;
  const darkOverlay = (search.embedDarkOverlay as boolean) ?? false;
  const showEmoji = (search.embedEmoji as boolean) ?? true;
  const dynamicWidth = (search.embedDynamicWidth as boolean) ?? false;

  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const handleClosePopup = useCallback(() => setIsPopupOpen(false), []);
  const handleOpenPopup = useCallback(() => setIsPopupOpen(true), []);

  const [lastEmbedType, setLastEmbedType] = useState(embedType);
  if (lastEmbedType !== embedType) {
    setLastEmbedType(embedType);
    if (embedType === "popup") setIsPopupOpen(true);
  }

  // Portaled popovers lose CSS-var inheritance. Publish themeVars/hasCustomization via EditorThemeProvider so they re-anchor theme.
  const themeCtxValue = useFormThemeContextValue({ themeVars, hasCustomization, customization });

  return (
    <EditorThemeProvider value={themeCtxValue}>
      <PreviewRendererContext.Provider value={RenderStepPreviewInputEager}>
        <div
          className={cn(
            hasCustomization && "bf-themed",
            effectiveTheme === "dark" ? "dark" : "bf-light",
            "relative flex size-full flex-col overflow-hidden bg-background text-foreground transition-colors duration-300",
          )}
          style={{
            ...(hasCustomization ? themeVars : undefined),
            viewTransitionName: "preview-content",
          }}
        >
          {/* Scroll-fade overlays at the top/bottom edges of the preview (Figma light 26075-12467/12473, dark 26178-7606/7610).
              Skip fullpage — it already has the cover gradient fade, so two would look odd. */}
          {embedType !== "fullpage" &&
            (() => {
              const rgb = effectiveTheme === "dark" ? "19,19,19" : "255,255,255";
              return (
                <>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[150px]"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(${rgb},0.9) 0%, rgba(${rgb},0.62) 32.04%, rgba(${rgb},0.4) 68.23%, rgba(${rgb},0.08) 100%)`,
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[221px]"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(${rgb},0.08) 0%, rgba(${rgb},0.4) 14.68%, rgba(${rgb},0.62) 37.29%, rgba(${rgb},0.9) 51.38%)`,
                    }}
                  />
                </>
              );
            })()}
          {embedType !== "fullpage" && (
            <EmbedPreviewSurface
              embedType={embedType}
              transparentBackground={transparentBackground}
              dynamicHeight={dynamicHeight}
              height={height}
              dynamicWidth={dynamicWidth}
              darkOverlay={darkOverlay}
              isPopupOpen={isPopupOpen}
              handleClosePopup={handleClosePopup}
              handleOpenPopup={handleOpenPopup}
              popupPosition={popupPosition}
              popupWidth={popupWidth}
              showEmoji={showEmoji}
              hideTitle={hideTitle}
              doc={doc}
              content={content}
              customization={customization}
              previewSettings={previewSettings}
              formId={formId}
            />
          )}

          {embedType === "fullpage" && (
            <FullpagePreviewSurface
              transparentBackground={transparentBackground}
              previewSettings={previewSettings}
              hideTitle={hideTitle}
              doc={doc}
              content={content}
              customization={customization}
              formId={formId}
            />
          )}
        </div>
      </PreviewRendererContext.Provider>
    </EditorThemeProvider>
  );
};

type SharedPreviewProps = {
  hideTitle: boolean;
  doc: PreviewDoc;
  content: Value;
  customization: ReturnType<typeof useFormCustomization>["customization"];
  previewSettings: PublicFormSettings;
  formId: string;
};

type EmbedPreviewSurfaceProps = SharedPreviewProps & {
  embedType: EmbedType;
  transparentBackground: boolean;
  dynamicHeight: boolean;
  height: number;
  dynamicWidth: boolean;
  darkOverlay: boolean;
  isPopupOpen: boolean;
  handleClosePopup: () => void;
  handleOpenPopup: () => void;
  popupPosition: string;
  popupWidth: number;
  showEmoji: boolean;
};

const EmbedPreviewSurface = ({
  embedType,
  transparentBackground,
  dynamicHeight,
  height,
  dynamicWidth,
  darkOverlay,
  isPopupOpen,
  handleClosePopup,
  handleOpenPopup,
  popupPosition,
  popupWidth,
  showEmoji,
  hideTitle,
  doc,
  content,
  customization,
  previewSettings,
  formId,
}: EmbedPreviewSurfaceProps) => {
  // Track embed bounds so portaled popovers render + collision-detect within it; else they portal to body and escape the embed frame.
  const [embedFrame, setEmbedFrame] = useState<HTMLElement | null>(null);
  useFocusTrap(embedType === "standard", embedFrame);
  return (
    <div className="flex flex-1 scrollbar-none flex-col overflow-x-hidden overflow-y-auto">
      <div className="relative flex-1 p-4 lg:p-0">
        <div className="mx-auto max-w-[1000px] space-y-10 px-4 pt-6 pb-10 lg:px-8">
          {/* Popup floats over a rich host page; embed sits inline in a lighter one. */}
          {embedType === "popup" ? (
            <PopupHostSkeleton />
          ) : (
            <>
              {/* Host-page skeleton above the embed — Figma 26178-7520 (740-frame): gray/100 bars,
                  h-16 rounded-12/14, 60px avatar, gap 14/12. Widths are 740-frame proportions. */}
              <div className="flex flex-col gap-[14px]">
                <div className="flex items-center gap-3">
                  <div className="size-[60px] shrink-0 rounded-full bg-[var(--color-gray-100)]" />
                  <div className="flex w-[37%] flex-col gap-3">
                    <div className="h-4 w-full rounded-[12px] bg-[var(--color-gray-100)]" />
                    <div className="h-4 w-[82%] rounded-[12px] bg-[var(--color-gray-100)]" />
                  </div>
                </div>
                <div className="flex flex-col gap-[14px]">
                  <div className="h-4 w-full rounded-[14px] bg-[var(--color-gray-100)]" />
                  <div className="h-4 w-[58%] rounded-[14px] bg-[var(--color-gray-100)]" />
                </div>
              </div>

              {/* z-20 lifts the form above the top/bottom scroll-fade overlays (z-10) so the gradient
                  only dims the host-page skeleton, never the form itself. */}
              <div className="relative z-20 flex w-full justify-start">
                <div
                  ref={setEmbedFrame}
                  className={cn(
                    "w-full overflow-hidden rounded-2xl transition-all duration-200",
                    dynamicWidth ? "" : "max-w-[460px]",
                    transparentBackground
                      ? "bg-transparent"
                      : "border border-border bg-background shadow-sm",
                  )}
                  style={{
                    height: dynamicHeight ? "auto" : height,
                  }}
                >
                  <div
                    className={cn(
                      "size-full overflow-x-hidden pb-6",
                      !dynamicHeight &&
                        "scrollbar-thin scrollbar-thumb-muted-foreground/20 overflow-y-auto",
                    )}
                    style={
                      dynamicWidth
                        ? ({ "--bf-page-width": "100%" } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <PopoverContainerContext value={embedFrame}>
                      <FormPreviewFromPlate
                        content={content}
                        title={hideTitle ? "" : (doc.title ?? undefined)}
                        icon={showEmoji ? (doc.icon ?? undefined) : undefined}
                        cover={doc.cover ?? undefined}
                        onSubmit={noop}
                        hideTitle={hideTitle}
                        customization={customization}
                        settings={previewSettings}
                        formId={formId}
                        boundToParent={previewSettings?.presentationMode === "field-by-field"}
                      />
                    </PopoverContainerContext>
                  </div>
                </div>
              </div>

              {/* Host-page skeleton below the embed — Figma 26178-7602 (740-frame): 3 bars full/61%/13%. */}
              <div className="flex flex-col gap-3">
                <div className="h-4 w-full rounded-[12px] bg-[var(--color-gray-100)]" />
                <div className="h-4 w-[61%] rounded-[12px] bg-[var(--color-gray-100)]" />
                <div className="h-4 w-[13%] rounded-[12px] bg-[var(--color-gray-100)]" />
              </div>
            </>
          )}
        </div>

        {embedType === "popup" && (
          <PopupPreviewOverlay
            darkOverlay={darkOverlay}
            isPopupOpen={isPopupOpen}
            handleClosePopup={handleClosePopup}
            handleOpenPopup={handleOpenPopup}
            popupPosition={popupPosition}
            popupWidth={popupWidth}
            previewSettings={previewSettings}
            hideTitle={hideTitle}
            doc={doc}
            content={content}
            customization={customization}
            showEmoji={showEmoji}
            formId={formId}
          />
        )}
      </div>
    </div>
  );
};

// Rich fake-webpage behind the popup, mirroring Figma 26178-8180 (740-frame): gray/100 bars
// (h-16, rounded-12), 60px avatars, rounded-16 blocks (66/140px), 32px between groups.
// Bars pin to neutral gray-100; .bf-themed remaps --muted to the form tint, host chrome must stay neutral.
const PopupHostSkeleton = () => {
  const bar = "h-4 rounded-[12px] bg-[var(--color-gray-100)]";
  const authorRow = (
    <div className="flex items-center gap-3">
      <div className="size-[60px] shrink-0 rounded-full bg-[var(--color-gray-100)]" />
      <div className="flex flex-1 flex-col gap-3">
        <div className={cn(bar, "w-full")} />
        <div className={cn(bar, "w-[82%]")} />
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-8">
      {/* author row (column ~37% of 740) */}
      <div className="w-[47%]">{authorRow}</div>

      {/* 2 lines + 66px block */}
      <div className="flex flex-col gap-[14px]">
        <div className={cn(bar, "w-full")} />
        <div className={cn(bar, "w-full")} />
        <div className="h-[66px] w-full rounded-[16px] bg-[var(--color-gray-100)]" />
      </div>

      {/* 3 lines + 2-col 140px blocks */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[14px]">
          <div className={cn(bar, "w-full")} />
          <div className={cn(bar, "w-[82%]")} />
          <div className={cn(bar, "w-full")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[140px] rounded-[16px] bg-[var(--color-gray-100)]" />
          <div className="h-[140px] rounded-[16px] bg-[var(--color-gray-100)]" />
        </div>
      </div>

      {/* 2 lines */}
      <div className="flex flex-col gap-[14px]">
        <div className={cn(bar, "w-[82%]")} />
        <div className={cn(bar, "w-full")} />
      </div>

      {/* author pair + 3 lines */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-5">
          {authorRow}
          {authorRow}
        </div>
        <div className="flex flex-col gap-3">
          <div className={cn(bar, "w-full")} />
          <div className={cn(bar, "w-[61%]")} />
          <div className={cn(bar, "w-[13%]")} />
        </div>
      </div>
    </div>
  );
};

type PopupPreviewOverlayProps = SharedPreviewProps & {
  darkOverlay: boolean;
  isPopupOpen: boolean;
  handleClosePopup: () => void;
  handleOpenPopup: () => void;
  popupPosition: string;
  popupWidth: number;
  showEmoji: boolean;
};

const PopupPreviewOverlay = ({
  darkOverlay,
  isPopupOpen,
  handleClosePopup,
  handleOpenPopup,
  popupPosition,
  popupWidth,
  previewSettings,
  hideTitle,
  doc,
  content,
  customization,
  showEmoji,
  formId,
}: PopupPreviewOverlayProps) => {
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);
  useFocusTrap(isPopupOpen, popupEl);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      {darkOverlay && isPopupOpen && (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 z-10 size-full cursor-default border-none bg-black/36 backdrop-blur-sm transition-opacity duration-300"
          onClick={handleClosePopup}
          aria-label="Close preview"
        />
      )}

      {isPopupOpen && (
        <div
          ref={setPopupEl}
          // Figma 26889:14685 — 20px radius, elevation/light/xl shadow, no border.
          className="pointer-events-auto absolute z-20 flex flex-col overflow-hidden rounded-[20px] bg-background shadow-[0px_0px_1px_0px_rgba(0,0,0,0.2),0px_0px_10px_2px_rgba(0,0,0,0.04),0px_24px_30px_-8px_rgba(0,0,0,0.1)] transition-[top,left,transform] duration-300 ease-out"
          style={{
            width: popupWidth,
            ...(popupPosition === "center"
              ? {
                  top: "50%",
                  left: `calc(50% - ${popupWidth / 2}px)`,
                  transform: "translateY(-50%)",
                }
              : popupPosition === "bottom-left"
                ? {
                    top: "100%",
                    left: 48,
                    transform: "translateY(calc(-100% - 48px))",
                  }
                : {
                    top: "100%",
                    left: `calc(100% - ${popupWidth}px - 48px)`,
                    transform: "translateY(calc(-100% - 48px))",
                  }),
          }}
        >
          {/* Close (rounded-8px, 18px X): over the cover → white/10 chip + white X (Figma 26889:14689);
              no cover → dark ghost aligned with the title row (26883:11949). */}
          <div className="pointer-events-auto absolute top-3 right-2 z-30">
            <Button
              variant="ghost-flat"
              size="icon-xs"
              className={cn(
                "size-7 rounded-[8px] p-1.25",
                doc.cover && isValidUrl(doc.cover)
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "text-gray-800 hover:bg-black/5 hover:text-foreground",
              )}
              onClick={handleClosePopup}
              aria-label="Close"
            >
              <XIcon className="size-4.5" />
            </Button>
          </div>

          <div
            // Height fits the content (up to 650px) for both layouts — one-at-a-time no longer
            // forces a fixed 650px, so the popup shrinks to the single field (Figma 27015-16542).
            className="max-h-[650px] overflow-x-hidden overflow-y-auto"
            // Popup card (Figma 26883): compact title + flush cover — shared with the live popup.
            style={POPUP_FORM_STYLE_VARS}
          >
            <FormPreviewFromPlate
              content={content}
              title={hideTitle ? "" : (doc.title ?? undefined)}
              icon={showEmoji ? (doc.icon ?? undefined) : undefined}
              cover={doc.cover ?? undefined}
              onSubmit={noop}
              hideTitle={hideTitle}
              customization={customization}
              settings={previewSettings}
              isPopup
              formId={formId}
            />
          </div>
        </div>
      )}

      {!isPopupOpen && (
        <button
          type="button"
          onClick={handleOpenPopup}
          aria-label="Open form preview"
          className="pointer-events-auto absolute z-20 flex size-14 cursor-pointer items-center justify-center rounded-full bg-background/50 text-muted-foreground shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-1 ring-border/50 backdrop-blur-sm transition-[inset] duration-300 ease-out hover:scale-105 hover:bg-muted active:scale-95"
          style={
            popupPosition === "bottom-left"
              ? { bottom: 24, left: 24, right: "auto" }
              : { bottom: 24, right: "auto", left: "calc(100% - 80px)" }
          }
        >
          {doc.icon && isValidUrl(doc.icon) ? (
            <img src={doc.icon} alt="" className="size-6 rounded-md object-cover" />
          ) : doc.icon ? (
            <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
              <use href={`${SPRITE_PATH}#${doc.icon}`} />
            </svg>
          ) : (
            <svg
              className="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

type FullpagePreviewSurfaceProps = SharedPreviewProps & {
  transparentBackground: boolean;
};

const FullpagePreviewSurface = ({
  transparentBackground,
  previewSettings,
  hideTitle,
  doc,
  content,
  customization,
  formId,
}: FullpagePreviewSurfaceProps) => {
  // Match FormPreviewFromPlate cover resolution: formHeader node is sole truth (legacy doc.cover may be stale). Only header-less forms fall back to doc.cover.
  const effectiveCover = useMemo(() => {
    const header = extractFormHeader(content);
    if (header) return header.cover ?? null;
    return doc.cover ?? null;
  }, [content, doc.cover]);
  return (
    <div
      data-bf-cover-pane
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden transition-colors duration-300",
        transparentBackground ? "bg-transparent" : "bg-background",
      )}
    >
      <div
        className={cn(
          "h-full min-h-0 w-full flex-1",
          previewSettings.presentationMode !== "field-by-field" &&
            "overflow-x-hidden overflow-y-auto",
        )}
      >
        <FormPreviewFromPlate
          content={content}
          title={hideTitle ? "" : (doc.title ?? undefined)}
          icon={doc.icon ?? undefined}
          cover={effectiveCover ?? undefined}
          onSubmit={noop}
          hideTitle={hideTitle}
          layout="editor"
          customization={customization}
          settings={previewSettings}
          formId={formId}
        />
      </div>
    </div>
  );
};
