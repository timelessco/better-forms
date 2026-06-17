import { ConfigRow, selectTriggerFigmaCls } from "@/components/form-builder/embed-config-panel";
import { useResolvedTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { IconPickerPreview } from "@/components/icon-picker";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  CaretDownIcon,
  DarkModeIcon,
  ImageLineIcon,
  LightModeIcon,
  SystemModeIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  XIcon,
} from "@/components/ui/icons";
import { CoverPickerContent, LogoPickerContent } from "@/components/ui/form-header-node";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { StyleNumberInput } from "@/components/ui/style-controls";
import { ToggleSelect } from "@/components/ui/toggle-select";
import { Textarea } from "@/components/ui/textarea";
import { getFormListings } from "@/collections";
import { localFormCollection } from "@/collections/local/form";
import { getHeaderMediaSetter } from "@/lib/editor/header-media-registry";
import { useEditorColorMode } from "@/hooks/use-editor-color-mode";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useForm, useLocalForm } from "@/hooks/use-live-hooks";
import { FONT_REGISTRY } from "@/lib/theme/font-registry";
import { OVERRIDABLE_TOKEN_NAMES, resolveEffectiveMode } from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";
import { BASE_COLORS, DARK_BASE_COLORS, STYLES, THEME_COLORS } from "@/lib/theme/theme-presets";
import { cn, isValidUrl } from "@/lib/utils";
import { domMax, LazyMotion, m } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

const FONT_OPTIONS = Object.keys(FONT_REGISTRY).map((name) => ({
  label: name,
  value: name,
}));

// Cover box width: Fill = full-bleed (edge to edge), Fit = contained to the form width.
const COVER_WIDTH_OPTIONS = [
  { label: "Fill", value: "fill" },
  { label: "Fit", value: "fit" },
] as const;

const TYPO_SCOPE_OPTIONS = [
  { label: "Title", value: "title" },
  { label: "Body", value: "body" },
] as const;

const MODE_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

// Semantic Colors rows (Figma) → underlying theme token written mode-prefixed.
const SEMANTIC_COLOR_TOKENS = [
  { key: "title-color", label: "Title" },
  { key: "foreground", label: "Body text" },
  { key: "background", label: "Background" },
  { key: "input", label: "Inputs" },
  { key: "primary", label: "Buttons" },
  { key: "destructive", label: "Error" },
  { key: "success", label: "Success" },
] as const;

// Borderless compact trigger for header-right scope/mode selects (Figma Title/Light).
// Figma (node 25420-11662): 13px, gray/700, lh 1.15, 0.26px (0.02em = tracking-4) tracking, 6px gap.
// Style slot reads "Thin" but wght axis is overridden to 420 — ship font-[420] (variable axis,
// un-pinned by the sidebar root's [font-variation-settings:normal]), NOT font-thin/100.
const scopeTriggerCls =
  "h-auto gap-1.5 border-none bg-transparent p-0 text-[13px] font-[420] leading-[1.15] tracking-4 text-gray-700 shadow-none data-[size=default]:h-auto [&>svg]:size-3.5";

// Figma slider rows read like plain label rows at rest (flat, no box); the gray-100 rounded track +
// hash marks reveal only on hover/drag/keyboard-focus (revealOnHover, set via `bare`). 6px label/value
// padding lives in the bare styles; NumberRow's -mx-1.5 bleed cancels it so text stays flush with
// non-slider rows. Track bg comes from --elastic-slider-bg (var(--muted)) — no always-on fill here.
const CONFIG_INPUT_CLS = "!border-0 !h-7";

// Numeric row (bare scrubber): track bleeds 6px past the text column (Figma row = column + 6px
// each side) so labels/values align with ConfigRow rows while the rounded track extends beyond.
const NumberRow = (props: React.ComponentProps<typeof StyleNumberInput>) => (
  <div className="-mx-1.5">
    <StyleNumberInput bare {...props} />
  </div>
);

// Figma radius variant (nodes 25441-4674 / 4850, 25446-4875): dot hash marks + a corner glyph in
// the value slot. The glyph is LIVE — its corner radius scales with the row's value (square at 0,
// full quarter-curve at max) and CSS-transitions between snap stops as you drag.
const RadiusEndIcon = ({ value, max }: { value?: string; max: number }) => {
  const n = Number.parseFloat(value ?? "") || 0;
  const r = (Math.min(Math.max(n, 0), max) / max) * 7;
  return (
    <span aria-hidden className="flex size-4 items-center justify-center text-gray-700">
      <span
        className="block size-[11px] border-t border-l border-current transition-[border-radius] duration-200 ease-out"
        style={{ borderTopLeftRadius: `${r}px` }}
      />
    </span>
  );
};

/** Figma segmented pill toggle (Theme sun/moon/monitor, Alignment L/C/R). Press and drag across the
 * track to switch: the segment is picked from the pointer's X over the whole track (no per-button
 * dead-zone), so the highlight pill follows the drag continuously and snaps via a shared layoutId.
 * Pointer capture keeps the drag alive even past the edges. Click/keyboard still work. */
const PillToggle = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon: React.ReactNode }[];
}) => {
  const pillId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  // Track rect is stable for the duration of a drag — cache it on pointerDown so pointerMove
  // (fired per pixel) doesn't force a layout read each frame.
  const dragRectRef = useRef<DOMRect | null>(null);

  // Pick the segment under clientX from the track's full width — boundaries fall on the 1/n marks,
  // so a sweep switches the instant the pointer crosses, with no gap between buttons to stall on.
  const selectAtX = useCallback(
    (clientX: number, rect?: DOMRect | null) => {
      const r = rect ?? trackRef.current?.getBoundingClientRect();
      if (!r) return;
      const ratio = (clientX - r.left) / r.width;
      const index = Math.min(options.length - 1, Math.max(0, Math.floor(ratio * options.length)));
      if (options[index].value !== value) onChange(options[index].value);
    },
    [options, value, onChange],
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    dragRectRef.current = null;
    trackRef.current?.releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <LazyMotion features={domMax} strict>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          draggingRef.current = true;
          dragRectRef.current = trackRef.current?.getBoundingClientRect() ?? null;
          trackRef.current?.setPointerCapture?.(e.pointerId);
          selectAtX(e.clientX, dragRectRef.current);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) selectAtX(e.clientX, dragRectRef.current);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative flex w-[141px] cursor-grab touch-none items-center gap-1.5 rounded-lg bg-muted p-px select-none active:cursor-grabbing"
      >
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-label={o.label}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                // inherit the track's grab/grabbing cursor so it stays consistent across buttons + gaps
                "relative flex flex-1 cursor-[inherit] items-center justify-center rounded-md py-1 transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <m.span
                  aria-hidden
                  layoutId={`${pillId}-pill`}
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: "spring", duration: 0.18, bounce: 0 }}
                />
              )}
              <span className="relative">{o.icon}</span>
            </button>
          );
        })}
      </div>
    </LazyMotion>
  );
};

/** Header-right scope/mode toggle (Figma "Title ⌄" / "Light ⌄"). Binary → click flips it. */
const ScopeSelect = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly [{ value: string; label: string }, { value: string; label: string }];
}) => (
  <ToggleSelect
    value={value}
    onChange={onChange}
    options={options}
    className={scopeTriggerCls}
    iconClassName="size-3.5"
  />
);

interface CustomizeSidebarProps {
  formId: string;
  isLocal?: boolean;
}

export const CustomizeSidebar = ({ formId, isLocal }: CustomizeSidebarProps) => {
  const { closeSidebar } = useEditorSidebar();
  const { editorColorMode, setEditorColorMode } = useEditorColorMode();
  const cloudForm = useForm(isLocal ? undefined : formId);
  const localFormResult = useLocalForm(isLocal ? formId : undefined);
  const formResult = isLocal ? localFormResult : cloudForm;
  const formDoc = formResult.data?.[0] ?? null;
  const collection = (isLocal ? localFormCollection : getFormListings()) as ReturnType<
    typeof getFormListings
  >;
  const customization = useMemo(
    () => (formDoc?.customization ?? {}) as Record<string, string>,
    [formDoc?.customization],
  );

  // Cover/logo live on the Plate header node — the editor's source of truth. Read them straight
  // from the live `content` (formHeader at index 0) instead of the top-level columns, which can
  // drift out of sync (a legacy node with no cover key never writes a null back to the column).
  const headerNode = useMemo(() => {
    const content = (formDoc as { content?: unknown } | null)?.content;
    if (Array.isArray(content) && content[0]?.type === "formHeader") {
      return content[0] as {
        cover?: string | null;
        icon?: string | null;
        iconColor?: string | null;
      };
    }
    return null;
  }, [formDoc]);
  const coverImage = headerNode?.cover ?? null;
  const logoImage = headerNode?.icon ?? null;
  const logoColor = headerNode?.iconColor ?? null;

  // Header cover/logo edits push to the editable editor's Plate node (live setter, registered by
  // formId) AND mirror cover/icon to the top-level columns, keeping the public-form/preload paths
  // in sync. iconColor lives only on the node (no column) so it flows through the setter alone.
  const formDocId = formDoc?.id;
  const updateHeaderMedia = useCallback(
    (field: "icon" | "cover" | "iconColor", value: string | null) => {
      getHeaderMediaSetter(formId)?.(field, value);
      if (formDocId && field !== "iconColor") {
        collection.update(formDocId, (draft) => {
          (draft as Record<string, unknown>)[field] = value;
          draft.updatedAt = new Date().toISOString();
        });
      }
    },
    [formId, formDocId, collection],
  );

  const resolvedStyle = useMemo(() => {
    const presetName = customization.preset || "vega";
    return STYLES[presetName] ?? STYLES.vega;
  }, [customization.preset]);

  const getValue = useCallback(
    (field: string) => {
      if (customization[field]) return customization[field];
      if (field === "radius") return resolvedStyle.radius;
      if (field === "spacing") return resolvedStyle.spacing;
      if (field === "baseColor") return resolvedStyle.baseColor;
      if (field === "themeColor") return resolvedStyle.themeColor;
      if (field === "font") return resolvedStyle.font;
      return "";
    },
    [customization, resolvedStyle],
  );

  const updateFields = useCallback(
    (fields: Record<string, string | null>) => {
      if (formDoc?.id) {
        collection.update(formDoc.id, (draft) => {
          const nextCustomization = {
            ...((draft.customization ?? {}) as Record<string, string>),
          };

          for (const [key, value] of Object.entries(fields)) {
            if (value === null) {
              delete nextCustomization[key];
            } else {
              nextCustomization[key] = value;
            }
          }

          draft.customization =
            Object.keys(nextCustomization).length > 0 ? nextCustomization : null;
          draft.updatedAt = new Date().toISOString();
        });
      }
    },
    [formDoc?.id, collection],
  );

  const updateWithCustomPreset = useCallback(
    (field: string, value: string) => {
      updateFields({ [field]: value, preset: "custom" });
    },
    [updateFields],
  );

  const updateScrubberField = useCallback(
    (field: string, value: string) => {
      updateFields({ [field]: value });
    },
    [updateFields],
  );

  const resetScrubberField = useCallback(
    (field: string) => {
      updateFields({ [field]: null });
    },
    [updateFields],
  );

  const resolvedAppTheme = useResolvedTheme();

  const handleModeToggle = useCallback(
    (targetMode: string) => {
      const sourceMode = targetMode === "dark" ? "light" : "dark";
      const updates: Record<string, string> = {};

      // One-time migration: move unprefixed overrides to source mode's prefix
      for (const tokenName of OVERRIDABLE_TOKEN_NAMES) {
        const unprefixed = customization[tokenName];
        if (unprefixed && !customization[`${sourceMode}:${tokenName}`]) {
          updates[`${sourceMode}:${tokenName}`] = unprefixed;
          updates[tokenName] = "";
        }
      }

      if (Object.keys(updates).length > 0) {
        updateFields(updates);
      }
      // Scope the switch to the editor/form preview only — NOT the app theme (no setTheme).
      setEditorColorMode(targetMode as "dark" | "light");
    },
    [updateFields, customization, setEditorColorMode],
  );

  // Which mode the Colors section edits + the preview shows. Shares useFormCustomization's precedence
  // (editor override → form defaultMode → app theme). Reset the override on close so the preview
  // reverts to the form's effective theme (the customize tree is kept alive via <Activity>).
  const activeMode = resolveEffectiveMode(
    customization.defaultMode,
    resolvedAppTheme,
    editorColorMode,
  );

  useEffect(() => () => setEditorColorMode(null), [setEditorColorMode]);
  const activeFont = getValue("font");

  const cssKey = `${activeMode}:customCss`;
  const cssValue = customization[cssKey] || customization.customCss || "";

  const handleFontChange = useCallback(
    (v: string) => {
      if (!v) return;
      loadGoogleFont(v);
      updateWithCustomPreset("font", v);
    },
    [updateWithCustomPreset],
  );

  const handleTitleFontChange = useCallback(
    (v: string) => {
      if (!v) return;
      loadGoogleFont(v);
      updateWithCustomPreset("titleFont", v);
    },
    [updateWithCustomPreset],
  );

  const handleCssChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateWithCustomPreset(cssKey, e.target.value);
    },
    [updateWithCustomPreset, cssKey],
  );

  const [typoScope, setTypoScope] = useState<"title" | "body">("title");

  return (
    <Sidebar
      side="right"
      collapsible="none"
      // [font-variation-settings:normal] un-pins the global opsz20/wght450 so font-weight utils + Figma optical size apply
      className="size-full animate-in border-none duration-200 ease-out [font-variation-settings:normal] slide-in-from-right-[40%]"
    >
      <CustomizeSidebarHeader closeSidebar={closeSidebar} />

      <SidebarContent>
        <div className="flex flex-col gap-5 px-4 pt-3 pb-3.5">
          <AppearanceSection
            customization={customization}
            coverImage={coverImage}
            logoImage={logoImage}
            logoColor={logoColor}
            updateScrubberField={updateScrubberField}
            resetScrubberField={resetScrubberField}
            updateFields={updateFields}
            updateHeaderMedia={updateHeaderMedia}
          />

          <TypographySection
            scope={typoScope}
            setScope={setTypoScope}
            getValue={getValue}
            activeFont={activeFont}
            handleFontChange={handleFontChange}
            handleTitleFontChange={handleTitleFontChange}
            customization={customization}
            updateScrubberField={updateScrubberField}
            resetScrubberField={resetScrubberField}
          />

          <ColorsSection
            activeMode={activeMode}
            handleModeToggle={handleModeToggle}
            customization={customization}
            updateWithCustomPreset={updateWithCustomPreset}
          />

          <InputsSection
            customization={customization}
            updateScrubberField={updateScrubberField}
            resetScrubberField={resetScrubberField}
          />

          <ButtonsSection
            customization={customization}
            updateScrubberField={updateScrubberField}
            resetScrubberField={resetScrubberField}
          />

          <CustomCssSection
            cssValue={cssValue}
            handleCssChange={handleCssChange}
            activeMode={activeMode}
          />
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const CustomizeSidebarHeader = ({ closeSidebar }: { closeSidebar: () => void }) => (
  <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pr-2 pb-2 pl-4">
    <div className="flex items-center justify-between">
      {/* drop font-sans so the root's variation reset isn't re-pinned */}
      <h2 className="text-base leading-[1.15] font-[450] tracking-[0.14px] text-gray-800">
        Customize
      </h2>
      <Button
        variant="ghost-flat"
        size="icon-xs"
        className="size-7 rounded-lg p-1.25 text-gray-800 hover:text-foreground"
        onClick={closeSidebar}
        aria-label="Close"
      >
        <XIcon className="size-4.5" />
      </Button>
    </div>
  </SidebarHeader>
);

interface ScrubberProps {
  customization: Record<string, string>;
  updateScrubberField: (field: string, value: string) => void;
  resetScrubberField: (field: string) => void;
}

const AppearanceSection = ({
  customization,
  coverImage,
  logoImage,
  logoColor,
  updateScrubberField,
  resetScrubberField,
  updateFields,
  updateHeaderMedia,
}: ScrubberProps & {
  coverImage: string | null;
  logoImage: string | null;
  logoColor: string | null;
  updateFields: (fields: Record<string, string | null>) => void;
  updateHeaderMedia?: (field: "icon" | "cover" | "iconColor", value: string | null) => void;
}) => (
  <SidebarSection label="Appearance" collapsible="flat">
    <NumberRow
      label="Form width"
      value={customization.pageWidth}
      onChange={(v) => updateScrubberField("pageWidth", v)}
      allowAuto
      isAuto={!customization.pageWidth}
      onAutoChange={() => resetScrubberField("pageWidth")}
      min={30}
      max={100}
      step={5}
      unit="%"
      className={CONFIG_INPUT_CLS}
    />
    <ConfigRow label="Cover" surface="flat">
      <CoverPickerButton
        cover={coverImage}
        onCoverChange={updateHeaderMedia && ((value) => updateHeaderMedia("cover", value))}
      />
    </ConfigRow>
    <ConfigRow label="Cover width" surface="flat">
      <ToggleSelect
        value={customization.coverWidth || "fill"}
        onChange={(v) => updateScrubberField("coverWidth", v)}
        options={COVER_WIDTH_OPTIONS}
        className={selectTriggerFigmaCls}
        iconClassName="size-3"
        aria-label="Cover width"
      />
    </ConfigRow>
    <NumberRow
      label="Cover radius"
      value={customization.coverRadius}
      onChange={(v) => updateScrubberField("coverRadius", v)}
      allowAuto
      isAuto={!customization.coverRadius}
      onAutoChange={() => resetScrubberField("coverRadius")}
      min={0}
      max={48}
      step={2}
      unit="px"
      displayUnit=""
      markStyle="dot"
      endIcon={<RadiusEndIcon value={customization.coverRadius} max={48} />}
      className={CONFIG_INPUT_CLS}
    />
    <ConfigRow label="Logo" surface="flat">
      <LogoPickerButton
        logo={logoImage}
        logoColor={logoColor}
        onIconChange={updateHeaderMedia && ((value) => updateHeaderMedia("icon", value))}
        onIconColorChange={updateHeaderMedia && ((color) => updateHeaderMedia("iconColor", color))}
      />
    </ConfigRow>
    <NumberRow
      label="Logo radius"
      value={customization.logoRadius}
      onChange={(v) => updateScrubberField("logoRadius", v)}
      allowAuto
      isAuto={!customization.logoRadius}
      onAutoChange={() => resetScrubberField("logoRadius")}
      min={0}
      max={48}
      step={2}
      unit="px"
      displayUnit=""
      markStyle="dot"
      endIcon={<RadiusEndIcon value={customization.logoRadius} max={48} />}
      className={CONFIG_INPUT_CLS}
    />
    <ConfigRow label="Theme" surface="flat">
      <PillToggle
        value={customization.defaultMode || "system"}
        onChange={(v) => updateFields({ defaultMode: v })}
        options={[
          { value: "light", label: "Light", icon: <LightModeIcon className="size-[18px]" /> },
          { value: "dark", label: "Dark", icon: <DarkModeIcon className="size-[18px]" /> },
          { value: "system", label: "System", icon: <SystemModeIcon className="size-[18px]" /> },
        ]}
      />
    </ConfigRow>
  </SidebarSection>
);

// Cover row control (Figma 25424:12044 empty / 25424:12768 filled): opens the same gallery+upload
// picker as the editor's in-cover "Change" button. Empty → image icon + "Upload"; set → 24×16
// thumbnail + "Edit". Disabled (no popover) when the header media isn't editable here.
const CoverPickerButton = ({
  cover,
  onCoverChange,
}: {
  cover: string | null;
  onCoverChange?: (value: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isUrl = cover ? isValidUrl(cover) : false;
  const trigger = (
    <button
      type="button"
      disabled={!onCoverChange}
      title={cover ? "Edit cover" : "Add cover"}
      className="flex items-center gap-1.5 text-[14px] font-[450] text-gray-700 enabled:cursor-pointer disabled:cursor-default"
    >
      {cover ? (
        <>
          {isUrl ? (
            <img src={cover} alt="" className="h-4 w-6 rounded-[4px] object-cover" />
          ) : (
            <span className="h-4 w-6 rounded-[4px]" style={{ backgroundColor: cover }} />
          )}
          Edit
        </>
      ) : (
        <>
          <ImageLineIcon className="size-4" />
          Upload
        </>
      )}
    </button>
  );
  if (!onCoverChange) return trigger;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <CoverPickerContent
        cover={cover}
        onCoverChange={onCoverChange}
        onClose={() => setOpen(false)}
      />
    </Popover>
  );
};

// Logo row control: opens the same icon/upload picker as the editor's in-header logo button
// (not a bare file dialog). Logo may be an icon name (not a URL) — render the glyph, not a broken
// <img>. Empty → user icon + "Upload"; set → glyph/thumbnail + "Edit". Disabled when not editable.
const LogoPickerButton = ({
  logo,
  logoColor,
  onIconChange,
  onIconColorChange,
}: {
  logo: string | null;
  logoColor: string | null;
  onIconChange?: (value: string | null) => void;
  onIconColorChange?: (color: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isUrl = logo ? isValidUrl(logo) : false;
  const trigger = (
    <button
      type="button"
      disabled={!onIconChange}
      title={logo ? "Edit logo" : "Add logo"}
      className="flex items-center gap-1.5 text-[14px] font-[450] text-gray-700 enabled:cursor-pointer disabled:cursor-default"
    >
      {logo ? (
        <>
          {isUrl ? (
            <img src={logo} alt="" className="size-4 rounded-full object-cover" />
          ) : (
            <span className="flex size-4 items-center justify-center overflow-hidden rounded-full">
              <IconPickerPreview
                icon={logo}
                iconColor={logoColor || undefined}
                useThemeColor={!logoColor}
                iconSize="10"
                size="16"
                standaloneIcon
              />
            </span>
          )}
          Edit
        </>
      ) : (
        <>
          <ImageLineIcon className="size-4" />
          Upload
        </>
      )}
    </button>
  );
  if (!onIconChange) return trigger;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <LogoPickerContent
        icon={logo}
        iconColor={logoColor}
        onIconChange={onIconChange}
        onIconColorChange={onIconColorChange ?? (() => {})}
        onClose={() => setOpen(false)}
      />
    </Popover>
  );
};

const TypographySection = ({
  scope,
  setScope,
  getValue,
  activeFont,
  handleFontChange,
  handleTitleFontChange,
  customization,
  updateScrubberField,
  resetScrubberField,
}: ScrubberProps & {
  scope: "title" | "body";
  setScope: (s: "title" | "body") => void;
  getValue: (field: string) => string;
  activeFont: string;
  handleFontChange: (v: string) => void;
  handleTitleFontChange: (v: string) => void;
}) => {
  const isTitle = scope === "title";
  const fontValue = isTitle ? getValue("titleFont") || "Timeless Serif" : activeFont;
  const onFontChange = isTitle ? handleTitleFontChange : handleFontChange;
  const sizeKey = isTitle ? "titleFontSize" : "baseFontSize";
  const spacingKey = isTitle ? "titleLetterSpacing" : "letterSpacing";
  const lineHeightKey = isTitle ? "titleLineHeight" : "lineHeight";

  return (
    <SidebarSection
      label="Typography"
      collapsible="flat"
      headerRight={
        <ScopeSelect
          value={scope}
          onChange={(v) => setScope(v as "title" | "body")}
          options={TYPO_SCOPE_OPTIONS}
        />
      }
    >
      {/* No hard Pro gate — free users can experiment; publish strips Pro keys (pro-publish-gate) */}
      <div className="flex flex-col gap-2">
        <ConfigRow label="Font" surface="flat">
          <Select value={fontValue} onValueChange={(v) => v && onFontChange(v)}>
            <SelectTrigger
              className={selectTriggerFigmaCls}
              icon={<CaretDownIcon className="size-3" />}
            >
              {FONT_OPTIONS.find((o) => o.value === fontValue)?.label ?? fontValue}
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
        <NumberRow
          label="Size"
          value={customization[sizeKey]}
          onChange={(v) => updateScrubberField(sizeKey, v)}
          allowAuto
          isAuto={!customization[sizeKey]}
          onAutoChange={() => resetScrubberField(sizeKey)}
          min={isTitle ? 24 : 12}
          max={isTitle ? 72 : 24}
          step={isTitle ? 2 : 1}
          unit="px"
          className={CONFIG_INPUT_CLS}
        />
        {/* Spacing + Line height display as % (Figma) — value × 100; the raw number is stored/applied. */}
        <NumberRow
          label="Spacing"
          value={customization[spacingKey]}
          onChange={(v) => updateScrubberField(spacingKey, v)}
          allowAuto
          isAuto={!customization[spacingKey]}
          onAutoChange={() => resetScrubberField(spacingKey)}
          min={isTitle ? -3 : 0}
          max={isTitle ? 3 : 0.2}
          step={isTitle ? 0.25 : 0.005}
          unit={isTitle ? "px" : "em"}
          displayUnit="%"
          displayScale={100}
          className={CONFIG_INPUT_CLS}
        />
        <NumberRow
          label="Line height"
          value={customization[lineHeightKey]}
          onChange={(v) => updateScrubberField(lineHeightKey, v)}
          allowAuto
          isAuto={!customization[lineHeightKey]}
          onAutoChange={() => resetScrubberField(lineHeightKey)}
          min={1}
          max={2}
          step={0.05}
          unit=""
          displayUnit="%"
          displayScale={100}
          className={CONFIG_INPUT_CLS}
        />
      </div>
    </SidebarSection>
  );
};

interface ColorsSectionProps {
  activeMode: "light" | "dark";
  handleModeToggle: (targetMode: string) => void;
  customization: Record<string, string>;
  updateWithCustomPreset: (field: string, value: string) => void;
}

const ColorsSection = ({
  activeMode,
  handleModeToggle,
  customization,
  updateWithCustomPreset,
}: ColorsSectionProps) => (
  <SidebarSection
    label="Colors"
    collapsible="flat"
    className="!overflow-visible"
    headerRight={
      <ScopeSelect value={activeMode} onChange={handleModeToggle} options={MODE_OPTIONS} />
    }
  >
    <div className="relative isolate z-50 flex flex-col gap-2 overflow-visible">
      <DeferredColorPickers
        tokens={SEMANTIC_COLOR_TOKENS}
        customization={customization}
        updateField={updateWithCustomPreset}
        mode={activeMode}
      />
    </div>
  </SidebarSection>
);

const InputsSection = ({
  customization,
  updateScrubberField,
  resetScrubberField,
}: ScrubberProps) => (
  <SidebarSection label="Inputs" collapsible="flat">
    <div className="flex flex-col gap-2">
      <NumberRow
        label="Input width"
        value={customization.inputWidth}
        onChange={(v) => updateScrubberField("inputWidth", v)}
        allowAuto
        isAuto={!customization.inputWidth}
        onAutoChange={() => resetScrubberField("inputWidth")}
        min={20}
        max={100}
        step={5}
        unit="%"
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Input height"
        value={customization.inputHeight}
        onChange={(v) => updateScrubberField("inputHeight", v)}
        allowAuto
        isAuto={!customization.inputHeight}
        onAutoChange={() => resetScrubberField("inputHeight")}
        min={24}
        max={64}
        step={1}
        unit="px"
        displayUnit=""
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Radius"
        value={customization.inputRadius}
        onChange={(v) => updateScrubberField("inputRadius", v)}
        allowAuto
        isAuto={!customization.inputRadius}
        onAutoChange={() => resetScrubberField("inputRadius")}
        min={0}
        max={32}
        step={1}
        unit="px"
        displayUnit=""
        markStyle="dot"
        endIcon={<RadiusEndIcon value={customization.inputRadius} max={32} />}
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Margin bottom"
        value={customization.inputMarginBottom}
        onChange={(v) => updateScrubberField("inputMarginBottom", v)}
        allowAuto
        isAuto={!customization.inputMarginBottom}
        onAutoChange={() => resetScrubberField("inputMarginBottom")}
        min={0}
        max={64}
        step={2}
        unit="px"
        displayUnit=""
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Padding"
        value={customization.inputPadding}
        onChange={(v) => updateScrubberField("inputPadding", v)}
        allowAuto
        isAuto={!customization.inputPadding}
        onAutoChange={() => resetScrubberField("inputPadding")}
        min={0}
        max={32}
        step={1}
        unit="px"
        displayUnit=""
        className={CONFIG_INPUT_CLS}
      />
    </div>
  </SidebarSection>
);

const ButtonsSection = ({
  customization,
  updateScrubberField,
  resetScrubberField,
}: ScrubberProps) => (
  <SidebarSection label="Buttons" collapsible="flat">
    <div className="flex flex-col gap-2">
      <NumberRow
        label="Width"
        value={customization.buttonWidth}
        onChange={(v) => updateScrubberField("buttonWidth", v)}
        allowAuto
        isAuto={!customization.buttonWidth}
        onAutoChange={() => resetScrubberField("buttonWidth")}
        min={80}
        max={400}
        step={4}
        unit="px"
        displayUnit=""
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Height"
        value={customization.buttonHeight}
        onChange={(v) => updateScrubberField("buttonHeight", v)}
        allowAuto
        isAuto={!customization.buttonHeight}
        onAutoChange={() => resetScrubberField("buttonHeight")}
        min={24}
        max={64}
        step={1}
        unit="px"
        displayUnit=""
        className={CONFIG_INPUT_CLS}
      />
      <NumberRow
        label="Radius"
        value={customization.buttonRadius}
        onChange={(v) => updateScrubberField("buttonRadius", v)}
        allowAuto
        isAuto={!customization.buttonRadius}
        onAutoChange={() => resetScrubberField("buttonRadius")}
        min={0}
        max={32}
        step={1}
        unit="px"
        displayUnit=""
        markStyle="dot"
        endIcon={<RadiusEndIcon value={customization.buttonRadius} max={32} />}
        className={CONFIG_INPUT_CLS}
      />
      {/* Aligns ONLY the action button within the form column (--bf-button-justify), not the doc. */}
      <ConfigRow label="Alignment" surface="flat">
        <PillToggle
          value={customization.buttonAlign || "left"}
          onChange={(v) => updateScrubberField("buttonAlign", v)}
          options={[
            { value: "left", label: "Left", icon: <TextAlignLeftIcon className="size-[18px]" /> },
            {
              value: "center",
              label: "Center",
              icon: <TextAlignCenterIcon className="size-[18px]" />,
            },
            {
              value: "right",
              label: "Right",
              icon: <TextAlignRightIcon className="size-[18px]" />,
            },
          ]}
        />
      </ConfigRow>
    </div>
  </SidebarSection>
);

interface CustomCssSectionProps {
  cssValue: string;
  handleCssChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  activeMode: string;
}

const CustomCssSection = ({ cssValue, handleCssChange, activeMode }: CustomCssSectionProps) => (
  <SidebarSection label="Custom CSS" collapsible="flat" divider={false}>
    <div className="overflow-hidden rounded-lg bg-muted">
      <Textarea
        value={cssValue}
        onChange={handleCssChange}
        aria-label={`Custom CSS (${activeMode} mode)`}
        // Figma (node 25420-11752): IBM Plex Mono 14px, gray/500, lh 1.4 (140%), 0.14px tracking. Self-hosted @font-face (styles.css), generic mono fallback.
        className="h-36 resize-none rounded-none border-0 bg-muted p-3 font-['IBM_Plex_Mono',ui-monospace,monospace] text-[14px] leading-[1.4] tracking-[0.14px] text-gray-500 focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={"<style>\n.reform-block {...\n\n\n</style>"}
        spellCheck={false}
      />
    </div>
  </SidebarSection>
);

type ColorToken = { key: string; label: string };

/** Resolved fallback colors for a mode (preset base/theme + derived + new title/success). */
const resolveColorMap = (
  customization: Record<string, string>,
  mode: "light" | "dark",
): Record<string, string> => {
  const baseColorName = customization.baseColor || "neutral";
  const themeColorName = customization.themeColor || "neutral";
  const baseColors = mode === "dark" ? DARK_BASE_COLORS : BASE_COLORS;
  const base = baseColors[baseColorName] ?? baseColors.neutral;
  const theme = THEME_COLORS[themeColorName] ?? THEME_COLORS.neutral;
  return {
    ...base,
    ...theme,
    secondary: base.muted,
    "secondary-foreground": base["muted-foreground"],
    destructive: "#ef4444",
    "destructive-foreground": "#fafafa",
    success: "#16a34a",
    "success-foreground": "#f0fdf4",
    "title-color": base.foreground,
  };
};

// Per-token wrapper. React Compiler auto-memoizes via (prefixedKey, value, updateField).
const TokenColorPicker = ({
  label,
  prefixedKey,
  value,
  updateField,
}: {
  label: string;
  prefixedKey: string;
  value: string;
  updateField: (field: string, value: string) => void;
}) => (
  <ColorPicker
    label={label}
    value={value}
    onChange={(v) => updateField(prefixedKey, v)}
    className="!rounded-none bg-background"
  />
);

// ColorPickers are the heaviest part of mount. Defer to post-paint so other sections paint fast.
const DeferredColorPickers = (props: {
  tokens: readonly ColorToken[];
  customization: Record<string, string>;
  updateField: (field: string, value: string) => void;
  mode: "light" | "dark";
}) => {
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in the early-return guard below
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-doctor/rendering-hydration-no-flicker -- intentional client-only deferral to keep the heavy color pickers off the SSR critical path; flash is acceptable
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return null;
  return <ColorPickerList {...props} />;
};

const ColorPickerList = ({
  tokens,
  customization,
  updateField,
  mode,
}: {
  tokens: readonly ColorToken[];
  customization: Record<string, string>;
  updateField: (field: string, value: string) => void;
  mode: "light" | "dark";
}) => {
  const resolved = resolveColorMap(customization, mode);
  return (
    <>
      {tokens.map(({ key, label }) => {
        const prefixedKey = `${mode}:${key}`;
        const currentValue =
          customization[prefixedKey] || customization[key] || resolved[key] || "#000000";

        return (
          <TokenColorPicker
            key={key}
            label={label}
            prefixedKey={prefixedKey}
            value={currentValue}
            updateField={updateField}
          />
        );
      })}
    </>
  );
};
