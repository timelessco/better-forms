import type { CSSProperties } from "react";
import {
  BASE_COLORS,
  DARK_BASE_COLORS,
  THEME_COLORS,
  RADIUS_MAP,
  SPACING_MAP,
  STYLES,
  DESTRUCTIVE_TOKENS,
  SUCCESS_TOKENS,
} from "./theme-presets";
import { FONT_MAP, getGoogleFontUrl } from "./font-registry";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "./customization-defaults";
import { migrateCustomization } from "./customization-migrate";
import { deriveContrastTokens } from "./color-contrast";

/**
 * Effective color mode the form renders in. Precedence:
 * override (editor Customize toggle) → form defaultMode (if "light"/"dark") → app theme.
 * Single source of truth shared by useFormCustomization and the Customize sidebar so the preview
 * always matches published output.
 */
export const resolveEffectiveMode = (
  formDefaultMode: string | undefined,
  appTheme: "light" | "dark",
  override?: "light" | "dark" | null,
): "light" | "dark" => {
  const baseMode =
    formDefaultMode === "light" || formDefaultMode === "dark" ? formDefaultMode : appTheme;
  return override ?? baseMode;
};

/** Layout fields → --bf-* CSS vars. Apply to editor (layout only) + preview/public (full theme). */
const LAYOUT_FIELDS: Record<string, string> = {
  pageWidth: "--bf-page-width",
  coverHeight: "--bf-cover-height",
  logoWidth: "--bf-logo-width",
  logoHeight: "--bf-logo-height",
  inputWidth: "--bf-input-width",
  baseFontSize: "--bf-font-size",
  letterSpacing: "--bf-letter-spacing",
  titleFontSize: "--bf-title-font-size",
  titleLetterSpacing: "--bf-title-letter-spacing",
  // v2: defaults live in CSS var() fallbacks, NOT CUSTOMIZATION_AUTO_DEFAULTS (unset = pixel-identical)
  coverFit: "--bf-cover-fit",
  coverRadius: "--bf-cover-radius",
  logoRadius: "--bf-logo-radius",
  inputHeight: "--bf-input-height",
  inputRadius: "--bf-input-radius",
  inputPadding: "--bf-input-padding",
  inputMarginBottom: "--bf-input-margin-bottom",
  buttonWidth: "--bf-button-width",
  buttonHeight: "--bf-button-height",
  buttonRadius: "--bf-button-radius",
  lineHeight: "--bf-line-height",
  textAlign: "--bf-text-align",
  titleLineHeight: "--bf-title-line-height",
  titleAlign: "--bf-title-align",
};

// Button alignment (Buttons section) — left/center/right stored, emitted as the flex justify value
// consumed by the action-button row wrapper only (scoped to the button, not the whole doc).
const BUTTON_ALIGN_JUSTIFY: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

/** Migrates legacy "vw" page-width values to "%" (same numeric range 30-100). */
const migratePageWidth = (value: string): string =>
  value.endsWith("vw") ? value.replace(/vw$/, "%") : value;

/** shadcn token names overridable via --bf-* prefix. */
export const TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "border",
  "input",
  "ring",
] as const;

/** Tokens a user (or the AI) may override per-mode. Everything else in TOKEN_NAMES is
 * structural — always derived from the base/accent palette, never overridable. The Advanced
 * raw-token UI (which exposed the full set) was removed, so only the semantic Colors tokens
 * stay overridable; stored overrides for any other token are now inert. */
export const OVERRIDABLE_TOKEN_NAMES = [
  "background",
  "foreground",
  "primary",
  "destructive",
  "success",
  "input",
] as const;

/** Resolve design tokens from a customization record. Cascade: preset → BASE_COLORS
 * → THEME_COLORS → derive secondary=muted/destructive=const → font+radius → Pro token overrides. */
const resolveTokens = (customization: Record<string, string>): Record<string, string> => {
  const presetName = customization.preset || "vega";
  const style = STYLES[presetName] ?? STYLES.vega;

  const baseColorName = customization.baseColor || style.baseColor;
  const themeColorName = customization.themeColor || style.themeColor;
  const fontName = customization.font || style.font;
  const radiusName = customization.radius || style.radius;
  const spacingName = customization.spacing || style.spacing;

  const isDark = customization.mode === "dark";
  const baseColors = isDark ? DARK_BASE_COLORS : BASE_COLORS;
  const base = baseColors[baseColorName] ?? baseColors.neutral;
  const theme = THEME_COLORS[themeColorName] ?? THEME_COLORS.neutral;

  const tokens: Record<string, string> = {
    ...base,
    ...theme,
    // Derived: secondary = base's muted
    secondary: base.muted,
    "secondary-foreground": base["muted-foreground"],
    ...DESTRUCTIVE_TOKENS,
    ...SUCCESS_TOKENS,
  };

  const fontValue = FONT_MAP[fontName] ?? FONT_MAP.Inter;
  tokens.font = fontValue;

  const radiusValue = RADIUS_MAP[radiusName] ?? RADIUS_MAP.medium;
  tokens.radius = radiusValue;

  const spacingValue = SPACING_MAP[spacingName] ?? SPACING_MAP.normal;
  tokens.spacing = spacingValue;

  // Override priority: mode-prefixed key (e.g. "light:primary") > unprefixed legacy key.
  // Only the overridable (semantic) tokens are honored — advanced raw-token overrides are inert.
  const mode = isDark ? "dark" : "light";
  for (const tokenName of OVERRIDABLE_TOKEN_NAMES) {
    const prefixedKey = `${mode}:${tokenName}`;
    if (customization[prefixedKey]) {
      tokens[tokenName] = customization[prefixedKey];
    } else if (customization[tokenName]) {
      tokens[tokenName] = customization[tokenName];
    }
  }

  // title-color: color-like but not in TOKEN_NAMES; mode-prefixed, default falls back to foreground via CSS var()
  const titleColor = customization[`${mode}:title-color`] || customization["title-color"];
  if (titleColor) tokens["title-color"] = titleColor;

  // Card coherence: override bg/fg but not card → sync card to page surface so
  // inline cards read as one sheet with the form.
  // Popover NOT synced — portaled popups (date picker, multi-select, country picker)
  // keep a distinct tone so they read as a layer above, not an invisible patch.
  const userOverrodeBg = Boolean(customization[`${mode}:background`] || customization.background);
  const userOverrodeFg = Boolean(customization[`${mode}:foreground`] || customization.foreground);
  const explicitCard = customization[`${mode}:card`] || customization.card;
  if (userOverrodeBg && !explicitCard) {
    tokens.card = tokens.background;
  }
  const explicitCardFg =
    customization[`${mode}:card-foreground`] || customization["card-foreground"];
  if (userOverrodeFg && !explicitCardFg) {
    tokens["card-foreground"] = tokens.foreground;
  }

  return tokens;
};

/** Mode-dependent token entries (colors that change light↔dark). Pass pre-resolved
 * tokens to avoid re-running resolveTokens. */
const buildColorTokenEntries = (tokens: Record<string, string>): [string, string][] => {
  const entries: [string, string][] = [];
  for (const tokenName of TOKEN_NAMES) {
    if (tokens[tokenName]) {
      entries.push([`--bf-${tokenName}`, tokens[tokenName]]);
      entries.push([`--${tokenName}`, tokens[tokenName]]);
    }
  }
  // title-color emits only --bf-title-color (no shadcn var); mode-dependent, kept here for dual-mode css
  if (tokens["title-color"]) {
    entries.push(["--bf-title-color", tokens["title-color"]]);
  }
  // Derived auto-contrast tokens (input ink, badge surface+ink) — mode-dependent since input is.
  for (const [prop, val] of Object.entries(deriveContrastTokens(tokens))) {
    entries.push([prop, val]);
  }
  return entries;
};

/** Mode-independent entries (font, radius, spacing, title font, layout vars). */
const buildModeAgnosticEntries = (
  customization: Record<string, string>,
  tokens: Record<string, string>,
): [string, string][] => {
  const entries: [string, string][] = [];

  if (tokens.font) entries.push(["--bf-font", tokens.font]);
  if (tokens.radius) entries.push(["--bf-radius", tokens.radius]);
  if (tokens.spacing) entries.push(["--bf-spacing", tokens.spacing]);

  if (customization.titleFont) {
    const titleFontValue = FONT_MAP[customization.titleFont] ?? FONT_MAP.Inter;
    entries.push(["--bf-title-font", titleFontValue]);
  }
  if (customization.titleItalic === "true") {
    entries.push(["--bf-title-font-style", "italic"]);
  }

  for (const [field, cssVar] of Object.entries(LAYOUT_FIELDS)) {
    if (customization[field]) {
      const val =
        field === "pageWidth" ? migratePageWidth(customization[field]) : customization[field];
      entries.push([cssVar, val]);
    } else if (field in CUSTOMIZATION_AUTO_DEFAULTS) {
      entries.push([
        cssVar,
        CUSTOMIZATION_AUTO_DEFAULTS[field as keyof typeof CUSTOMIZATION_AUTO_DEFAULTS],
      ]);
    }
  }

  const buttonJustify = BUTTON_ALIGN_JUSTIFY[customization.buttonAlign];
  if (buttonJustify) entries.push(["--bf-button-justify", buttonJustify]);

  // Cover width: "fit" bleeds 28px past the form width on each side (Figma) into the editor
  // gutter (always >= 64px). "fill"/unset emits the full-bleed values EXPLICITLY (same as the
  // styles.css fallbacks) — relying on key absence let stale fit vars survive a fit→fill
  // switch on some apply paths, leaving the cover form-width with gaps while set to Fill.
  if (customization.coverWidth === "fit") {
    entries.push(
      ["--bf-cover-w", "calc(100% + 56px)"],
      ["--bf-cover-mx", "-28px"],
      ["--bf-cover-x", "0px"],
      // Fit floats as a card: 32px gap from the top (Figma). Fill bleeds flush to the top.
      ["--bf-cover-mt", "32px"],
      // Fit is a clean rounded card (Figma) — suppress the bottom fade/blur dissolve.
      ["--bf-cover-fade", "none"],
      // Fit shows the ambient glow (blurred image copy) and goes overflow-visible so it can bleed.
      ["--bf-cover-glow", "block"],
      ["--bf-cover-overflow", "visible"],
      // Fill the card height (crop), not letterbox — overrides any stale coverFit:"contain".
      ["--bf-cover-fit", "cover"],
    );
  } else {
    // cqw = nearest [data-bf-cover-pane] container (editor/preview pane); falls back to the
    // small viewport width on the public form where no container exists.
    entries.push(
      ["--bf-cover-w", "100cqw"],
      ["--bf-cover-mx", "-50cqw"],
      ["--bf-cover-x", "50%"],
      ["--bf-cover-mt", "0px"],
      ["--bf-cover-glow", "none"],
      ["--bf-cover-overflow", "hidden"],
      ["--bf-cover-fade", "block"],
      // Crop to fill, never letterbox — stale legacy coverFit:"contain" centers the image
      // inside the full-bleed box, which reads as side gaps while the box itself is full width.
      ["--bf-cover-fit", "cover"],
    );
  }

  return entries;
};

/** --bf-* entries from resolved tokens + layout (mode-dependent + mode-agnostic).
 * Used by getThemeStyleVars where a single mode is required. */
const buildThemeVarEntries = (customization: Record<string, string>): [string, string][] => {
  const tokens = resolveTokens(customization);
  return [...buildColorTokenEntries(tokens), ...buildModeAgnosticEntries(customization, tokens)];
};

/** React style object of CSS custom props for the full theme. Apply to a `.bf-themed`
 * container; styles.css bridge rules map --bf-* to shadcn vars in scope. */
export const getThemeStyleVars = (
  raw: Record<string, string> | null | undefined,
): CSSProperties => {
  const customization = migrateCustomization(raw);
  if (Object.keys(customization).length === 0) return {};

  const vars: Record<string, string> = {};
  for (const [prop, value] of buildThemeVarEntries(customization)) {
    vars[prop] = value;
  }
  applyLogoMinimalFlag(customization, vars);
  return vars as CSSProperties;
};

const applyLogoMinimalFlag = (
  customization: Record<string, string>,
  vars: Record<string, string>,
): void => {
  if (customization.logoWidth && Number.parseInt(customization.logoWidth) <= 0) {
    vars["--bf-logo-minimal"] = "1";
  }
};

/** `<style>` body setting CSS custom props on `.bf-themed`, for public-form SSR
 * injection. Consuming bridge rules live in styles.css. */
export const generateThemeCss = (raw: Record<string, string> | null | undefined): string => {
  const customization = migrateCustomization(raw);
  if (Object.keys(customization).length === 0) return "";

  const entries = buildThemeVarEntries(customization);
  if (entries.length === 0) return "";

  const varLines = entries.map(([prop, val]) => `  ${prop}: ${val};`).join("\n");

  let css = `.bf-themed {\n${varLines}\n}`;

  const customCss = customization.customCss?.trim();
  if (customCss) {
    css += `\n/* Custom CSS */\n${customCss}\n`;
  }

  return css;
};

const formatCssBlock = (selector: string, entries: [string, string][]): string => {
  if (entries.length === 0) return "";
  const lines = entries.map(([prop, val]) => `  ${prop}: ${val};`).join("\n");
  return `${selector} {\n${lines}\n}`;
};

// Prefer over generateThemeCss for SSR: avoids flash when viewer theme ≠ server
// default. Emits both sets; root `.dark`/`.light` class picks one in pure CSS,
// no hydration regen.
export const generateDualThemeCss = (raw: Record<string, string> | null | undefined): string => {
  const customization = migrateCustomization(raw);
  if (Object.keys(customization).length === 0) return "";

  const lightTokens = resolveTokens({ ...customization, mode: "light" });
  const darkTokens = resolveTokens({ ...customization, mode: "dark" });

  const baseEntries = buildModeAgnosticEntries(customization, lightTokens);
  const lightColorEntries = buildColorTokenEntries(lightTokens);
  const darkColorEntries = buildColorTokenEntries(darkTokens);

  const blocks: string[] = [];

  if (baseEntries.length > 0) {
    blocks.push(formatCssBlock(".bf-themed", baseEntries));
  }
  if (lightColorEntries.length > 0) {
    blocks.push(
      formatCssBlock(":root:not(.dark) .bf-themed, .light .bf-themed", lightColorEntries),
    );
  }
  if (darkColorEntries.length > 0) {
    blocks.push(formatCssBlock(":root.dark .bf-themed, .dark .bf-themed", darkColorEntries));
  }

  let css = blocks.join("\n");

  const customCss = customization.customCss?.trim();
  if (customCss) {
    css += `\n/* Custom CSS */\n${customCss}\n`;
  }

  return css;
};

/** Google Fonts CSS API URL for customization's font, or null if self-hosted. */
export const getGoogleFontLinkUrl = (
  customization: Record<string, string> | null | undefined,
): string | null => {
  if (!customization) return null;
  const presetName = customization.preset || "vega";
  const style = STYLES[presetName] ?? STYLES.vega;
  const fontName = customization.font || style.font;
  return getGoogleFontUrl(fontName);
};

export const GOOGLE_FONTS_PRECONNECTS = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
] as const;

type MediaPreconnect = { rel: "preconnect"; href: string; crossOrigin: "anonymous" };

/**
 * Preconnect hints for media hosts a form may reference. Always includes
 * images.unsplash.com. Absolute URLs contribute their origin; relative URLs
 * (e.g. /_vercel/image) skipped (same-origin needs no hint).
 * Deduped, emitted crossorigin="anonymous" — media fetched without credentials,
 * matching CORS mode required to reuse the preconnected socket.
 */
export const getMediaPreconnects = (...urls: (string | null | undefined)[]): MediaPreconnect[] => {
  const origins = new Set<string>(["https://images.unsplash.com"]);
  for (const url of urls) {
    if (!url) continue;
    try {
      const u = new URL(url);
      if (u.protocol === "https:" || u.protocol === "http:") {
        origins.add(u.origin);
      }
    } catch {
      // relative URLs / malformed input — skip
    }
  }
  return [...origins].map((href) => ({
    rel: "preconnect" as const,
    href,
    crossOrigin: "anonymous" as const,
  }));
};
