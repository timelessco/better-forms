// Shared theme shell for the two public-form routes (f/$formId, forms/$shortId).
// Owns the viewer-override theme state, the pre-hydration boot script, the search
// schema, and embedConfig derivation so both routes stay one implementation. Genuine
// deltas (single vs dual-theme CSS, canonical/domain meta) remain in the routes.
import { useCallback, useEffect, useState } from "react";
import * as v from "valibot";
import { safeStorage } from "@/lib/safe-storage";
import { optionalCoercedBoolean } from "@/lib/valibot-search";
import type { PublicFormEmbedConfig } from "@/routes/forms/-components/public-form-page";

export type PublicTheme = "light" | "dark" | "system";

export const themeStorageKey = (id: string) => `bf-form-theme:${id}`;

const resolveSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// No `.default()` — would 307-redirect bare URLs to a defaults-appended canonical, breaking link-preview crawlers.
export const publicFormSearchSchema = v.object({
  transparentBackground: v.optional(v.boolean()),
  transparent: optionalCoercedBoolean,
  popup: optionalCoercedBoolean,
  hideTitle: optionalCoercedBoolean,
  alignLeft: optionalCoercedBoolean,
  originPage: v.optional(v.string()),
  dynamicHeight: optionalCoercedBoolean,
  dynamicWidth: optionalCoercedBoolean,
});

export type PublicFormSearch = v.InferOutput<typeof publicFormSearchSchema>;

// Pre-hydration head script: apply theme before paint — viewer override > creator default > system.
// paintBackground also paints resolved bg on <html> pre-paint (dual-theme CSS is inlined, so the var
// resolves immediately) to kill the white flash before the body bg applies post-hydration.
export const buildThemeBootScript = (
  id: string,
  defaultMode: string,
  opts?: { paintBackground?: boolean },
) => {
  const bg = opts?.paintBackground ? `d.style.backgroundColor="var(--color-background)";` : "";
  return `(function(){try{var d=document.documentElement;var override=null;try{override=window.localStorage.getItem("${themeStorageKey(id)}");}catch(e){}var def=${JSON.stringify(defaultMode)};var pick=override||def;var m=pick==="system"?(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"):pick;d.classList.remove("light","dark");d.classList.add(m);d.style.colorScheme=m;${bg}}catch(e){}})();`;
};

interface UsePublicFormThemeArgs {
  id: string;
  rawCustomization: Record<string, string> | null | undefined;
  search: PublicFormSearch;
}

export const usePublicFormTheme = ({ id, rawCustomization, search }: UsePublicFormThemeArgs) => {
  const defaultMode = (rawCustomization?.defaultMode as PublicTheme | undefined) ?? "system";

  const [viewerTheme, setViewerTheme] = useState<PublicTheme>(() => {
    const saved = safeStorage.get(themeStorageKey(id)) as PublicTheme | null;
    return saved ?? defaultMode;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    viewerTheme === "system" ? resolveSystemTheme() : viewerTheme,
  );

  useEffect(() => {
    const root = document.documentElement;
    const apply = (resolved: "light" | "dark") => {
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      root.style.colorScheme = resolved;
      setResolvedTheme(resolved);
    };

    apply(viewerTheme === "system" ? resolveSystemTheme() : viewerTheme);

    if (viewerTheme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply(mq.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [viewerTheme]);

  useEffect(() => {
    document.body.style.backgroundColor = "var(--color-background)";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  const handleThemeChange = useCallback(
    (next: PublicTheme) => {
      // Swap DOM class synchronously so View Transitions snapshot before/after cleanly. Else React + useEffect swap run after the "after" snapshot → crossfade of identical frames (no visible transition).
      const resolved: "light" | "dark" = next === "system" ? resolveSystemTheme() : next;
      const applyDom = () => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolved);
        root.style.colorScheme = resolved;
        setResolvedTheme(resolved);
        setViewerTheme(next);
      };

      if (typeof document !== "undefined" && "startViewTransition" in document) {
        document.startViewTransition(applyDom);
      } else {
        applyDom();
      }

      safeStorage.set(themeStorageKey(id), next);
    },
    [id],
  );

  const isTransparent = search.transparentBackground || search.transparent || false;

  const embedConfig: PublicFormEmbedConfig = {
    title: search.hideTitle ? "hidden" : "visible",
    background: isTransparent ? "transparent" : "solid",
    alignment: search.alignLeft ? "left" : "center",
    dynamicHeight: search.dynamicHeight ?? false,
    dynamicWidth: search.dynamicWidth ?? false,
  };

  const showThemeToggle = defaultMode === "system" && !search.popup && !isTransparent;

  return { resolvedTheme, embedConfig, handleThemeChange, showThemeToggle };
};
