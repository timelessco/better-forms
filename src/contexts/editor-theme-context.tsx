import type { CSSProperties } from "react";
import { createContext, use } from "react";

export interface EditorThemeValue {
  themeVars: CSSProperties;
  hasCustomization: boolean;
  customization?: Record<string, string> | null;
  updateThemeColor?: (themeColor: string) => void;
}

const EditorThemeContext = createContext<EditorThemeValue>({
  themeVars: {},
  hasCustomization: false,
});

export const EditorThemeProvider = EditorThemeContext.Provider;
export const useEditorTheme = () => use(EditorThemeContext);
