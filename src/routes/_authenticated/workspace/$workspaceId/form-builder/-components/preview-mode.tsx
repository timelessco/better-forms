import { APP_NAME, SPRITE_PATH } from "@/lib/config/app-config";
import { Link, useSearch } from "@tanstack/react-router";
import { SparklesIcon, XIcon } from "@/components/ui/icons";
import { useState, useCallback, useMemo } from "react";
import { PopoverContainerContext } from "@/components/ui/popover";
import type { Value } from "platejs";
import { FormPreviewFromPlate } from "@/components/form-components/form-preview-from-plate";
import { extractFormHeader } from "@/lib/editor/transform-plate-to-form";
import { RenderStepPreviewInputEager } from "@/components/form-components/render-step-preview-input-eager";
import { PreviewRendererContext } from "@/components/form-components/render-step-preview-input";
import { Button } from "@/components/ui/button";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useFormCustomization } from "@/hooks/use-form-customization";
import { useFormThemeContextValue } from "@/hooks/use-form-theme";
import { useForm } from "@/hooks/use-live-hooks";
import { useResolvedTheme } from "@/components/theme-provider";
import { EditorThemeProvider } from "@/contexts/editor-theme-context";
import { cn, isHexColor, isValidUrl } from "@/lib/utils";
import { buildPublicFormSettings } from "@/types/form-settings";
import type { PublicFormSettings } from "@/types/form-settings";

const noop = async () => {};

export const PreviewMode = ({ formId, workspaceId }: { formId: string; workspaceId: string }) => {
  const { data: savedDocs, isLoading } = useForm(formId);
  const doc = savedDocs?.[0];

  const resolvedAppTheme = useResolvedTheme();

  const { customization, hasCustomization, themeVars, effectiveTheme } = useFormCustomization(
    doc,
    resolvedAppTheme,
  );
  const content = (doc?.content as Value) || [];
  // Preview shows what the user is about to publish — read the draft.
  const docSettings = doc?.draftSettings;
  const previewSettings = useMemo<PublicFormSettings>(
    () =>
      buildPublicFormSettings(docSettings, {
        branding: Boolean(docSettings?.branding ?? true),
      }),
    [docSettings],
  );

  const search = useSearch({ strict: false });
  const embedType = (search.embedType as EmbedType) ?? "fullpage";
  const hideTitle = (search.embedHideTitle as boolean) ?? false;
  const transparentBackground = (search.embedTransparent as boolean) ?? false;
  const branding = (search.embedBranding as boolean) ?? docSettings?.branding ?? true;
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

  // Portaled popovers lose CSS-var inheritance. Publish themeVars/hasCustomization via EditorThemeProvider so they re-anchor theme. Must run before early returns.
  const themeCtxValue = useFormThemeContextValue({ themeVars, hasCustomization, customization });

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

  return (
    <EditorThemeProvider value={themeCtxValue}>
      <PreviewRendererContext.Provider value={RenderStepPreviewInputEager}>
        <div
          className={cn(
            hasCustomization && "bf-themed",
            effectiveTheme === "dark" ? "dark" : "bf-light",
            "flex size-full flex-col overflow-hidden bg-background text-foreground transition-colors duration-300",
          )}
          style={{
            ...(hasCustomization ? themeVars : undefined),
            viewTransitionName: "preview-content",
          }}
        >
          {embedType !== "fullpage" && (
            <EmbedPreviewSurface
              embedType={embedType}
              transparentBackground={transparentBackground}
              dynamicHeight={dynamicHeight}
              height={height}
              dynamicWidth={dynamicWidth}
              branding={branding}
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
              branding={branding}
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
  doc: NonNullable<ReturnType<typeof useForm>["data"]>[number];
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
  branding: boolean;
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
  branding,
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
              {/* Host-page content above the embed */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="size-14 shrink-0 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-3 w-2/5 rounded-full bg-muted" />
                    <div className="h-3 w-1/3 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="h-3 w-full rounded-full bg-muted" />
                <div className="h-20 w-full rounded-2xl bg-muted" />
              </div>

              <div className="flex w-full justify-start">
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
                      "size-full overflow-x-hidden",
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

              {/* Host-page content below the embed */}
              <div className="space-y-3">
                <div className="h-3 w-3/5 rounded-full bg-muted" />
                <div className="h-3 w-1/5 rounded-full bg-muted" />
              </div>

              {branding && <BrandingBadge />}
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
            branding={branding}
            showEmoji={showEmoji}
            formId={formId}
          />
        )}
      </div>
    </div>
  );
};

// Rich fake-webpage behind the popup, mirroring the Figma popup host mock.
const PopupHostSkeleton = () => {
  const authorRow = (
    <div className="flex items-center gap-3">
      <div className="size-14 shrink-0 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 rounded-full bg-muted" />
        <div className="h-3 w-3/5 rounded-full bg-muted" />
      </div>
    </div>
  );
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="size-14 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-2.5">
          <div className="h-3 w-2/5 rounded-full bg-muted" />
          <div className="h-3 w-1/3 rounded-full bg-muted" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-20 w-full rounded-2xl bg-muted" />
      </div>

      <div className="space-y-3">
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-4/5 rounded-full bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="h-32 rounded-2xl bg-muted" />
        <div className="h-32 rounded-2xl bg-muted" />
      </div>

      <div className="space-y-3">
        <div className="h-3 w-4/5 rounded-full bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {authorRow}
        {authorRow}
      </div>

      <div className="space-y-3">
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-3/5 rounded-full bg-muted" />
        <div className="h-3 w-[15%] rounded-full bg-muted" />
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
  branding: boolean;
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
  branding,
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
          className="pointer-events-auto absolute z-20 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_30px_60px_rgba(0,0,0,0.15)] transition-[top,left,transform] duration-300 ease-out"
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
          <div className="pointer-events-auto absolute top-4 right-4 z-30">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full bg-background/50 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-muted"
              onClick={handleClosePopup}
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          <div
            className={
              previewSettings.presentationMode === "field-by-field"
                ? "h-[650px] overflow-hidden"
                : "max-h-[650px] overflow-x-hidden overflow-y-auto"
            }
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

          {branding && (
            <div className="flex shrink-0 justify-center border-t border-border bg-muted/60 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                <span>Made with</span>
                <SparklesIcon className="size-3 fill-muted-foreground text-muted-foreground" />
                <span className="text-foreground">{APP_NAME}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!isPopupOpen && (
        <button
          type="button"
          onClick={handleOpenPopup}
          aria-label="Open form preview"
          className="pointer-events-auto absolute z-20 flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[inset] duration-300 ease-out hover:scale-105 active:scale-95"
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
  branding: boolean;
};

const FullpagePreviewSurface = ({
  transparentBackground,
  previewSettings,
  hideTitle,
  doc,
  content,
  customization,
  branding,
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
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden transition-colors duration-300",
        transparentBackground ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Field-by-field: cover as full-pane bg here — form-preview's bg-image only fills content height. */}
      {previewSettings.presentationMode === "field-by-field" && effectiveCover && (
        <FieldByFieldCoverBackground cover={effectiveCover} />
      )}
      <div
        className={cn(
          "h-full min-h-0 w-full flex-1",
          previewSettings.presentationMode !== "field-by-field" &&
            "overflow-x-hidden overflow-y-auto",
          previewSettings.presentationMode !== "field-by-field" && branding && "pb-16",
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
      {branding && <BrandingBadge />}
    </div>
  );
};

const FieldByFieldCoverBackground = ({ cover }: { cover: string }) => {
  const isImage = isValidUrl(cover);
  const isHex = isHexColor(cover);
  const hasTint = isImage && cover.includes("tint=true");
  if (!isImage && !isHex) return null;
  return (
    <>
      {isImage ? (
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0 size-full object-cover",
            hasTint && "brightness-60 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundColor: cover }}
        />
      )}
      {hasTint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-primary opacity-50 mix-blend-color"
        />
      )}
    </>
  );
};

const BrandingBadge = () => (
  <div className="absolute right-0 bottom-0 left-0 z-50 flex justify-center border-t border-border bg-muted/60 py-3 backdrop-blur">
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
      <span>Made with</span>
      <SparklesIcon className="size-3 fill-muted-foreground text-muted-foreground" />
      <span className="text-foreground">{APP_NAME}</span>
    </span>
  </div>
);
