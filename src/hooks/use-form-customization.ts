import { useEffect, useMemo } from "react";
import { getThemeStyleVars, getGoogleFontLinkUrl } from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";

/**
 * Extracts and memoizes customization/theme data from a form document.
 * Deduplicates the repeated pattern across landing-editor, editor-app, and preview-mode.
 * Dynamically loads Google Fonts when selected.
 *
 * `effectiveTheme` resolves to the form's hard-coded `customization.defaultMode`
 * when it's "light" or "dark", otherwise falls back to `appTheme`. Callers use
 * it to drive the root `.dark` class so light/dark previews don't drift from
 * what the form will publish as.
 */
export const useFormCustomization = (
  doc: { customization?: unknown } | null | undefined,
  appTheme: "light" | "dark",
) => {
  const rawCustomization = (doc?.customization ?? null) as Record<string, string> | null;
  const formDefaultMode = rawCustomization?.defaultMode;
  const effectiveTheme: "light" | "dark" =
    formDefaultMode === "light" || formDefaultMode === "dark" ? formDefaultMode : appTheme;
  const customization =
    rawCustomization && rawCustomization.mode !== effectiveTheme
      ? { ...rawCustomization, mode: effectiveTheme }
      : rawCustomization;
  const hasCustomization = !!(customization && Object.keys(customization).length > 0);
  // Use a stable primitive dep so the memo doesn't miss when the store emits a new object reference
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
