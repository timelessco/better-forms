import { useEffect, useMemo } from "react";
import { getThemeStyleVars, getGoogleFontLinkUrl } from "@/lib/theme/generate-theme-css";
import { loadGoogleFont } from "@/lib/theme/load-google-font";

/**
 * Memoizes form customization/theme data; loads Google Fonts when selected. Shared by landing-editor, editor-app, preview-mode.
 * effectiveTheme = customization.defaultMode if "light"/"dark", else appTheme. Drives root `.dark` so previews match published output.
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
