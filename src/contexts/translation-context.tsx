import { createContext, use, useCallback, useMemo } from "react";
import { getTranslations, languageToCode } from "@/lib/translations";
import type { TranslationKey } from "@/lib/translations";

interface TranslationContextValue {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  language: string; // language code (en/es/fr)
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationProviderProps {
  /** Language name ("English") or code ("en") */
  language: string;
  children: React.ReactNode;
}

export const TranslationProvider = ({ language, children }: TranslationProviderProps) => {
  const translations = useMemo(() => getTranslations(language), [language]);
  const code = language.length <= 3 ? language : languageToCode(language);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let str = translations[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [translations],
  );

  const value = useMemo(() => ({ t, language: code }), [t, code]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
};

export const useTranslation = (): TranslationContextValue => {
  const ctx = use(TranslationContext);
  if (!ctx) {
    // Fallback to English if no provider
    return {
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        const translations = getTranslations("en");
        let str = translations[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            str = str.replaceAll(`{${k}}`, String(v));
          }
        }
        return str;
      },
      language: "en",
    };
  }
  return ctx;
};
