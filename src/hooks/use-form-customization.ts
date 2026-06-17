import { useEffect, useMemo } from "react";
import {
  getThemeStyleVars,
  getGoogleFontLinkUrl,
  resolveEffectiveMode,
} from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";

/**
 * Memoizes form customization/theme data; loads Google Fonts when selected. Shared by landing-editor, editor-app, preview-mode.
 * effectiveTheme precedence: modeOverride (editor Customize toggle) → customization.defaultMode (if "light"/"dark") → appTheme.
 * Drives the scoped preview `.dark`/`.bf-light` so previews match published output (and the editor's editing mode).
 */
export const useFormCustomization = (
  doc: { customization?: unknown } | null | undefined,
  appTheme: "light" | "dark",
  modeOverride?: "light" | "dark" | null,
) => {
  const rawCustomization = (doc?.customization ?? null) as Record<string, string> | null;
  const effectiveTheme = resolveEffectiveMode(
    rawCustomization?.defaultMode,
    appTheme,
    modeOverride,
  );
  const customization =
    rawCustomization && rawCustomization.mode !== effectiveTheme
      ? { ...rawCustomization, mode: effectiveTheme }
      : rawCustomization;
  const hasCustomization = !!(customization && Object.keys(customization).length > 0);
  // Stable primitive dep — store emits new object refs; memo would miss otherwise.
  const customizationKey = customization ? JSON.stringify(customization) : null;
  // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- customizationKey is a stable serialized form of customization
  const themeVars = useMemo(() => getThemeStyleVars(customization), [customizationKey]);
  // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- customizationKey is a stable serialized form of customization
  const googleFontUrl = useMemo(() => getGoogleFontLinkUrl(customization), [customizationKey]);

  // Dynamically load Google Fonts in editor/preview contexts
  useEffect(() => {
    if (customization?.font) {
      loadGoogleFont(customization.font);
    }
    if (customization?.titleFont) {
      loadGoogleFont(customization.titleFont);
    }
  }, [customization?.font, customization?.titleFont]);

  return { customization, hasCustomization, themeVars, googleFontUrl, effectiveTheme };
};
