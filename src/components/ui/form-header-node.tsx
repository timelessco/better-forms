import { ImageIcon, CircleUserRoundIcon, Trash2Icon } from "@/components/ui/icons";
import { IconPickerContent, IconPickerPreview } from "@/components/icon-picker";
import { Activity, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef } from "platejs/react";
import { Button } from "@/components/ui/button";
import { createFormButtonNode } from "@/components/ui/form-button-node";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorTheme } from "@/contexts/editor-theme-context";
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
            <ImageIcon className="size-5 text-muted-foreground/60" />
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
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in JSX to gate the crop dialog
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
            <ImageIcon className="size-5 text-muted-foreground/60" />
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
    if (!el) return;
    /* eslint-disable react-doctor/js-batch-dom-css -- auto-resize needs write→read→write to measure scrollHeight */
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    /* eslint-enable react-doctor/js-batch-dom-css */
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

  // Default cover from Figma (saved locally in /public; full-color, no tint).
  const handleAddCover = useCallback(
    () => handleCoverChange("/header-image.png"),
    [handleCoverChange],
  );

  const coverPosition = (element.coverPosition as number | undefined) ?? 50;
  const handleCoverPositionChange = useCallback(
    (pos: number) => updateHeader({ coverPosition: pos }),
    [updateHeader],
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
  // Lazy-mount Upload tab on first use, then keep alive via <Activity> so drag-state and
  // in-flight uploads survive Icon ↔ Upload switches.
  const [openedUploadTab, setOpenedUploadTab] = useState(false);
  if (iconTab === "upload" && !openedUploadTab) setOpenedUploadTab(true);
  const [coverPopoverOpen, setCoverPopoverOpen] = useState(false);

  return (
    <PlateElement
      {...props}
      attributes={{ ...props.attributes, "data-bf-header": "", "data-bf-chrome": "" }}
    >
      <div
        contentEditable={false}
        className="group relative flex w-full flex-col rounded-none select-none"
      >
        {hasCover && (
          <HeaderCoverSection
            cover={cover}
            coverPosition={coverPosition}
            coverPopoverOpen={coverPopoverOpen}
            onCoverPopoverOpenChange={setCoverPopoverOpen}
            onCoverChange={handleCoverChange}
            onCoverPositionChange={handleCoverPositionChange}
            // Right-aligned form → logo sits bottom-right, so flip the pill to the left.
            pillSide={editorCustomization?.textAlign === "right" ? "left" : "right"}
          />
        )}
        <div className={cn("relative flex w-full flex-col")}>
          <div className="w-full">
            <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
              {hasLogo && (
                <div
                  // pointer-events-none: this block is full content-width but the circle is
                  // only ~100px (centered via text-align). Left auto, its transparent flanks
                  // overlap the cover's bottom strip (-mt-[50px], z-10) and would swallow the
                  // cover-hover/Change·Reposition pill region. The button below re-enables events.
                  className={cn(
                    "pointer-events-none relative z-10 mb-1",
                    hasCover ? "-mt-[50px]" : "mt-4 sm:mt-6",
                  )}
                  data-bf-logo-emoji-container={
                    hasCover && icon && !isValidUrl(icon) ? "true" : undefined
                  }
                  data-bf-logo-container={hasCover && icon && isValidUrl(icon) ? "true" : undefined}
                >
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="pointer-events-auto cursor-pointer transition-colors"
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
                          className="size-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
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

              {/* Toolbar carries no bottom gap; the title owns its top gap (mt-4 below),
                  so the title→cover/logo spacing is constant whether or not the toolbar
                  has any buttons. */}
              <div
                className={cn(
                  "flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
                  !hasCover && !hasLogo && "mt-8 sm:mt-12",
                  hasCover && !hasLogo && "mt-4",
                  hasLogo && "mt-0",
                )}
              >
                {!hasLogo && (
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        prefix={<CircleUserRoundIcon className="size-4" />}
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
                    prefix={<ImageIcon className="size-4" />}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    Add cover
                  </Button>
                )}
              </div>

              <HeaderIconPopoverContent
                icon={icon}
                iconColor={iconColor}
                iconTab={iconTab}
                openedUploadTab={openedUploadTab}
                onIconTabChange={setIconTab}
                onIconChange={handleIconChange}
                onIconColorChange={handleIconColorChange}
                onClose={() => setIconPopoverOpen(false)}
                hasCustomization={hasCustomization}
                themeVars={themeVars}
                themeMode={editorCustomization?.mode}
                activeAccentColor={activeAccentColor}
                accentColors={accentColors}
                updateThemeColor={updateThemeColor}
              />
            </Popover>

            <HeaderTitleTextarea
              ref={titleRef}
              title={title}
              onTitleChange={handleTitleChange}
              onAutoResize={autoResizeTitle}
              editor={editor}
            />
          </div>
        </div>
      </div>
      {children}
    </PlateElement>
  );
};

/**
 * Cover gallery + upload popover body. Shared by the editor's in-cover "Change" button and
 * the Customize sidebar's Cover row so both open the identical picker. Render inside a
 * <Popover>; pass onClose to dismiss after a pick/remove.
 */
export const CoverPickerContent = ({
  cover,
  onCoverChange,
  onClose,
}: {
  cover: string | null;
  onCoverChange: (cover: string | null) => void;
  onClose: () => void;
}) => (
  <PopoverContent align="end" side="bottom" className="w-[310px] p-0" sideOffset={8}>
    <Tabs defaultValue="gallery" className="w-full">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <TabsList className="w-full">
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsIndicator />
        </TabsList>
        <Button
          variant="ghost-flat"
          size="icon"
          className="shrink-0 rounded-lg p-1.25 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            onCoverChange(null);
            onClose();
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
                onCoverChange(item.src);
                onClose();
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
                className="relative z-0 size-full object-cover brightness-60 grayscale"
              />
            </button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="upload" className="mt-0 px-3 pb-3">
        <CoverUpload
          currentCover={cover}
          onUpload={(url) => {
            onCoverChange(url);
            onClose();
          }}
          onCancel={onClose}
        />
      </TabsContent>
    </Tabs>
  </PopoverContent>
);

/**
 * Logo (icon + upload) picker popover body, self-contained for the Customize sidebar — mirrors the
 * editor's in-header icon popover but without the theme-color coupling (the sidebar mounts above
 * the editor theme provider). Render inside a <Popover>; pass onClose to dismiss after a pick.
 */
export const LogoPickerContent = ({
  icon,
  iconColor,
  onIconChange,
  onIconColorChange,
  onClose,
}: {
  icon: string | null;
  iconColor: string | null;
  onIconChange: (icon: string | null) => void;
  onIconColorChange: (color: string) => void;
  onClose: () => void;
}) => {
  const [tab, setTab] = useState("icon");
  // Lazy-mount Upload tab, then keep alive via <Activity> so in-flight uploads survive tab switches.
  const [openedUpload, setOpenedUpload] = useState(false);
  if (tab === "upload" && !openedUpload) setOpenedUpload(true);
  return (
    <PopoverContent align="end" side="bottom" keepMounted className="w-[310px] p-0" sideOffset={8}>
      <div className="w-full">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <IconTabBar value={tab} onChange={setTab} />
          <Button
            variant="ghost-flat"
            size="icon"
            className="shrink-0 rounded-lg p-1.25 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onIconChange(null);
              onClose();
            }}
            onMouseDown={(e) => e.preventDefault()}
            aria-label="Remove logo"
          >
            <Trash2Icon />
          </Button>
        </div>
        <Activity mode={tab === "icon" ? "visible" : "hidden"}>
          <IconPickerContent
            iconValue={icon && icon !== DEFAULT_ICON && !isValidUrl(icon) ? icon : null}
            iconColor={iconColor || "#000000"}
            onIconChange={(newIcon) => {
              onIconChange(newIcon);
              onClose();
            }}
            onColorChange={onIconColorChange}
          />
        </Activity>
        {openedUpload && (
          <Activity mode={tab === "upload" ? "visible" : "hidden"}>
            <IconUploadTab
              currentIcon={icon && isValidUrl(icon) ? icon : null}
              onUpload={(url) => {
                onIconChange(url);
                onClose();
              }}
              onCancel={onClose}
            />
          </Activity>
        )}
      </div>
    </PopoverContent>
  );
};

interface HeaderCoverSectionProps {
  cover: string;
  coverPosition: number;
  coverPopoverOpen: boolean;
  onCoverPopoverOpenChange: (open: boolean) => void;
  onCoverChange: (cover: string | null) => void;
  onCoverPositionChange: (pos: number) => void;
  /** Which cover corner the Change·Reposition pill anchors to (opposite the logo). */
  pillSide: "left" | "right";
}

const HeaderCoverSection = ({
  cover,
  coverPosition,
  coverPopoverOpen,
  onCoverPopoverOpenChange,
  onCoverChange,
  onCoverPositionChange,
  pillSide,
}: HeaderCoverSectionProps) => {
  const coverRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [draftPosition, setDraftPosition] = useState(coverPosition);
  const hasImage = !!cover && !cover.startsWith("#");
  const position = repositioning ? draftPosition : coverPosition;

  // The pill is portaled to <body> and anchored to the cover's visible bottom-right corner.
  // We clamp to the editor viewport's right edge (which shrinks when the Customize sidebar
  // opens) so the pill never lands on top of the sidebar: Fill is clipped to that edge, Fit
  // rides 12px inside the cover; either way it stays 16px off the viewport at minimum.
  const [coverHovered, setCoverHovered] = useState(false);
  const [pillTop, setPillTop] = useState(0);
  const [pillRight, setPillRight] = useState(16);
  const [pillLeft, setPillLeft] = useState(16);
  const showPill = coverHovered || repositioning || coverPopoverOpen;
  const measurePill = useCallback(() => {
    const el = coverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPillTop(rect.bottom);
    const editorRect = el.closest(".slate-editor")?.getBoundingClientRect();
    const visibleRight = Math.min(rect.right, editorRect?.right ?? rect.right);
    setPillRight(Math.max(16, window.innerWidth - visibleRight + 12));
    // Left anchor (right-aligned forms): ride 12px inside the cover's visible left edge.
    const visibleLeft = Math.max(rect.left, editorRect?.left ?? rect.left);
    setPillLeft(Math.max(16, visibleLeft + 12));
  }, []);
  useEffect(() => {
    if (!showPill) return;
    measurePill();
    window.addEventListener("scroll", measurePill, true);
    window.addEventListener("resize", measurePill);
    // Sidebar open/close reflows the editor pane without a window resize, and a full-bleed
    // cover's own size doesn't change — observe the pane so the pill re-measures regardless.
    const pane = coverRef.current?.closest(".slate-editor") ?? coverRef.current;
    const ro = pane ? new ResizeObserver(measurePill) : null;
    if (pane && ro) ro.observe(pane);
    return () => {
      window.removeEventListener("scroll", measurePill, true);
      window.removeEventListener("resize", measurePill);
      ro?.disconnect();
    };
  }, [showPill, measurePill]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!repositioning || !hasImage) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startPos: draftPosition };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = coverRef.current;
    if (!drag || !el) return;
    // Drag down → reveal more of the image's top → lower object-position-y.
    const delta = ((e.clientY - drag.startY) / (el.offsetHeight || 1)) * 100;
    setDraftPosition(Math.max(0, Math.min(100, drag.startPos - delta)));
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <Popover open={coverPopoverOpen} onOpenChange={onCoverPopoverOpenChange}>
      <div
        ref={coverRef}
        className={cn(
          "group/cover relative right-[50%] left-[50%] -mr-[50cqw] -ml-[50cqw] h-[120px] w-[100cqw] bg-muted/20 sm:h-[200px]",
          repositioning && "cursor-grab touch-none active:cursor-grabbing",
        )}
        data-bf-cover
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={() => setCoverHovered(true)}
        onMouseLeave={() => setCoverHovered(false)}
      >
        {/* Ambient glow (Figma 25690:11807): blurred copy of the cover behind the card so the
            shadow takes the photo's colours. Fit-only — styles.css gates it via --bf-cover-glow. */}
        {hasImage && (
          <img
            src={cover}
            alt=""
            aria-hidden
            data-bf-cover-glow
            draggable={false}
            style={{ objectPosition: `center ${position}%` }}
          />
        )}
        {hasImage ? (
          <>
            {cover.includes("tint=true") && (
              <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
            )}
            <img
              src={cover}
              alt="Cover"
              width={800}
              height={200}
              draggable={false}
              className={cn(
                "size-full border-0 object-cover select-none",
                cover.includes("tint=true") && "relative z-0 brightness-60 grayscale",
              )}
              style={{ objectPosition: `center ${position}%` }}
            />
          </>
        ) : (
          <div
            className="size-full"
            style={{
              backgroundColor: cover?.startsWith("#") ? cover : "#FFE4E1",
            }}
          />
        )}
        {/* Cover fade lives in CSS on [data-bf-cover] (styles.css) so the editor, Preview,
            and public render share one definition. */}
      </div>

      {/* Change | Reposition (Figma 25424:13193) — portaled to <body>, fixed and anchored to
          the cover's measured bottom-right corner (see measurePill for the Fit/Fill clamp).
          createPortal keeps it inside the Popover's React context. */}
      {showPill &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={() => setCoverHovered(true)}
            onMouseLeave={() => setCoverHovered(false)}
            style={{
              position: "fixed",
              top: pillTop - 12,
              ...(pillSide === "left" ? { left: pillLeft } : { right: pillRight }),
              transform: "translateY(-100%)",
              zIndex: 50,
            }}
          >
            {repositioning ? (
              <button
                type="button"
                onClick={() => {
                  onCoverPositionChange(Math.round(draftPosition));
                  setRepositioning(false);
                }}
                onMouseDown={(e) => e.preventDefault()}
                className="rounded-lg bg-black/45 px-2 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/55"
              >
                Save position
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-black/45 px-2 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="rounded transition-opacity hover:opacity-80"
                      onMouseDown={(e) => e.preventDefault()}
                    />
                  }
                >
                  Change
                </PopoverTrigger>
                <span aria-hidden="true" className="h-4 w-px bg-white/30" />
                <button
                  type="button"
                  onClick={() => {
                    setDraftPosition(coverPosition);
                    setRepositioning(true);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!hasImage}
                  className="rounded transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reposition
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}

      <CoverPickerContent
        cover={cover}
        onCoverChange={onCoverChange}
        onClose={() => onCoverPopoverOpenChange(false)}
      />
    </Popover>
  );
};

interface HeaderTitleTextareaProps {
  ref: React.Ref<HTMLTextAreaElement>;
  title: string;
  onTitleChange: (value: string) => void;
  onAutoResize: () => void;
  editor: ReturnType<typeof useEditorRef>;
}

const HeaderTitleTextarea = ({
  ref,
  title,
  onTitleChange,
  onAutoResize,
  editor,
}: HeaderTitleTextareaProps) => {
  const moveToFirstBlock = useCallback(() => {
    const firstBlockPath = [1];
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    const startPoint = (editor.api as any).edges(firstBlockPath)?.[0];
    if (startPoint) {
      editor.tf.select(startPoint);
      editor.tf.focus();
    }
  }, [editor]);

  return (
    // mt-4 (16px, Figma) is the title's own top gap. When the toolbar above is empty
    // (cover + logo both present) its zero height lets this margin collapse through, so
    // the cover/logo→title spacing is anchored to the title, not the toolbar's contents.
    <div className="group/title relative mt-4">
      <textarea
        ref={ref}
        rows={1}
        aria-label="Form title"
        className="h-auto w-full resize-none overflow-hidden border-none bg-transparent pt-1 font-['Timeless_Serif'] text-[48px] leading-[1.15] font-[252] tracking-[-1.44px] text-foreground outline-none select-text placeholder:font-['Timeless_Serif'] placeholder:text-foreground/50 sm:pt-2"
        placeholder="Create your form."
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onFocus={onAutoResize}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            moveToFirstBlock();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const secondBlock = editor.children[1] as { type?: string };
            const isOnboarding = secondBlock?.type === "onboardingContent";
            if (isOnboarding) {
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
            }
            moveToFirstBlock();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
};

interface HeaderIconPopoverContentProps {
  icon: string | null;
  iconColor: string | null;
  iconTab: string;
  openedUploadTab: boolean;
  onIconTabChange: (tab: string) => void;
  onIconChange: (icon: string | null) => void;
  onIconColorChange: (color: string) => void;
  onClose: () => void;
  hasCustomization: boolean;
  themeVars: React.CSSProperties;
  themeMode: string | undefined;
  activeAccentColor: string;
  accentColors: string[] | undefined;
  updateThemeColor: ((themeColor: string) => void) | undefined;
}

const HeaderIconPopoverContent = ({
  icon,
  iconColor,
  iconTab,
  openedUploadTab,
  onIconTabChange,
  onIconChange,
  onIconColorChange,
  onClose,
  hasCustomization,
  themeVars,
  themeMode,
  activeAccentColor,
  accentColors,
  updateThemeColor,
}: HeaderIconPopoverContentProps) => (
  <PopoverContent
    align="start"
    side="bottom"
    keepMounted
    className={cn(
      "w-[310px] p-0",
      hasCustomization && "bf-themed",
      hasCustomization && themeMode === "dark" && "dark",
    )}
    style={hasCustomization ? themeVars : undefined}
  >
    <div className="w-full">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <IconTabBar value={iconTab} onChange={onIconTabChange} />
        <Button
          variant="ghost-flat"
          size="icon"
          className="shrink-0 rounded-lg p-1.25 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            onIconChange(null);
            onClose();
          }}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="Remove icon"
        >
          <Trash2Icon />
        </Button>
      </div>
      <Activity mode={iconTab === "icon" ? "visible" : "hidden"}>
        <IconPickerContent
          iconValue={icon && icon !== DEFAULT_ICON && !isValidUrl(icon) ? icon : null}
          iconColor={hasCustomization ? activeAccentColor : iconColor || "#000000"}
          onIconChange={(newIcon) => {
            onIconChange(newIcon);
            onClose();
          }}
          onColorChange={(color) => {
            if (hasCustomization && updateThemeColor) {
              const themeName = PRIMARY_TO_THEME_NAME.get(color);
              if (themeName) updateThemeColor(themeName);
            } else {
              onIconColorChange(color);
            }
          }}
          colors={accentColors}
        />
      </Activity>
      {openedUploadTab && (
        <Activity mode={iconTab === "upload" ? "visible" : "hidden"}>
          <IconUploadTab
            currentIcon={icon && isValidUrl(icon) ? icon : null}
            onUpload={(url) => {
              onIconChange(url);
              onClose();
            }}
            onCancel={onClose}
          />
        </Activity>
      )}
    </div>
  </PopoverContent>
);
