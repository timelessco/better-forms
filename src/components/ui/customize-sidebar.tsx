import {
  ConfigCard,
  ConfigRow,
  selectTriggerFigmaCls,
} from "@/components/form-builder/embed-config-panel";
import { useTheme, useResolvedTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { IconPickerPreview } from "@/components/icon-picker";
import { ColorPicker } from "@/components/ui/color-picker";
import { FeatureGate } from "@/components/ui/feature-gate";
import {
  CaretDownIcon,
  DarkModeIcon,
  InfoIcon,
  LightModeIcon,
  SelectChevronIcon,
  SystemModeIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  XIcon,
} from "@/components/ui/icons";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { StyleNumberInput } from "@/components/ui/style-controls";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFormListings } from "@/collections";
import { localFormCollection } from "@/collections/local/form";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useForm, useLocalForm } from "@/hooks/use-live-hooks";
import { FONT_REGISTRY } from "@/lib/theme/font-registry";
import { TOKEN_NAMES } from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";
import type { BaseColorMap } from "@/lib/theme/theme-presets";
import { BASE_COLORS, DARK_BASE_COLORS, STYLES, THEME_COLORS } from "@/lib/theme/theme-presets";
import { cn, isValidUrl } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const FONT_OPTIONS = Object.keys(FONT_REGISTRY).map((name) => ({
  label: name,
  value: name,
}));

const STYLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Vega", value: "vega" },
  { label: "Nova", value: "nova" },
  { label: "Maia", value: "maia" },
  { label: "Lyra", value: "lyra" },
  { label: "Mira", value: "mira" },
];

const THEME_COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: "Neutral", value: "neutral" },
  { label: "Zinc", value: "zinc" },
  { label: "Rose", value: "rose" },
  { label: "Blue", value: "blue" },
  { label: "Green", value: "green" },
  { label: "Amber", value: "amber" },
  { label: "Orange", value: "orange" },
  { label: "Violet", value: "violet" },
  { label: "Emerald", value: "emerald" },
  { label: "Cyan", value: "cyan" },
  { label: "Indigo", value: "indigo" },
  { label: "Pink", value: "pink" },
  { label: "Red", value: "red" },
];

const BASE_COLOR_OPTIONS: { label: string; value: string }[] = [
  { label: "Neutral", value: "neutral" },
  { label: "Zinc", value: "zinc" },
  { label: "Slate", value: "slate" },
  { label: "Stone", value: "stone" },
  { label: "Gray", value: "gray" },
];

const RADIUS_OPTIONS: { label: string; value: string }[] = [
  { label: "None", value: "none" },
  { label: "Small", value: "small" },
  { label: "Medium", value: "medium" },
  { label: "Large", value: "large" },
];

// Cover box width: Fill = full-bleed (edge to edge), Fit = contained to the form width.
const COVER_WIDTH_OPTIONS: { label: string; value: string }[] = [
  { label: "Fill", value: "fill" },
  { label: "Fit", value: "fit" },
];

const TYPO_SCOPE_OPTIONS: { label: string; value: string }[] = [
  { label: "Title", value: "title" },
  { label: "Body", value: "body" },
];

const MODE_OPTIONS: { label: string; value: string }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

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

// Full token set for the Advanced disclosure (power users).
const ADVANCED_COLOR_TOKENS = [
  { key: "primary", label: "Primary" },
  { key: "primary-foreground", label: "Primary FG" },
  { key: "secondary", label: "Secondary" },
  { key: "secondary-foreground", label: "Secondary FG" },
  { key: "accent", label: "Accent" },
  { key: "accent-foreground", label: "Accent FG" },
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "destructive", label: "Destructive" },
  { key: "destructive-foreground", label: "Destructive FG" },
  { key: "success", label: "Success" },
  { key: "input", label: "Input" },
  { key: "border", label: "Border" },
  { key: "muted", label: "Muted" },
  { key: "muted-foreground", label: "Muted FG" },
  { key: "ring", label: "Ring" },
] as const;

// Borderless compact trigger for header-right scope/mode selects (Figma Title/Light).
const scopeTriggerCls =
  "h-auto gap-1 border-none bg-transparent p-0 text-[13px] font-normal text-foreground shadow-none data-[size=default]:h-auto [&>svg]:size-3.5";

const CONFIG_INPUT_CLS = "!rounded-none !border-0 bg-background !h-7";

// Plain flush numeric row (bare scrubber) so values align with ConfigRow/ColorPicker rows.
const NumberRow = (props: React.ComponentProps<typeof StyleNumberInput>) => (
  <StyleNumberInput bare {...props} />
);

const ColorSwatch = ({ color }: { color?: string }) => {
  if (!color) return null;
  return (
    <div
      className="size-3 shrink-0 rounded-full border border-border/60"
      style={{ backgroundColor: color }}
    />
  );
};

const ProBadge = () => (
  <div className="rounded-[4px] bg-teal-100 px-1.5 py-px text-[9px] font-bold tracking-wider text-teal-700 uppercase shadow-sm dark:bg-teal-700/20 dark:text-teal-400">
    Pro
  </div>
);

/** Figma segmented pill toggle (Theme sun/moon/monitor, Alignment L/C/R). */
const PillToggle = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon: React.ReactNode }[];
}) => (
  <div className="flex w-[141px] items-center gap-1.5 rounded-lg bg-muted p-px">
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
            "flex flex-1 items-center justify-center rounded-md py-1 transition-colors",
            active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
        </button>
      );
    })}
  </div>
);

/** Header-right scope/mode select (Figma "Title ⌄" / "Light ⌄"). */
const ScopeSelect = ({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => (
  <Select value={value} onValueChange={(v) => v && onChange(v)}>
    <SelectTrigger className={scopeTriggerCls} icon={<SelectChevronIcon className="size-3.5" />}>
      {options.find((o) => o.value === value)?.label ?? value}
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface CustomizeSidebarProps {
  formId: string;
  isLocal?: boolean;
}

export const CustomizeSidebar = ({ formId, isLocal }: CustomizeSidebarProps) => {
  const { closeSidebar } = useEditorSidebar();
  const { updateHeaderMedia } = useEditorTheme();
  const { setTheme } = useTheme();
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

  // Cover/logo images live on the Plate header node (not customization) — read-only here.
  const coverImage = (formDoc as { cover?: string | null } | null)?.cover ?? null;
  const logoImage = (formDoc as { icon?: string | null } | null)?.icon ?? null;

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

  const selectStyle = useCallback(
    (styleName: string) => {
      const style = STYLES[styleName];
      if (!style) return;

      const updates: Record<string, string> = {
        preset: styleName,
        radius: style.radius,
        spacing: style.spacing,
        baseColor: style.baseColor,
        themeColor: style.themeColor,
        font: style.font,
      };

      // Clear all color token overrides so preset base/theme colors take effect
      for (const tokenName of TOKEN_NAMES) {
        updates[tokenName] = "";
        updates[`light:${tokenName}`] = "";
        updates[`dark:${tokenName}`] = "";
      }

      updateFields(updates);
    },
    [updateFields],
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
      for (const tokenName of TOKEN_NAMES) {
        const unprefixed = customization[tokenName];
        if (unprefixed && !customization[`${sourceMode}:${tokenName}`]) {
          updates[`${sourceMode}:${tokenName}`] = unprefixed;
          updates[tokenName] = "";
        }
      }

      if (Object.keys(updates).length > 0) {
        updateFields(updates);
      }
      // App theme is the single source of truth for mode
      setTheme(targetMode as "dark" | "light");
    },
    [updateFields, customization, setTheme],
  );

  const activePreset = customization.preset || "vega";
  const activeMode = resolvedAppTheme;
  const activeThemeColor = getValue("themeColor");
  const activeBaseColors = activeMode === "dark" ? DARK_BASE_COLORS : BASE_COLORS;
  const activeBaseColor = getValue("baseColor");
  const activeFont = getValue("font");
  const activeRadius = getValue("radius");

  const cssKey = `${activeMode}:customCss`;
  const cssValue = customization[cssKey] || customization.customCss || "";

  const clearColorTokenOverrides = useCallback((updates: Record<string, string | null>) => {
    for (const tokenName of TOKEN_NAMES) {
      updates[tokenName] = null;
      updates[`light:${tokenName}`] = null;
      updates[`dark:${tokenName}`] = null;
    }
  }, []);

  const handleThemeColorChange = useCallback(
    (v: string) => {
      if (!v) return;
      const updates: Record<string, string | null> = { themeColor: v, preset: "custom" };
      clearColorTokenOverrides(updates);
      updateFields(updates);
    },
    [updateFields, clearColorTokenOverrides],
  );

  const handleBaseColorChange = useCallback(
    (v: string) => {
      if (!v) return;
      const updates: Record<string, string | null> = { baseColor: v, preset: "custom" };
      clearColorTokenOverrides(updates);
      updateFields(updates);
    },
    [updateFields, clearColorTokenOverrides],
  );

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
      className="size-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <CustomizeSidebarHeader closeSidebar={closeSidebar} />

      <SidebarContent>
        <div className="flex flex-col gap-4 px-4 pt-3 pb-3.5">
          <AppearanceSection
            customization={customization}
            coverImage={coverImage}
            logoImage={logoImage}
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

          <AdvancedSection
            activePreset={activePreset}
            selectStyle={selectStyle}
            activeThemeColor={activeThemeColor}
            handleThemeColorChange={handleThemeColorChange}
            activeBaseColor={activeBaseColor}
            activeBaseColors={activeBaseColors}
            handleBaseColorChange={handleBaseColorChange}
            activeRadius={activeRadius}
            updateWithCustomPreset={updateWithCustomPreset}
            customization={customization}
            activeMode={activeMode}
          />
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

const CustomizeSidebarHeader = ({ closeSidebar }: { closeSidebar: () => void }) => (
  <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
    <div className="flex items-center justify-between">
      <h2 className="pl-2.5 font-sans text-base font-normal text-foreground">Customize</h2>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={closeSidebar}
        aria-label="Close"
      >
        <XIcon className="size-4" />
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
  updateScrubberField,
  resetScrubberField,
  updateFields,
  updateHeaderMedia,
}: ScrubberProps & {
  coverImage: string | null;
  logoImage: string | null;
  updateFields: (fields: Record<string, string | null>) => void;
  updateHeaderMedia?: (field: "icon" | "cover", value: string | null) => void;
}) => (
  <SidebarSection label="Appearance" collapsible={false}>
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
      <MediaEditButton
        value={coverImage}
        kind="cover"
        rounded="rounded-[4px]"
        onUpload={updateHeaderMedia && ((url) => updateHeaderMedia("cover", url))}
      />
    </ConfigRow>
    <ConfigRow label="Cover width" surface="flat">
      <Select
        value={customization.coverWidth || "fill"}
        onValueChange={(v) => v && updateScrubberField("coverWidth", v)}
      >
        <SelectTrigger
          className={selectTriggerFigmaCls}
          icon={<CaretDownIcon className="size-3" />}
        >
          {COVER_WIDTH_OPTIONS.find((o) => o.value === (customization.coverWidth || "fill"))
            ?.label ?? "Fill"}
        </SelectTrigger>
        <SelectContent>
          {COVER_WIDTH_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      className={CONFIG_INPUT_CLS}
    />
    <ConfigRow label="Logo" surface="flat">
      <MediaEditButton
        value={logoImage}
        kind="logo"
        rounded="rounded-full"
        onUpload={updateHeaderMedia && ((url) => updateHeaderMedia("icon", url))}
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

// Edit opens a file dialog and writes the blob URL to the Plate header node via updateHeaderMedia.
// Logo may be an icon name (not a URL) — render the glyph, not a broken <img>.
const MediaEditButton = ({
  value,
  kind,
  rounded,
  onUpload,
}: {
  value: string | null;
  kind: "cover" | "logo";
  rounded: string;
  onUpload?: (url: string) => void;
}) => {
  const [, { openFileDialog, getInputProps }] = useFileUpload({
    accept: "image/*",
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onFilesChange: (files) => {
      const file = files[0]?.file;
      if (file instanceof File) onUpload?.(URL.createObjectURL(file));
    },
  });
  const isUrl = value ? isValidUrl(value) : false;
  return (
    <span className="flex items-center">
      <button
        type="button"
        onClick={onUpload ? openFileDialog : undefined}
        disabled={!onUpload}
        title="Upload image"
        className="flex items-center gap-1.5 text-[14px] font-medium text-foreground enabled:cursor-pointer disabled:cursor-default"
      >
        {isUrl ? (
          <img src={value ?? ""} alt="" className={cn("size-4 object-cover", rounded)} />
        ) : kind === "logo" && value ? (
          <span className={cn("flex size-4 items-center justify-center overflow-hidden", rounded)}>
            <IconPickerPreview
              icon={value}
              iconColor={undefined}
              useThemeColor
              iconSize="10"
              size="16"
              standaloneIcon
            />
          </span>
        ) : kind === "cover" && value ? (
          <span className={cn("size-4", rounded)} style={{ backgroundColor: value }} />
        ) : (
          <span className={cn("size-4 bg-muted", rounded)} />
        )}
        Edit
      </button>
      <input {...getInputProps()} className="sr-only" />
    </span>
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
  // Alignment is global (not scoped) — one control aligns the whole form (title + body + fields).
  const alignKey = "textAlign";

  return (
    <SidebarSection
      label="Typography"
      collapsible={false}
      headerRight={
        <div className="flex items-center gap-2">
          <ProBadge />
          <ScopeSelect
            value={scope}
            onChange={(v) => setScope(v as "title" | "body")}
            options={TYPO_SCOPE_OPTIONS}
          />
        </div>
      }
    >
      <FeatureGate requiredPlan="pro" variant="block">
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
            displayUnit=""
            className={CONFIG_INPUT_CLS}
          />
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
            displayUnit=""
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
            className={CONFIG_INPUT_CLS}
          />
          <ConfigRow label="Alignment" surface="flat">
            <PillToggle
              value={customization[alignKey] || "left"}
              onChange={(v) => updateScrubberField(alignKey, v)}
              options={[
                {
                  value: "left",
                  label: "Left",
                  icon: <TextAlignLeftIcon className="size-[18px]" />,
                },
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
      </FeatureGate>
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
    collapsible={false}
    className="!overflow-visible"
    headerRight={
      <div className="flex items-center gap-2">
        <ProBadge />
        <ScopeSelect value={activeMode} onChange={handleModeToggle} options={MODE_OPTIONS} />
      </div>
    }
  >
    <FeatureGate requiredPlan="pro" variant="block">
      <div className="relative isolate z-50 flex flex-col gap-2 overflow-visible">
        <DeferredColorPickers
          tokens={SEMANTIC_COLOR_TOKENS}
          customization={customization}
          updateField={updateWithCustomPreset}
          mode={activeMode}
        />
      </div>
    </FeatureGate>
  </SidebarSection>
);

const InputsSection = ({
  customization,
  updateScrubberField,
  resetScrubberField,
}: ScrubberProps) => (
  <SidebarSection label="Inputs" collapsible={false} headerRight={<ProBadge />}>
    <FeatureGate requiredPlan="pro" variant="block">
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
    </FeatureGate>
  </SidebarSection>
);

const ButtonsSection = ({
  customization,
  updateScrubberField,
  resetScrubberField,
}: ScrubberProps) => (
  <SidebarSection label="Buttons" collapsible={false} headerRight={<ProBadge />}>
    <FeatureGate requiredPlan="pro" variant="block">
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
          className={CONFIG_INPUT_CLS}
        />
      </div>
    </FeatureGate>
  </SidebarSection>
);

interface CustomCssSectionProps {
  cssValue: string;
  handleCssChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  activeMode: string;
}

const CustomCssSection = ({ cssValue, handleCssChange, activeMode }: CustomCssSectionProps) => (
  <SidebarSection label="Custom CSS" collapsible={false} headerRight={<ProBadge />}>
    <FeatureGate requiredPlan="pro" variant="block">
      <div className="overflow-hidden rounded-lg bg-muted">
        <Textarea
          value={cssValue}
          onChange={handleCssChange}
          aria-label={`Custom CSS (${activeMode} mode)`}
          className="h-32 rounded-none border-0 bg-muted p-3 font-mono text-[14px] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          placeholder=".bf-themed { ... }"
          spellCheck={false}
        />
      </div>
      <div className="flex items-center gap-1.5 px-1 pt-2">
        <Tooltip>
          <TooltipTrigger
            render={<InfoIcon className="size-3 cursor-help text-muted-foreground/60" />}
          />
          <TooltipContent side="bottom" className="max-w-[240px] text-[11px]">
            Supports shadcn tokens: --bf-primary, --bf-background, --bf-foreground, etc.
          </TooltipContent>
        </Tooltip>
        <span className="text-[11px] text-muted-foreground/60">
          Use --bf-* tokens for overrides
        </span>
      </div>
    </FeatureGate>
  </SidebarSection>
);

interface AdvancedSectionProps {
  activePreset: string;
  selectStyle: (styleName: string) => void;
  activeThemeColor: string;
  handleThemeColorChange: (v: string) => void;
  activeBaseColor: string;
  activeBaseColors: BaseColorMap;
  handleBaseColorChange: (v: string) => void;
  activeRadius: string;
  updateWithCustomPreset: (field: string, value: string) => void;
  customization: Record<string, string>;
  activeMode: "light" | "dark";
}

// Power-user disclosure: the preset abstraction + full raw token set (not in Figma layout).
const AdvancedSection = ({
  activePreset,
  selectStyle,
  activeThemeColor,
  handleThemeColorChange,
  activeBaseColor,
  activeBaseColors,
  handleBaseColorChange,
  activeRadius,
  updateWithCustomPreset,
  customization,
  activeMode,
}: AdvancedSectionProps) => (
  <SidebarSection label="Advanced" initialOpen={false} divider={false}>
    <div className="flex flex-col gap-3">
      <ConfigCard>
        <ConfigRow label="Preset" surface="flat">
          <Select value={activePreset} onValueChange={(v) => v && selectStyle(v)}>
            <SelectTrigger
              className={selectTriggerFigmaCls}
              icon={<CaretDownIcon className="size-3" />}
            >
              {STYLE_OPTIONS.find((o) => o.value === activePreset)?.label ?? activePreset}
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
        <ConfigRow label="Accent" surface="flat">
          <Select value={activeThemeColor} onValueChange={(v) => v && handleThemeColorChange(v)}>
            <SelectTrigger
              className={selectTriggerFigmaCls}
              icon={<CaretDownIcon className="size-3" />}
            >
              <ColorSwatch color={THEME_COLORS[activeThemeColor]?.primary} />
              {THEME_COLOR_OPTIONS.find((o) => o.value === activeThemeColor)?.label ??
                activeThemeColor}
            </SelectTrigger>
            <SelectContent>
              {THEME_COLOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <ColorSwatch color={THEME_COLORS[o.value]?.primary} />
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
        <ConfigRow label="Base" surface="flat">
          <Select value={activeBaseColor} onValueChange={(v) => v && handleBaseColorChange(v)}>
            <SelectTrigger
              className={selectTriggerFigmaCls}
              icon={<CaretDownIcon className="size-3" />}
            >
              <ColorSwatch color={activeBaseColors[activeBaseColor]?.muted} />
              {BASE_COLOR_OPTIONS.find((o) => o.value === activeBaseColor)?.label ??
                activeBaseColor}
            </SelectTrigger>
            <SelectContent>
              {BASE_COLOR_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <ColorSwatch color={activeBaseColors[o.value]?.muted} />
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
        <ConfigRow label="Radius" surface="flat">
          <Select
            value={activeRadius}
            onValueChange={(v) => v && updateWithCustomPreset("radius", v)}
          >
            <SelectTrigger
              className={selectTriggerFigmaCls}
              icon={<CaretDownIcon className="size-3" />}
            >
              {RADIUS_OPTIONS.find((o) => o.value === activeRadius)?.label ?? activeRadius}
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
      </ConfigCard>

      <div className="relative isolate z-40 flex flex-col gap-2 overflow-visible">
        <DeferredColorPickers
          tokens={ADVANCED_COLOR_TOKENS}
          customization={customization}
          updateField={updateWithCustomPreset}
          mode={activeMode}
        />
      </div>
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
