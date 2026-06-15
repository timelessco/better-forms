import { useMemo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import type { EditorThemeValue } from "@/contexts/editor-theme-context";

type UseFormThemeContextValueArgs = {
  themeVars: CSSProperties;
  hasCustomization: boolean;
  customization?: Record<string, string> | null;
  /** Editor-only callback; preview-mode passes nothing here (read-only). */
  updateThemeColor?: (themeColor: string) => void;
  /** Editor-only: set the form header's cover/logo (Plate formHeader node). */
  updateHeaderMedia?: (field: "icon" | "cover", value: string | null) => void;
};

/** Memoizes EditorThemeProvider value — stable context object; else every parent render re-notifies all consumers. */
export const useFormThemeContextValue = ({
  themeVars,
  hasCustomization,
  customization,
  updateThemeColor,
  updateHeaderMedia,
}: UseFormThemeContextValueArgs): EditorThemeValue =>
  useMemo(
    () => ({
      themeVars,
      hasCustomization,
      customization,
      updateThemeColor: hasCustomization ? updateThemeColor : undefined,
      updateHeaderMedia,
    }),
    [themeVars, hasCustomization, customization, updateThemeColor, updateHeaderMedia],
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
