import { APP_NAME, SPRITE_PATH } from "@/lib/config/app-config";
import { Link, useSearch } from "@tanstack/react-router";
import { SparklesIcon, XIcon } from "@/components/ui/icons";
import { iconMap } from "@/components/icon-picker/icon-data";
import { useState, useCallback, useMemo } from "react";
import type { Value } from "platejs";
import {
  FormPreviewFromPlate,
  isHexColor,
} from "@/components/form-components/form-preview-from-plate";
import { RenderStepPreviewInputEager } from "@/components/form-components/render-step-preview-input-eager";
import { PreviewRendererContext } from "@/components/form-components/render-step-preview-input";
import { Button } from "@/components/ui/button";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { useFormCustomization } from "@/hooks/use-form-customization";
import { useForm } from "@/hooks/use-live-hooks";
import { useResolvedTheme } from "@/components/theme-provider";
import { cn, isValidUrl } from "@/lib/utils";
import { buildPublicFormSettings } from "@/types/form-settings";
import type { PublicFormSettings } from "@/types/form-settings";

const noop = async () => {};

export const PreviewMode = ({ formId, workspaceId }: { formId: string; workspaceId: string }) => {
  const { data: savedDocs, isLoading } = useForm(formId);
  const doc = savedDocs?.[0];

  const resolvedAppTheme = useResolvedTheme();

  const { customization, hasCustomization, themeVars } = useFormCustomization(
    doc,
    resolvedAppTheme,
  );
  const content = (doc?.content as Value) || [];
  const docSettings = doc?.settings;
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
  const alignLeft = (search.embedAlignLeft as boolean) ?? false;
  const dynamicWidth = (search.embedDynamicWidth as boolean) ?? false;

  const [isPopupOpen, setIsPopupOpen] = useState(true);
  const handleClosePopup = useCallback(() => setIsPopupOpen(false), []);
  const handleOpenPopup = useCallback(() => setIsPopupOpen(true), []);

  const [lastEmbedType, setLastEmbedType] = useState(embedType);
  if (lastEmbedType !== embedType) {
    setLastEmbedType(embedType);
    if (embedType === "popup") setIsPopupOpen(true);
  }

  if (!isLoading && savedDocs !== undefined && savedDocs.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
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
    return <div className="flex h-full w-full items-center justify-center">Loading...</div>;
  }

  return (
    <PreviewRendererContext.Provider value={RenderStepPreviewInputEager}>
      <div
        className={cn(
          hasCustomization && "bf-themed",
          resolvedAppTheme === "dark" && "dark",
          "flex h-full w-full flex-col overflow-hidden bg-background text-foreground transition-colors duration-300",
        )}
        style={{
          ...(hasCustomization ? themeVars : undefined),
          viewTransitionName: "preview-content",
        }}
      >
        {embedType !== "fullpage" && (
          <div className="scrollbar-hide flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <div className="relative flex-1 p-4 lg:p-0">
              <div className="mx-auto max-w-[1000px] space-y-8 px-4 pt-4 lg:px-8">
                <div className="flex items-center pt-2">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground/40 uppercase">
                    Live Preview
                  </span>
                </div>

                <div className="space-y-4 opacity-40">
                  <div className="h-4 w-20 rounded-sm border border-border/50 bg-muted/50" />
                  <div className="flex items-end justify-between border-b border-border/30 pb-3">
                    <div className="flex gap-4 lg:gap-6">
                      <div className="h-1.5 w-8 rounded-full bg-muted/50 lg:w-10" />
                      <div className="h-1.5 w-8 rounded-full bg-muted/50 lg:w-10" />
                    </div>
                    <div className="h-6 w-12 rounded-md border border-border/30 bg-muted/30 lg:w-14" />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-4 pt-2 lg:gap-8">
                  <div className="col-span-3 hidden space-y-5 opacity-30 lg:block">
                    <div className="h-6 w-full rounded-sm bg-muted/40" />
                    <div className="space-y-2">
                      <div className="h-1.5 w-full rounded-full bg-muted/50" />
                      <div className="h-1.5 w-4/5 rounded-full bg-muted/50" />
                    </div>
                    <div className="h-24 w-full rounded-xl border border-dashed border-border/50 bg-muted/20" />
                  </div>

                  <div className="col-span-12 space-y-6 lg:col-span-9">
                    <div className="space-y-3 opacity-40">
                      <div className="h-5 w-2/3 rounded-sm border border-border/50 bg-muted/50" />
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-muted/50" />
                        <div className="h-1.5 w-full rounded-full bg-muted/50" />
                      </div>
                    </div>

                    {embedType === "standard" && (
                      <div className="group/embed relative">
                        <div className="pointer-events-none absolute -top-5 right-0 text-[8px] font-bold tracking-widest text-muted-foreground/30 uppercase">
                          Embedded State
                        </div>

                        <div
                          className={cn(
                            "w-full overflow-hidden rounded-lg border-2 border-dashed border-border transition-all duration-500",
                            transparentBackground
                              ? "bg-[repeating-conic-gradient(#e8e8e8_0%_25%,white_0%_50%)] bg-[length:12px_12px]"
                              : "bg-background",
                          )}
                          style={{
                            height: dynamicHeight ? "auto" : height,
                          }}
                        >
                          <div
                            className={cn(
                              "h-full w-full overflow-x-hidden",
                              !dynamicHeight &&
                                "scrollbar-thin scrollbar-thumb-muted-foreground/20 overflow-y-auto",
                              alignLeft ? "max-w-[600px]" : "",
                            )}
                            style={
                              dynamicWidth
                                ? ({ "--bf-page-width": "100%" } as React.CSSProperties)
                                : undefined
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
                              formId={formId}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-4 opacity-20">
                      <div className="h-1.5 w-full rounded-full bg-muted/50" />
                      <div className="h-1.5 w-3/4 rounded-full bg-muted/50" />
                    </div>

                    {branding && <BrandingBadge />}
                  </div>
                </div>
              </div>

              {embedType === "popup" && (
                <div className="pointer-events-none absolute inset-0 flex flex-col">
                  {darkOverlay && isPopupOpen && (
                    <button
                      type="button"
                      className="pointer-events-auto absolute inset-0 z-10 h-full w-full cursor-default border-none bg-black/40 transition-opacity duration-300"
                      onClick={handleClosePopup}
                      aria-label="Close preview"
                    />
                  )}

                  {isPopupOpen && (
                    <div
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
                            ? { top: "100%", left: 48, transform: "translateY(calc(-100% - 48px))" }
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
                          className="h-8 w-8 rounded-full bg-background/50 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-muted"
                          onClick={handleClosePopup}
                          aria-label="Close"
                        >
                          <XIcon className="h-4 w-4" />
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
                            <SparklesIcon className="h-3 w-3 fill-muted-foreground text-muted-foreground" />
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
                      className="pointer-events-auto absolute z-20 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[inset] duration-300 ease-out hover:scale-105 active:scale-95"
                      style={
                        popupPosition === "bottom-left"
                          ? { bottom: 24, left: 24, right: "auto" }
                          : { bottom: 24, right: "auto", left: "calc(100% - 80px)" }
                      }
                    >
                      {showEmoji && doc.icon && iconMap.has(doc.icon) ? (
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <use href={`${SPRITE_PATH}#${doc.icon}`} />
                        </svg>
                      ) : (
                        <svg
                          className="h-6 w-6"
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
              )}
            </div>
          </div>
        )}

        {embedType === "fullpage" && (
          <div
            className={cn(
              "relative flex flex-1 flex-col overflow-hidden transition-colors duration-300",
              transparentBackground ? "bg-transparent" : "bg-background",
            )}
          >
            {/* Field-by-field mode: render the cover as a full-pane background here
              because the form-preview's own bg-image only fills its content height. */}
            {previewSettings.presentationMode === "field-by-field" && doc.cover && (
              <FieldByFieldCoverBackground cover={doc.cover} />
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
                cover={doc.cover ?? undefined}
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
        )}
      </div>
    </PreviewRendererContext.Provider>
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
            "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover",
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
      <SparklesIcon className="h-3 w-3 fill-muted-foreground text-muted-foreground" />
      <span className="text-foreground">{APP_NAME}</span>
    </span>
  </div>
);
