/** Route Vercel-Blob images through Vercel's image-optimisation endpoint. Pure,
 * server-safe — used by the RSC cover renderer and the public-form `head()`
 * Early-Hints preload of the LCP cover. */
import { isValidUrl } from "@/lib/utils";

const VERCEL_BLOB_HOST = ".public.blob.vercel-storage.com";

/** Cover `srcSet` widths. Shared by rendered `<img>` and preload link so the
 *  browser sees one option set. */
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

/** `<link rel=preload as=image>` for the LCP cover, or `[]` if not a URL.
 *  imagesrcset/imagesizes mirror the `<img>` srcSet/sizes so the browser picks
 *  the right variant (e.g. 640w on mobile, not the 1200w default + refetch). */
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
