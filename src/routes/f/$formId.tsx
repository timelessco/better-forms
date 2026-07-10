import { createFileRoute, isNotFound, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { PublicFormPage } from "@/routes/forms/-components/public-form-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { CustomDomainNotFound } from "@/components/ui/custom-domain-not-found";
import { getCustomDomainFormByIdRSC } from "@/lib/server-fn/custom-domain-view-rsc";
import {
  generateThemeCss,
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
import { getCoverPreloadLinks } from "@/lib/vercel-image";

const CustomDomainFormIdRoute = () => {
  const loaderData = Route.useLoaderData();
  const { formId } = Route.useParams();
  const search = Route.useSearch();

  const rawCustomization = loaderData?.form?.customization ?? null;
  const { resolvedTheme, embedConfig, handleThemeChange, showThemeToggle } = usePublicFormTheme({
    id: formId,
    rawCustomization,
    search,
  });

  const customization = useMemo(
    () => (rawCustomization ? { ...rawCustomization, mode: resolvedTheme } : rawCustomization),
    [rawCustomization, resolvedTheme],
  );
  const themeCss = useMemo(() => generateThemeCss(customization), [customization]);

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <PublicFormPage
        form={loaderData?.form ?? null}
        error={loaderData?.error ?? null}
        gated={loaderData?.gated ?? null}
        formId={formId}
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

export const Route = createFileRoute("/f/$formId")({
  validateSearch: publicFormSearchSchema,
  loader: async ({ params }) => {
    try {
      return await getCustomDomainFormByIdRSC({ data: { formId: params.formId } });
    } catch (e) {
      if (isNotFound(e)) throw notFound();
      throw e;
    }
  },
  head: ({ loaderData, params }) => {
    const siteTitle = loaderData?.domainMeta?.siteTitle ?? "Forms";
    const formTitle = loaderData?.form?.title;
    const defaultMode = loaderData?.form?.customization?.defaultMode || "system";
    const formId = params.formId;
    const formOgImage = loaderData?.form?.ogImageUrl;
    const domainOgImage = loaderData?.domainMeta?.ogImageUrl ?? undefined;
    const googleFontUrl = getGoogleFontLinkUrl(loaderData?.form?.customization ?? null);
    return {
      meta: seo({
        formTitle,
        siteTitle,
        description: loaderData?.form?.ogDescription || undefined,
        image: formOgImage ?? domainOgImage,
        noindex: true,
      }),
      links: [
        ...getMediaPreconnects(
          loaderData?.form?.cover,
          loaderData?.form?.icon,
          loaderData?.form?.ogImageUrl,
        ),
        ...(googleFontUrl
          ? [...GOOGLE_FONTS_PRECONNECTS, { rel: "stylesheet", href: googleFontUrl }]
          : []),
        ...(loaderData?.domainMeta?.faviconUrl
          ? [{ rel: "icon", href: loaderData.domainMeta.faviconUrl }]
          : []),
        ...getCoverPreloadLinks(loaderData?.form?.cover),
      ],
      scripts: [{ children: buildThemeBootScript(formId, defaultMode) }],
    };
  },
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  pendingMs: 500,
  pendingMinMs: 300,
  component: CustomDomainFormIdRoute,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: CustomDomainNotFound,
});
