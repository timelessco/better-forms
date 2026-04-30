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
};

/**
 * Memoizes the EditorThemeProvider value so the editor app and preview mode
 * publish a stable context object — without this, every parent render creates
 * a fresh object and propagates through context to every consumer.
 */
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
 * Returns the className/style pair to slap on portaled popover/dropdown
 * content so theme tokens reach inside the portal. Without this, content
 * portaled to document.body loses CSS-var inheritance from `.bf-themed`.
 *
 * Caller spreads:
 *   <PopoverContent className={cn(myClasses, theme.className)} style={theme.style} />
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
