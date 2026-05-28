import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useResolvedTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import type { EditorThemeValue } from "@/contexts/editor-theme-context";

/**
 * True when the FORM's resolved mode is dark (`customization.mode`), falling back to the app
 * theme only when the form has no customization. Use on form-preview surfaces that must follow
 * the form theme rather than the app's global `.dark` (e.g. chips/badges that would otherwise
 * pick up `dark:` variants from the app's <html.dark>).
 */
export const useFormIsDark = (): boolean => {
  const appTheme = useResolvedTheme();
  const formMode = useEditorTheme().customization?.mode;
  return (formMode ?? appTheme) === "dark";
};

type UseFormThemeContextValueArgs = {
  themeVars: CSSProperties;
  hasCustomization: boolean;
  customization?: Record<string, string> | null;
  /** Editor-only callback; preview-mode passes nothing here (read-only). */
  updateThemeColor?: (themeColor: string) => void;
};

/** Memoizes EditorThemeProvider value — stable context object; else every parent render re-notifies all consumers. */
export const useFormThemeContextValue = ({
  themeVars,
  hasCustomization,
  customization,
  updateThemeColor,
}: UseFormThemeContextValueArgs): EditorThemeValue =>
  useMemo(
    () => ({
      themeVars,
      hasCustomization,
      customization,
      updateThemeColor: hasCustomization ? updateThemeColor : undefined,
    }),
    [themeVars, hasCustomization, customization, updateThemeColor],
  );

/**
 * className/style pair for portaled popover/dropdown content — carries theme tokens into the portal (document.body loses `.bf-themed` CSS-var inheritance).
 * Spread: <PopoverContent className={cn(myClasses, theme.className)} style={theme.style} />
 */
export const useReanchorThemeProps = (
  baseClassName?: string,
): { className: string | undefined; style: CSSProperties | undefined } => {
  const { themeVars, hasCustomization } = useEditorTheme();
  return {
    className: cn(baseClassName, hasCustomization && "bf-themed") || undefined,
    style: hasCustomization ? themeVars : undefined,
  };
};
