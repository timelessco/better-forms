import { Image as UnpicImage } from "@unpic/react";
import type { ImageProps as UnpicImageProps } from "@unpic/react";
import type { ImgHTMLAttributes } from "react";
import { vercelImg, vercelSrcSet } from "@/lib/vercel-image";

type UnpicCdn = UnpicImageProps["cdn"];

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "srcSet"> {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** unpic layout — defaults to `constrained` (responsive up to `width`). Only affects the CDN path. */
  layout?: "fixed" | "constrained" | "fullWidth";
  /** Compression hint forwarded to the transformer (Vercel `q=` or the CDN operation). */
  quality?: number;
  /** Hints the browser to prioritize this image (disables `loading="lazy"`). */
  priority?: boolean;
  /** Override the auto-detected CDN transformer (unpic path only). */
  cdn?: UnpicCdn;
  /** `sizes` for the Vercel-Blob srcSet; defaults to the intrinsic `width` (fixed box). */
  sizes?: string;
  /** Explicit srcSet width ladder for the Vercel-Blob path (e.g. full-width covers). Defaults to
   *  `[width, width*2]` — right for fixed-size thumbnails/avatars. */
  srcSetWidths?: number[];
}

const VERCEL_BLOB_HOST = ".public.blob.vercel-storage.com";
const isVercelBlobUrl = (src: string) => src.includes(VERCEL_BLOB_HOST);

// data:/blob:/same-origin can't be routed through any external transformer — render as-is.
const isLocalSrc = (src: string) =>
  src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/");

export const Image = ({
  src,
  alt,
  width,
  height,
  layout = "constrained",
  quality = 75,
  priority = false,
  cdn,
  sizes,
  srcSetWidths,
  decoding = "async",
  loading,
  ...rest
}: ImageProps) => {
  const resolvedLoading = priority ? "eager" : loading;

  // Vercel Blob (our covers/previews/avatars/icons): optimize via /_vercel/image in PRODUCTION —
  // resizes the biggest images (a 1200px preview into a 90px card, etc). The endpoint 404s under
  // `pnpm dev`, so dev falls back to the raw <img>. unpic can't transform Blob URLs, hence this path.
  if (src && isVercelBlobUrl(src)) {
    if (import.meta.env.PROD) {
      const widths = [...new Set(srcSetWidths ?? [width, width * 2])].filter((w) => w > 0);
      return (
        <img
          src={vercelImg(src, width, quality)}
          srcSet={vercelSrcSet(src, widths, quality)}
          sizes={sizes ?? `${width}px`}
          alt={alt}
          width={width}
          height={height}
          decoding={decoding}
          loading={resolvedLoading}
          fetchPriority={priority ? "high" : undefined}
          {...rest}
        />
      );
    }
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding={decoding}
        loading={resolvedLoading}
        {...rest}
      />
    );
  }

  // data:/blob:/local static asset — plain <img>, nothing to optimize.
  if (!src || isLocalSrc(src)) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding={decoding}
        loading={resolvedLoading}
        {...rest}
      />
    );
  }

  // Known image CDNs (Unsplash, Cloudinary, OAuth avatars, …) — unpic auto-detects and optimizes.
  const props = {
    src,
    alt,
    width,
    height,
    layout,
    priority,
    decoding,
    loading,
    cdn,
    operations: cdn ? { [cdn]: { quality } } : undefined,
    ...rest,
  } as UnpicImageProps;

  return <UnpicImage {...props} />;
};
