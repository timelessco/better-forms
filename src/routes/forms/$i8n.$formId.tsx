import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PublicFormPage } from "@/routes/forms/-components/public-form-page";
import type { PublicFormEmbedConfig } from "@/routes/forms/-components/public-form-page";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getPublishedFormById } from "@/lib/server-fn/public-form-view";
import { seo } from "@/lib/seo";

const PublicFormRoute = () => {
  const loaderData = Route.useLoaderData();
  const { formId } = Route.useParams();
  const search = Route.useSearch();

  // Support both transparentBackground and transparent params
  const isTransparent = search.transparentBackground || search.transparent || false;

  const embedConfig: PublicFormEmbedConfig = {
    title: search.hideTitle ? "hidden" : "visible",
    background: isTransparent ? "transparent" : "solid",
    alignment: search.alignLeft ? "left" : "center",
    dynamicHeight: search.dynamicHeight ?? false,
    dynamicWidth: search.dynamicWidth ?? false,
  };

  return (
    <PublicFormPage
      form={loaderData?.form ?? null}
      error={loaderData?.error ?? null}
      gated={loaderData?.gated ?? null}
      formId={formId}
      isPopup={search.popup}
      embedConfig={embedConfig}
    />
  );
};

export const Route = createFileRoute("/forms/$i8n/$formId")({
  validateSearch: zodValidator(
    z.object({
      // No `.default()` here — TanStack Router would canonicalize a bare URL
      // to `?popup=false&…`, breaking link-preview bots that don't follow
      // redirects.
      transparentBackground: z.boolean().optional(),
      transparent: z.coerce.boolean().optional(), // Alias for transparentBackground
      popup: z.coerce.boolean().optional(),
      hideTitle: z.coerce.boolean().optional(),
      alignLeft: z.coerce.boolean().optional(),
      originPage: z.string().optional(),
      dynamicHeight: z.coerce.boolean().optional(),
      dynamicWidth: z.coerce.boolean().optional(),
    }),
  ),
  loader: async ({ params }) => getPublishedFormById({ data: { id: params.formId } }),
  head: ({ loaderData }) => ({
    meta: seo({
      formTitle: loaderData?.form?.title ?? "Form",
      description: loaderData?.form?.ogDescription || undefined,
      image: loaderData?.form?.ogImageUrl,
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
    ],
    scripts: [
      {
        // Inline script to force light theme before paint — prevents dark mode flash
        children: `document.documentElement.classList.remove("dark");document.documentElement.classList.add("light");`,
      },
    ],
  }),
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  pendingMs: 500,
  pendingMinMs: 300,
  component: PublicFormRoute,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
