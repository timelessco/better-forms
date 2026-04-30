import {
  ConfigCard,
  ConfigRow,
  selectTriggerCls,
} from "@/components/form-builder/embed-config-panel";
import { useTheme, useResolvedTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { InfoIcon, XIcon } from "@/components/ui/icons";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { FeatureGate } from "@/components/ui/feature-gate";
import { StyleColorPicker, StyleNumberInput } from "@/components/ui/style-controls";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getFormListings } from "@/collections";
import { localFormCollection } from "@/collections/local/form";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useForm, useLocalForm } from "@/hooks/use-live-hooks";
import { FONT_REGISTRY } from "@/lib/theme/font-registry";
import { TOKEN_NAMES } from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";
import { BASE_COLORS, DARK_BASE_COLORS, STYLES, THEME_COLORS } from "@/lib/theme/theme-presets";
import { useCallback, useMemo } from "react";

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

const DEFAULT_MODE_OPTIONS: { label: string; value: string }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

const CONFIG_INPUT_CLS = "!rounded-none !border-0 bg-secondary !h-[34px]";

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

interface CustomizeSidebarProps {
  formId: string;
  isLocal?: boolean;
}

export const CustomizeSidebar = ({ formId, isLocal }: CustomizeSidebarProps) => {
  const { closeSidebar } = useEditorSidebar();
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

  const handleThemeColorChange = useCallback(
    (v: string) => {
      if (v) updateFields({ themeColor: v, preset: "custom" });
    },
    [updateFields],
  );

  const handleBaseColorChange = useCallback(
    (v: string) => {
      if (v) updateFields({ baseColor: v, preset: "custom" });
    },
    [updateFields],
  );

  const handleFontChange = useCallback(
    (v: string) => {
      if (!v) return;
      loadGoogleFont(v);
      updateWithCustomPreset("font", v);
    },
    [updateWithCustomPreset],
  );

  const handleCssChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateWithCustomPreset(cssKey, e.target.value);
    },
    [updateWithCustomPreset, cssKey],
  );

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="h-full w-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between">
          <h2 className="pl-2.5 font-sans text-base font-normal text-foreground">Customize</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="space-y-3 p-2">
          <p className="px-1 pb-1 text-[11px] text-muted-foreground/80">
            Changes apply to the public form on next publish.
          </p>
          <ConfigCard>
            <ConfigRow label="Preset">
              <Select value={activePreset} onValueChange={(v) => v && selectStyle(v)}>
                <SelectTrigger className={selectTriggerCls}>
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
          </ConfigCard>
          <SidebarSection label="Theme" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow label="Accent">
                <Select
                  value={activeThemeColor}
                  onValueChange={(v) => v && handleThemeColorChange(v)}
                >
                  <SelectTrigger className={selectTriggerCls}>
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
              <ConfigRow label="Base">
                <Select
                  value={activeBaseColor}
                  onValueChange={(v) => v && handleBaseColorChange(v)}
                >
                  <SelectTrigger className={selectTriggerCls}>
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
              <ConfigRow label="Font">
                <Select value={activeFont} onValueChange={(v) => v && handleFontChange(v)}>
                  <SelectTrigger className={selectTriggerCls}>
                    {FONT_OPTIONS.find((o) => o.value === activeFont)?.label ?? activeFont}
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
              <ConfigRow label="Radius">
                <Select
                  value={activeRadius}
                  onValueChange={(v) => v && updateWithCustomPreset("radius", v)}
                >
                  <SelectTrigger className={selectTriggerCls}>
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
              <ConfigRow label="Default Theme">
                <Select
                  value={customization.defaultMode || "system"}
                  onValueChange={(v) => v && updateFields({ defaultMode: v })}
                >
                  <SelectTrigger className={selectTriggerCls}>
                    {DEFAULT_MODE_OPTIONS.find(
                      (o) => o.value === (customization.defaultMode || "system"),
                    )?.label ?? "System"}
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigRow>
            </ConfigCard>
          </SidebarSection>

          <SidebarSection label="Layout" action={<ProBadge />}>
            <FeatureGate requiredPlan="pro" variant="block">
              <ConfigCard>
                <StyleNumberInput
                  label="Page Width"
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
                <StyleNumberInput
                  label="Cover Height"
                  value={customization.coverHeight}
                  onChange={(v) => updateScrubberField("coverHeight", v)}
                  allowAuto
                  isAuto={!customization.coverHeight}
                  onAutoChange={() => resetScrubberField("coverHeight")}
                  min={100}
                  max={400}
                  step={10}
                  unit="px"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
                <StyleNumberInput
                  label="Logo Width"
                  value={customization.logoWidth}
                  onChange={(v) => updateScrubberField("logoWidth", v)}
                  allowAuto
                  isAuto={!customization.logoWidth}
                  onAutoChange={() => resetScrubberField("logoWidth")}
                  min={0}
                  max={100}
                  step={4}
                  unit="px"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
                <StyleNumberInput
                  label="Input Width"
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
              </ConfigCard>
            </FeatureGate>
          </SidebarSection>

          <SidebarSection label="Typography" action={<ProBadge />}>
            <FeatureGate requiredPlan="pro" variant="block">
              <ConfigCard>
                <StyleNumberInput
                  label="Font Size"
                  value={customization.baseFontSize}
                  onChange={(v) => updateScrubberField("baseFontSize", v)}
                  allowAuto
                  isAuto={!customization.baseFontSize}
                  onAutoChange={() => resetScrubberField("baseFontSize")}
                  min={12}
                  max={24}
                  step={1}
                  unit="px"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
                <StyleNumberInput
                  label="Letter Spacing"
                  value={customization.letterSpacing}
                  onChange={(v) => updateScrubberField("letterSpacing", v)}
                  allowAuto
                  isAuto={!customization.letterSpacing}
                  onAutoChange={() => resetScrubberField("letterSpacing")}
                  min={0}
                  max={0.2}
                  step={0.005}
                  unit="em"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
              </ConfigCard>
            </FeatureGate>
          </SidebarSection>

          <SidebarSection label="Title" action={<ProBadge />}>
            <FeatureGate requiredPlan="pro" variant="block">
              <ConfigCard>
                <ConfigRow label="Font">
                  <Select
                    value={getValue("titleFont") || "Timeless Serif"}
                    onValueChange={(v) => {
                      if (!v) return;
                      loadGoogleFont(v);
                      updateWithCustomPreset("titleFont", v);
                    }}
                  >
                    <SelectTrigger className={selectTriggerCls}>
                      {FONT_OPTIONS.find(
                        (o) => o.value === (getValue("titleFont") || "Timeless Serif"),
                      )?.label ??
                        (getValue("titleFont") || "Timeless Serif")}
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
                <StyleNumberInput
                  label="Font Size"
                  value={customization.titleFontSize}
                  onChange={(v) => updateScrubberField("titleFontSize", v)}
                  allowAuto
                  isAuto={!customization.titleFontSize}
                  onAutoChange={() => resetScrubberField("titleFontSize")}
                  min={24}
                  max={72}
                  step={2}
                  unit="px"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
                <StyleNumberInput
                  label="Letter Spacing"
                  value={customization.titleLetterSpacing}
                  onChange={(v) => updateScrubberField("titleLetterSpacing", v)}
                  allowAuto
                  isAuto={!customization.titleLetterSpacing}
                  onAutoChange={() => resetScrubberField("titleLetterSpacing")}
                  min={-3}
                  max={3}
                  step={0.25}
                  unit="px"
                  displayUnit=""
                  className={CONFIG_INPUT_CLS}
                />
                <ConfigRow label="Italic" variant="switch">
                  <Switch
                    aria-label="Italic"
                    checked={getValue("titleItalic") === "true"}
                    onCheckedChange={(v: boolean) =>
                      updateWithCustomPreset("titleItalic", v ? "true" : "")
                    }
                    size="default"
                  />
                </ConfigRow>
              </ConfigCard>
            </FeatureGate>
          </SidebarSection>

          <SidebarSection label="Colors" action={<ProBadge />}>
            <FeatureGate requiredPlan="pro" variant="block">
              <Tabs value={activeMode} onValueChange={handleModeToggle} className="mb-2.5">
                <TabsList className="w-full">
                  <TabsTrigger value="light">Light</TabsTrigger>
                  <TabsTrigger value="dark">Dark</TabsTrigger>
                  <TabsIndicator />
                </TabsList>
              </Tabs>
              <ConfigCard>
                <AdvancedColorPickers
                  customization={customization}
                  updateField={updateWithCustomPreset}
                />
              </ConfigCard>
            </FeatureGate>
          </SidebarSection>

          <SidebarSection label="Custom CSS" action={<ProBadge />}>
            <FeatureGate requiredPlan="pro" variant="block">
              <div className="overflow-hidden rounded-lg border border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <Textarea
                  value={cssValue}
                  onChange={handleCssChange}
                  aria-label={`Custom CSS (${activeMode} mode)`}
                  className="h-32 rounded-none border-0 bg-secondary p-3 font-mono text-[11px] text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder=".bf-themed { ... }"
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center gap-1.5 px-1 pt-2">
                <Tooltip>
                  <TooltipTrigger
                    render={<InfoIcon className="h-3 w-3 cursor-help text-muted-foreground/60" />}
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
        </div>
      </SidebarContent>
    </Sidebar>
  );
};

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
  { key: "input", label: "Input" },
  { key: "border", label: "Border" },
  { key: "muted", label: "Muted" },
  { key: "muted-foreground", label: "Muted FG" },
  { key: "ring", label: "Ring" },
] as const;

const AdvancedColorPickers = ({
  customization,
  updateField,
}: {
  customization: Record<string, string>;
  updateField: (field: string, value: string) => void;
}) => {
  const baseColorName = customization.baseColor || "neutral";
  const themeColorName = customization.themeColor || "neutral";
  const isDark = customization.mode === "dark";
  const mode = isDark ? "dark" : "light";
  const baseColors = isDark ? DARK_BASE_COLORS : BASE_COLORS;
  const base = baseColors[baseColorName] ?? baseColors.neutral;
  const theme = THEME_COLORS[themeColorName] ?? THEME_COLORS.neutral;

  const resolved: Record<string, string> = {
    ...base,
    ...theme,
    secondary: base.muted,
    "secondary-foreground": base["muted-foreground"],
    destructive: "#ef4444",
    "destructive-foreground": "#fafafa",
  };

  return (
    <>
      {ADVANCED_COLOR_TOKENS.map(({ key, label }) => {
        const prefixedKey = `${mode}:${key}`;
        const currentValue =
          customization[prefixedKey] || customization[key] || resolved[key] || "#000000";

        return (
          <StyleColorPicker
            key={key}
            label={label}
            value={currentValue}
            onChange={(v) => updateField(prefixedKey, v)}
            className="!rounded-none"
          />
        );
      })}
    </>
  );
};
