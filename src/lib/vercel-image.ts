/**
 * Tiny helpers that route Vercel-Blob-hosted images through Vercel's image
 * optimisation endpoint. Pure functions, server-safe — used by both the RSC
 * cover renderer and the public-form route `head()` for Early-Hints preload
 * of the LCP cover image.
 */
import { isValidUrl } from "@/lib/utils";

const VERCEL_BLOB_HOST = ".public.blob.vercel-storage.com";

/** Width candidates for the cover `srcSet`. Shared between the rendered
 *  `<img>` and the preload link so the browser sees the same option set in
 *  both places. */
export const COVER_SRCSET_WIDTHS = [640, 960, 1200, 1600] as const;

export const vercelImg = (url: string, w: number, q = 75): string =>
  url.includes(VERCEL_BLOB_HOST)
    ? `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`
    : url;

export const vercelSrcSet = (url: string, widths: number[], q = 75): string | undefined =>
  url.includes(VERCEL_BLOB_HOST)
    ? widths.map((w) => `${vercelImg(url, w, q)} ${w}w`).join(", ")
    : undefined;

interface CoverPreloadLink {
  rel: "preload";
  as: "image";
  href: string;
  fetchPriority: "high";
  imageSrcSet?: string;
  imageSizes?: string;
}

/** Returns the `<link rel=preload as=image>` entry for the LCP cover, or `[]`
 *  if the value isn't a URL. `imagesrcset`/`imagesizes` mirror the rendered
 *  `<img>`'s responsive `srcSet`/`sizes` so the browser participates in
 *  variant selection — on small mobile it picks 640w instead of wasting the
 *  preload on the 1200w default and re-fetching the smaller variant. */
export const getCoverPreloadLinks = (
  cover: string | null | undefined,
): ReadonlyArray<CoverPreloadLink> => {
  if (!cover || !isValidUrl(cover)) return [];
  const srcSet = vercelSrcSet(cover, [...COVER_SRCSET_WIDTHS]);
  return [
    {
      rel: "preload",
      as: "image",
      href: vercelImg(cover, 1200),
      fetchPriority: "high",
      ...(srcSet ? { imageSrcSet: srcSet, imageSizes: "100vw" } : {}),
    },
  ];
};
