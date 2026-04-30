import { ImageIcon, CircleUserRoundIcon, SettingsIcon, Trash2Icon } from "@/components/ui/icons";
import { IconPickerContent, IconPickerPreview } from "@/components/icon-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef } from "platejs/react";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { createFormButtonNode } from "@/components/ui/form-button-node";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  ImageCrop,
  ImageCropContent,
  ImageCropApply,
  ImageCropReset,
} from "@/components/ui/image-crop";
import type { FormHeaderElementData } from "@/lib/form-schema/form-header-factory";
import { THEME_COLORS } from "@/lib/theme/theme-presets";
import { DEFAULT_ICON } from "@/lib/config/app-config";
import { cn, isValidUrl } from "@/lib/utils";
export {
  createFormHeaderNode,
  type FormHeaderElementData,
} from "@/lib/form-schema/form-header-factory";

// Hoisted to module scope to avoid re-computing on every render
const ACCENT_COLORS = Object.values(THEME_COLORS).map((t) => t.primary);
const PRIMARY_TO_THEME_NAME = new Map(
  Object.entries(THEME_COLORS).map(([name, t]) => [t.primary, name]),
);

const COVER_GALLERY = [
  {
    src: "https://images.unsplash.com/photo-1604076850742-4c7221f3101b?w=800&q=80&tint=true",
    label: "Abstract mesh",
  },
  {
    src: "https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80&tint=true",
    label: "Abstract gradient",
  },
  {
    src: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80&tint=true",
    label: "Abstract geometric",
  },
  {
    src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80&tint=true",
    label: "Abstract liquid",
  },
  {
    src: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&q=80&tint=true",
    label: "3D shapes",
  },
  {
    src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80&tint=true",
    label: "Gradient curves",
  },
  {
    src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80&tint=true",
    label: "Geometric waves",
  },
  {
    src: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80&tint=true",
    label: "Abstract paint",
  },
] as const;

const CoverUpload = ({
  currentCover,
  onUpload,
  onCancel,
}: {
  currentCover: string | null;
  onUpload: (url: string) => void;
  onCancel: () => void;
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [
    { isDragging, errors },
    { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    accept: "image/*",
    multiple: false,
    onFilesChange: (files) => {
      if (files[0]?.file) {
        setPreviewUrl(URL.createObjectURL(files[0].file as File));
      }
    },
  });

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setPreviewUrl(URL.createObjectURL(file));
          }
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (previewUrl) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col items-center justify-center py-4">
          <p className="mb-3 text-xs text-muted-foreground">Preview</p>
          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <img
              src={previewUrl}
              alt="Preview"
              width={260}
              height={120}
              className="max-h-[120px] max-w-[260px] object-cover"
            />
          </div>
        </div>

        {errors.length > 0 && (
          <p className="pb-2 text-center text-xs text-destructive">{errors[0]}</p>
        )}

        <div className="flex items-center justify-between pt-1 pb-3">
          <Button variant="ghost" size="sm" onClick={resetState}>
            Back
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              onUpload(previewUrl);
              resetState();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="py-4">
        {currentCover && !currentCover.startsWith("#") ? (
          <button
            type="button"
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 py-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/50"
            onClick={openFileDialog}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input {...getInputProps()} className="sr-only" />
            <img
              src={currentCover}
              alt="Current cover"
              width={200}
              height={80}
              className="max-h-[80px] max-w-[200px] rounded-lg object-cover"
            />
            <span className="text-xs text-muted-foreground">Click to replace</span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex h-24 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-dashed transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/50",
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <input {...getInputProps()} className="sr-only" />
            <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
            <span className="text-sm text-muted-foreground">Upload an image</span>
          </button>
        )}
      </div>

      <p className="pb-3 text-center text-xs text-muted-foreground/60">
        or {PASTE_HINT} to paste an image or link
      </p>

      {errors.length > 0 && (
        <p className="pb-2 text-center text-xs text-destructive">{errors[0]}</p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-1 pb-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);
const PASTE_HINT = IS_MAC ? "\u2318+V" : "Ctrl+V";

const IconUploadTab = ({
  currentIcon,
  onUpload,
  onCancel,
}: {
  currentIcon: string | null;
  onUpload: (url: string) => void;
  onCancel: () => void;
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [
    { isDragging, errors },
    { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    accept: "image/*",
    multiple: false,
    onFilesChange: (files) => {
      if (files[0]?.file) {
        const file = files[0].file as File;
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    },
  });

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
          }
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  const resetState = () => {
    setSelectedFile(null);
    setShowCrop(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  if (showCrop && selectedFile) {
    return (
      <div className="flex w-[310px] flex-col px-3">
        <ImageCrop
          file={selectedFile}
          aspect={1}
          onCrop={(croppedImage) => {
            onUpload(croppedImage);
            resetState();
          }}
        >
          <div className="flex items-center justify-center overflow-hidden py-3">
            <ImageCropContent className="max-h-[250px] max-w-full rounded-lg" />
          </div>
          <div className="flex items-center justify-between pt-1 pb-3">
            <ImageCropReset render={<Button variant="ghost" size="sm" />}>Reset</ImageCropReset>
            <ImageCropApply render={<Button variant="default" size="sm" />}>Save</ImageCropApply>
          </div>
        </ImageCrop>
      </div>
    );
  }

  if (selectedFile && previewUrl) {
    return (
      <div className="flex w-[310px] flex-col px-3">
        <div className="flex flex-col items-center justify-center py-4">
          <p className="mb-3 text-xs text-muted-foreground">Preview</p>
          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <img
              src={previewUrl}
              alt="Preview"
              width={180}
              height={180}
              className="max-h-[180px] max-w-[180px] object-contain"
            />
          </div>
        </div>

        {errors.length > 0 && (
          <p className="pb-2 text-center text-xs text-destructive">{errors[0]}</p>
        )}

        <div className="flex items-center justify-between pt-1 pb-3">
          <Button variant="ghost" size="sm" onClick={resetState}>
            Back
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowCrop(true)}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-[310px] flex-col px-3">
      <div className="py-4">
        {currentIcon ? (
          <button
            type="button"
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 py-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/50"
            onClick={openFileDialog}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input {...getInputProps()} className="sr-only" />
            <img
              src={currentIcon}
              alt="Current icon"
              width={80}
              height={80}
              className="max-h-[80px] max-w-[80px] rounded-lg object-contain"
            />
            <span className="text-xs text-muted-foreground">Click to replace</span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex h-24 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-dashed transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/50",
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <input {...getInputProps()} className="sr-only" />
            <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
            <span className="text-sm text-muted-foreground">Upload an image</span>
          </button>
        )}
      </div>

      <p className="pb-3 text-center text-xs text-muted-foreground/60">
        or {PASTE_HINT} to paste an image or link
      </p>

      {errors.length > 0 && (
        <p className="pb-2 text-center text-xs text-destructive">{errors[0]}</p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-1 pb-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

const iconTabs = [
  { value: "icon", label: "Icon" },
  { value: "upload", label: "Upload" },
] as const;

const IconTabBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const items = iconTabs;
  const activeIndex = items.findIndex((t) => t.value === value);
  const count = items.length;
  const pillLeft = `calc(${(activeIndex / count) * 100}% + 3px)`;
  const pillWidth = `calc(${100 / count}% - ${6 / count}px)`;

  return (
    <div className="relative flex flex-1 rounded-[10px] bg-secondary p-[3px]">
      <div
        className="absolute top-[3px] bottom-[3px] z-0 rounded-[8px] bg-white shadow-[0px_0px_1.5px_0px_rgba(0,0,0,0.16),0px_2px_5px_0px_rgba(0,0,0,0.14)] transition-[left,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:bg-background"
        style={{ left: pillLeft, width: pillWidth }}
      />
      {items.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "relative z-10 h-7 flex-1 rounded-[8px] text-center text-sm transition-colors",
            value === tab.value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export const FormHeaderElement = (props: PlateElementProps) => {
  const { element, children } = props;
  const editor = useEditorRef();
  const {
    hasCustomization,
    themeVars,
    customization: editorCustomization,
    updateThemeColor,
  } = useEditorTheme();
  const { activeSidebar, closeSidebar, openCustomize } = useEditorSidebar();
  const toggleCustomize = useCallback(() => {
    if (activeSidebar === "customize") {
      closeSidebar();
    } else {
      openCustomize();
    }
  }, [activeSidebar, closeSidebar, openCustomize]);

  const title = (element.title as string) || "";
  const icon = (element.icon as string | null) || null;
  const iconColor = (element.iconColor as string | null) || null;
  const cover = (element.cover as string | null) || null;

  const hasCover = !!cover;
  const hasLogo = !!icon;

  const updateHeader = useCallback(
    (updates: Partial<FormHeaderElementData>) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes(updates, { at: path });
      }
    },
    [editor, element],
  );

  const titleRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTitle = useCallback(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  const titleFontSize = editorCustomization?.titleFontSize;
  const titleFont = editorCustomization?.titleFont;

  useEffect(() => {
    autoResizeTitle();
  }, [title, titleFontSize, titleFont, autoResizeTitle]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      updateHeader({ title: newTitle });
    },
    [updateHeader],
  );

  const handleIconChange = useCallback(
    (newIcon: string | null) => {
      updateHeader({ icon: newIcon });
    },
    [updateHeader],
  );

  const handleIconColorChange = useCallback(
    (newColor: string) => {
      updateHeader({ iconColor: newColor });
    },
    [updateHeader],
  );

  const handleCoverChange = useCallback(
    (newCover: string | null) => {
      updateHeader({ cover: newCover });
    },
    [updateHeader],
  );

  const handleAddCover = useCallback(
    () =>
      handleCoverChange(
        "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80&tint=true",
      ),
    [handleCoverChange],
  );

  const accentColors = hasCustomization ? ACCENT_COLORS : undefined;
  const activeThemeColorName = editorCustomization?.themeColor || "zinc";
  const activeAccentColor =
    THEME_COLORS[activeThemeColorName]?.primary || THEME_COLORS.zinc.primary;
  const isLogoMinimal =
    hasCustomization &&
    editorCustomization?.logoWidth &&
    Number.parseInt(editorCustomization.logoWidth) <= 0;

  const logoCircleSize =
    hasCustomization && editorCustomization?.logoWidth
      ? String(Math.max(48, Number.parseInt(editorCustomization.logoWidth)))
      : "100";

  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [iconTab, setIconTab] = useState("icon");
  const [coverPopoverOpen, setCoverPopoverOpen] = useState(false);

  return (
    <PlateElement
      {...props}
      attributes={{ ...props.attributes, "data-bf-header": "", "data-bf-chrome": "" }}
    >
      <div
        contentEditable={false}
        className="group relative mb-4 flex w-full flex-col rounded-none select-none"
      >
        {hasCover && (
          <>
            <div
              className="group/cover relative right-[50%] left-[50%] -mr-[50vw] -ml-[50vw] h-[120px] w-screen bg-muted/20 sm:h-[200px]"
              data-bf-cover
            >
              {cover && !cover.startsWith("#") ? (
                <>
                  {cover.includes("tint=true") && (
                    <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  )}
                  <img
                    src={cover}
                    alt="Cover"
                    width={800}
                    height={200}
                    className={cn(
                      "h-full w-full border-0 object-cover",
                      cover.includes("tint=true") && "relative z-0 brightness-60 grayscale",
                    )}
                  />
                </>
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    backgroundColor: cover?.startsWith("#") ? cover : "#FFE4E1",
                  }}
                />
              )}
            </div>
            <Popover open={coverPopoverOpen} onOpenChange={setCoverPopoverOpen}>
              <div
                className="absolute top-2 z-30 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ right: "calc(var(--editor-px, 64px) * -1 + 16px)" }}
              >
                <ButtonGroup className="rounded-lg border border-border bg-background/80 shadow-lg backdrop-blur-sm">
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-none rounded-l-lg border-none text-xs text-foreground/80 hover:bg-secondary hover:text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                      />
                    }
                  >
                    Change
                  </PopoverTrigger>
                  <ButtonGroupSeparator className="bg-border" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none border-none text-xs text-foreground/80 hover:bg-secondary hover:text-foreground"
                    onClick={() => handleCoverChange(null)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Remove
                  </Button>
                  <ButtonGroupSeparator className="bg-border" />
                </ButtonGroup>
              </div>

              <PopoverContent align="end" side="bottom" className="w-[310px] p-0" sideOffset={8}>
                <Tabs defaultValue="gallery" className="w-full">
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    <TabsList className="w-full">
                      <TabsTrigger value="gallery">Gallery</TabsTrigger>
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsIndicator />
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        handleCoverChange(null);
                        setCoverPopoverOpen(false);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label="Remove cover"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>

                  <TabsContent value="gallery" className="mt-0 px-3 pb-3">
                    <p className="mt-1 mb-2 text-xs text-muted-foreground">Abstract</p>
                    <div className="grid grid-cols-3 gap-2">
                      {COVER_GALLERY.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            handleCoverChange(item.src);
                            setCoverPopoverOpen(false);
                          }}
                          className="relative h-16 cursor-pointer overflow-hidden rounded-lg bg-muted ring-primary ring-offset-1 ring-offset-background transition-all hover:scale-[1.02] hover:ring-2"
                          aria-label={item.label}
                        >
                          <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                          <img
                            src={item.src}
                            alt={item.label}
                            width={200}
                            height={64}
                            className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                          />
                        </button>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="upload" className="mt-0 px-3 pb-3">
                    <CoverUpload
                      currentCover={cover}
                      onUpload={(url) => {
                        handleCoverChange(url);
                        setCoverPopoverOpen(false);
                      }}
                      onCancel={() => setCoverPopoverOpen(false)}
                    />
                  </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
          </>
        )}
        <div className={cn("relative flex w-full flex-col")}>
          <div className="w-full">
            <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
              {hasLogo && (
                <div
                  className={cn("relative z-10 mb-1", hasCover ? "-mt-[50px]" : "mt-4 sm:mt-6")}
                  data-bf-logo-emoji-container={
                    hasCover && icon && !isValidUrl(icon) ? "true" : undefined
                  }
                  data-bf-logo-container={hasCover && icon && isValidUrl(icon) ? "true" : undefined}
                >
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="cursor-pointer transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label="Change icon"
                      />
                    }
                  >
                    {icon && icon !== DEFAULT_ICON ? (
                      isValidUrl(icon) ? (
                        <img
                          src={icon}
                          alt="Logo"
                          width={120}
                          height={120}
                          className="h-[100px] w-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
                          data-bf-logo
                        />
                      ) : (
                        <span data-bf-logo-icon={isLogoMinimal ? "minimal" : ""}>
                          <IconPickerPreview
                            icon={icon}
                            iconColor={hasCustomization ? undefined : iconColor || undefined}
                            useThemeColor={hasCustomization || !iconColor}
                            iconSize="48"
                            size={logoCircleSize}
                          />
                        </span>
                      )
                    ) : (
                      <span data-bf-logo-icon={isLogoMinimal ? "minimal" : ""}>
                        <IconPickerPreview
                          icon={null}
                          iconColor={undefined}
                          useThemeColor
                          iconSize="48"
                          size={logoCircleSize}
                        />
                      </span>
                    )}
                  </PopoverTrigger>
                </div>
              )}

              <div
                className={cn(
                  "mb-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                  !hasCover && !hasLogo && "mt-8 sm:mt-12",
                  hasCover && !hasLogo && "mt-4",
                  !hasCover && hasLogo && "mt-0",
                )}
              >
                {!hasLogo && (
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        prefix={<CircleUserRoundIcon />}
                        onMouseDown={(e) => e.preventDefault()}
                      />
                    }
                  >
                    Add icon
                  </PopoverTrigger>
                )}
                {!hasCover && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddCover}
                    prefix={<ImageIcon />}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Add cover
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleCustomize}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <SettingsIcon />
                  Customize
                </Button>
              </div>

              <PopoverContent
                align="start"
                side="bottom"
                className={cn(
                  "w-[310px] p-0",
                  hasCustomization && "bf-themed",
                  hasCustomization && editorCustomization?.mode === "dark" && "dark",
                )}
                style={hasCustomization ? themeVars : undefined}
              >
                <div className="w-full">
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    <IconTabBar value={iconTab} onChange={setIconTab} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        handleIconChange(null);
                        setIconPopoverOpen(false);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      aria-label="Remove icon"
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  {iconTab === "icon" ? (
                    <IconPickerContent
                      iconValue={icon && icon !== DEFAULT_ICON && !isValidUrl(icon) ? icon : null}
                      iconColor={hasCustomization ? activeAccentColor : iconColor || "#000000"}
                      onIconChange={(newIcon) => {
                        handleIconChange(newIcon);
                        setIconPopoverOpen(false);
                      }}
                      onColorChange={(color) => {
                        if (hasCustomization && updateThemeColor) {
                          const themeName = PRIMARY_TO_THEME_NAME.get(color);
                          if (themeName) updateThemeColor(themeName);
                        } else {
                          handleIconColorChange(color);
                        }
                      }}
                      colors={accentColors}
                    />
                  ) : (
                    <IconUploadTab
                      currentIcon={icon && isValidUrl(icon) ? icon : null}
                      onUpload={(url) => {
                        handleIconChange(url);
                        setIconPopoverOpen(false);
                      }}
                      onCancel={() => setIconPopoverOpen(false)}
                    />
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="group/title relative">
              <textarea
                ref={titleRef}
                rows={1}
                aria-label="Form title"
                className="h-auto w-full resize-none overflow-hidden border-none bg-transparent py-1 font-['Timeless_Serif'] text-[48px] leading-tight font-[252] tracking-[-1.44px] text-foreground outline-none select-text placeholder:font-['Timeless_Serif'] placeholder:text-foreground/50 sm:py-2"
                placeholder="Create your form."
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onFocus={autoResizeTitle}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const firstBlockPath = [1];
                    // eslint-disable-next-line typescript-eslint/no-explicit-any
                    const startPoint = (editor.api as any).edges(firstBlockPath)?.[0];
                    if (startPoint) {
                      editor.tf.select(startPoint);
                      editor.tf.focus();
                    }
                    return;
                  }
                  if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    const firstBlockPath = [1];
                    // eslint-disable-next-line typescript-eslint/no-explicit-any
                    const startPoint = (editor.api as any).edges(firstBlockPath)?.[0];
                    if (startPoint) {
                      editor.tf.select(startPoint);
                      editor.tf.focus();
                    }
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const secondBlock = editor.children[1] as { type?: string };
                    const isOnboarding = secondBlock?.type === "onboardingContent";

                    if (isOnboarding) {
                      // Clear to empty state: header + empty paragraph + submit button
                      const currentHeader = editor.children[0];
                      const emptyContent = [
                        currentHeader,
                        { type: "p", children: [{ text: "" }] },
                        createFormButtonNode("submit"),
                      ];
                      editor.tf.init({
                        // eslint-disable-next-line typescript-eslint/no-explicit-any
                        value: emptyContent as any,
                      });
                      const firstBlockPath = [1];
                      // eslint-disable-next-line typescript-eslint/no-explicit-any
                      const startPoint = (editor.api as any).edges(firstBlockPath)?.[0];
                      if (startPoint) {
                        editor.tf.select(startPoint);
                        editor.tf.focus();
                      }
                    } else {
                      const firstBlockPath = [1];
                      // eslint-disable-next-line typescript-eslint/no-explicit-any
                      const startPoint = (editor.api as any).edges(firstBlockPath)?.[0];
                      if (startPoint) {
                        editor.tf.select(startPoint);
                        editor.tf.focus();
                      }
                    }
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      </div>
      {children}
    </PlateElement>
  );
};
