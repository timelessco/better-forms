import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PublicFormPage } from "@/routes/forms/-components/public-form-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getPublicFormViewRSC } from "@/lib/server-fn/public-form-view-rsc";
import {
  generateDualThemeCss,
  getGoogleFontLinkUrl,
  getMediaPreconnects,
  GOOGLE_FONTS_PRECONNECTS,
} from "@/lib/theme/generate-theme-css";
import {
  buildThemeBootScript,
  publicFormSearchSchema,
  usePublicFormTheme,
} from "@/lib/theme/public-form-theme";
import { seo } from "@/lib/seo";
import { APP_WEBSITE_URL } from "@/lib/config/app-config";
import { getCoverPreloadLinks } from "@/lib/vercel-image";

const PublicFormRoute = () => {
  const loaderData = Route.useLoaderData();
  const { shortId } = Route.useParams();
  const search = Route.useSearch();

  const rawCustomization = loaderData?.form?.customization ?? null;
  const { resolvedTheme, embedConfig, handleThemeChange, showThemeToggle } = usePublicFormTheme({
    id: shortId,
    rawCustomization,
    search,
  });

  // Dual-mode CSS — emit both light+dark tokens, root `.dark` picks in CSS, no hydration flash.
  const themeCss = useMemo(() => generateDualThemeCss(rawCustomization), [rawCustomization]);

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <PublicFormPage
        form={loaderData?.form ?? null}
        error={loaderData?.error ?? null}
        gated={loaderData?.gated ?? null}
        formId={loaderData?.form?.id ?? ""}
        isPopup={search.popup}
        embedConfig={embedConfig}
        resolvedAppTheme={resolvedTheme}
        rsc={
          loaderData?.form
            ? {
                steps: loaderData.steps,
                thankYou: loaderData.thankYou,
                stepCount: loaderData.stepCount,
                header: loaderData.header,
                formHeaderIconColor: loaderData.formHeaderIconColor,
                logic: loaderData.logic,
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

export const Route = createFileRoute("/forms/$shortId")({
  validateSearch: publicFormSearchSchema,
  loader: async ({ params }) => getPublicFormViewRSC({ data: { shortId: params.shortId } }),
  head: ({ loaderData, params }) => {
    const defaultMode = loaderData?.form?.customization?.defaultMode || "system";
    const shortId = params.shortId;
    const preloadUrls = loaderData?.preloadModuleUrls ?? [];
    const ogDescription = loaderData?.form?.ogDescription;
    const ogImageUrl = loaderData?.form?.ogImageUrl;
    const googleFontUrl = getGoogleFontLinkUrl(loaderData?.form?.customization ?? null);
    // Custom domain wins as canonical when present (ADR-0001).
    const canonicalHref =
      loaderData?.form?.customDomain && loaderData?.form?.slug
        ? `https://${loaderData.form.customDomain}/${loaderData.form.slug}`
        : `${APP_WEBSITE_URL}/forms/${shortId}`;
    return {
      meta: seo({
        formTitle: loaderData?.form?.title ?? "Form",
        description: ogDescription || undefined,
        image: ogImageUrl,
        noindex: true,
      }),
      links: [
        { rel: "canonical", href: canonicalHref },
        ...getMediaPreconnects(
          loaderData?.form?.cover,
          loaderData?.form?.icon,
          loaderData?.form?.ogImageUrl,
        ),
        // Preload Inter Variable Latin subset only; other subsets stay lazy (fetched only for glyphs outside U+0000–00FF).
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
          crossOrigin: "anonymous" as const,
        })),
        ...getCoverPreloadLinks(loaderData?.form?.cover),
        ...(googleFontUrl
          ? [...GOOGLE_FONTS_PRECONNECTS, { rel: "stylesheet", href: googleFontUrl }]
          : []),
      ],
      scripts: [
        { children: buildThemeBootScript(shortId, defaultMode, { paintBackground: true }) },

        {
          // Pre-hydration: on SSR HTML parse, tell parent popup (a) measured height (size iframe, no jump) + (b) form ready (hide spinner veil) without waiting for chunks. React ResizeObserver takes over post-hydration.
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
});
