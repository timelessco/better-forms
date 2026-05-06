import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PublicFormPage } from "@/routes/forms/-components/public-form-page";
import type { PublicFormEmbedConfig } from "@/routes/forms/-components/public-form-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getPublicFormViewRSC } from "@/lib/server-fn/public-form-view-rsc";
import { generateDualThemeCss, getGoogleFontLinkUrl } from "@/lib/theme/generate-theme-css";
import { seo } from "@/lib/seo";

type PublicTheme = "light" | "dark" | "system";

const themeStorageKey = (formId: string) => `bf-form-theme:${formId}`;

const resolveSystemTheme = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const PublicFormRoute = () => {
  const loaderData = Route.useLoaderData();
  const { formId } = Route.useParams();
  const search = Route.useSearch();

  const rawCustomization = loaderData?.form?.customization ?? null;
  const defaultMode = (rawCustomization?.defaultMode as PublicTheme | undefined) ?? "system";

  const [viewerTheme, setViewerTheme] = useState<PublicTheme>(() => {
    if (typeof window === "undefined") return defaultMode;
    const saved = window.localStorage.getItem(themeStorageKey(formId)) as PublicTheme | null;
    return saved ?? defaultMode;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (viewerTheme === "system") return resolveSystemTheme();
    return viewerTheme;
  });

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
      setViewerTheme(next);
      try {
        window.localStorage.setItem(themeStorageKey(formId), next);
      } catch {
        // ignore storage failures (private mode etc.)
      }
    },
    [formId],
  );

  // Support both transparentBackground and transparent params
  const isTransparent = search.transparentBackground || search.transparent || false;

  const embedConfig: PublicFormEmbedConfig = {
    title: search.hideTitle ? "hidden" : "visible",
    background: isTransparent ? "transparent" : "solid",
    alignment: search.alignLeft ? "left" : "center",
    dynamicHeight: search.dynamicHeight,
    dynamicWidth: search.dynamicWidth,
  };

  // Dual-mode CSS — both light and dark tokens are emitted; the root `.dark`
  // class picks one purely in CSS, avoiding any hydration flash.
  const themeCss = useMemo(() => generateDualThemeCss(rawCustomization), [rawCustomization]);
  const googleFontUrl = useMemo(() => getGoogleFontLinkUrl(rawCustomization), [rawCustomization]);

  const showThemeToggle = defaultMode === "system" && !search.popup && !isTransparent;

  return (
    <>
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} />}
      {themeCss && <style>{themeCss}</style>}
      <PublicFormPage
        form={loaderData?.form ?? null}
        error={loaderData?.error ?? null}
        gated={loaderData?.gated ?? null}
        formId={formId}
        isPopup={search.popup}
        embedConfig={embedConfig}
        rsc={
          loaderData?.form
            ? {
                steps: loaderData.steps,
                thankYou: loaderData.thankYou,
                stepCount: loaderData.stepCount,
                header: loaderData.header,
              }
            : undefined
        }
        themeToggle={
          showThemeToggle
            ? { current: resolvedTheme, onChange: (m) => handleThemeChange(m) }
            : undefined
        }
      />
    </>
  );
};

export const Route = createFileRoute("/forms/$formId")({
  loader: async ({ params }) => getPublicFormViewRSC({ data: { id: params.formId } }),
  head: ({ loaderData, params }) => {
    const defaultMode = loaderData?.form?.customization?.defaultMode || "system";
    const formId = params.formId;
    const preloadUrls = loaderData?.preloadModuleUrls ?? [];
    const ogDescription = loaderData?.form?.ogDescription;
    const ogImageUrl = loaderData?.form?.ogImageUrl;
    return {
      meta: seo({
        formTitle: loaderData?.form?.title ?? "Form",
        description: ogDescription || undefined,
        image: ogImageUrl,
        noindex: true,
      }),
      links: [
        // Preload the Latin subset of Inter Variable. The other subsets
        // (latin-ext, rest) stay lazy — the browser only fetches them if
        // the page renders a glyph outside U+0000–00FF.
        {
          rel: "preload",
          href: "/fonts/inter-variable/fonts/inter-variable-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous" as const,
        },
        ...preloadUrls.map((href) => ({
          rel: "modulepreload",
          href,
          crossOrigin: "" as const,
        })),
      ],
      scripts: [
        {
          // Apply theme before paint — viewer override > creator default > system
          children: `(function(){try{var d=document.documentElement;var override=null;try{override=window.localStorage.getItem("bf-form-theme:${formId}");}catch(e){}var def=${JSON.stringify(defaultMode)};var pick=override||def;var m=pick==="system"?(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"):pick;d.classList.remove("light","dark");d.classList.add(m);d.style.colorScheme=m;}catch(e){}})();`,
        },

        {
          // Pre-hydration: as soon as the SSR'd form HTML is parsed, tell the
          // parent popup (a) the measured height so it can size the iframe
          // without a jump, and (b) that the form is visually ready so the
          // popup spinner veil can be hidden — no need to wait for every CSS/JS
          // chunk to finish downloading. The React ResizeObserver + useEffect
          // in public-form-page take over after hydration.
          children: `(function(){try{if(window.parent===window)return;var p=new URLSearchParams(window.location.search);var isPopup=(p.get("popup")==="1"||p.get("popup")==="true");var isDynamic=(p.get("dynamicHeight")==="1"||p.get("dynamicHeight")==="true");if(!isPopup&&!isDynamic)return;var post=function(){var el=document.getElementById("bf-form-container");if(!el)return;var h=el.scrollHeight;if(h>0)window.parent.postMessage(JSON.stringify({event:"Reform.Resize",height:h}),"*");if(isPopup)window.parent.postMessage(JSON.stringify({event:"Reform.FormLoaded"}),"*");};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",post,{once:true});}else{post();}}catch(e){}})();`,
        },
      ],
    };
  },
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  pendingMs: 500,
  pendingMinMs: 300,
  component: PublicFormRoute,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  validateSearch: zodValidator(
    z.object({
      transparentBackground: z.boolean().optional().default(false),
      transparent: z.coerce.boolean().optional(),
      popup: z.coerce.boolean().optional().default(false),
      hideTitle: z.coerce.boolean().optional().default(false),
      alignLeft: z.coerce.boolean().optional().default(false),
      originPage: z.string().optional(),
      dynamicHeight: z.coerce.boolean().optional().default(false),
      dynamicWidth: z.coerce.boolean().optional().default(false),
    }),
  ),
});
