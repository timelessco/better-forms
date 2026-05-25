import { Image as UnpicImage } from "@unpic/react";
import type { ImageProps as UnpicImageProps } from "@unpic/react";
import type { ImgHTMLAttributes } from "react";

type UnpicCdn = UnpicImageProps["cdn"];

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "srcSet"> {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** unpic layout — defaults to `constrained` (responsive up to `width`). */
  layout?: "fixed" | "constrained" | "fullWidth";
  /** Compression hint forwarded to the CDN transformer. */
  quality?: number;
  /** Hints the browser to prioritize this image (disables `loading="lazy"`). */
  priority?: boolean;
  /** Override the auto-detected CDN transformer. */
  cdn?: UnpicCdn;
}

const isVercelBlobUrl = (src: string) => src.includes(".public.blob.vercel-storage.com");

// data:/blob:/same-origin sources can't be optimized by an external CDN.
// Vercel Blob URLs are served as-is — the only transformer for them is the
// `/_vercel/image` endpoint, which 404s in local dev and saves little for the
// small thumbnails we render. Treat them as opaque so we render plain <img>.
const isOpaqueSrc = (src: string) =>
  src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/") || isVercelBlobUrl(src);

const buildOperations = (cdn: UnpicCdn | undefined, quality: number) => {
  if (!cdn) return;
  return { [cdn]: { quality } };
};

export const Image = ({
  src,
  alt,
  width,
  height,
  layout = "constrained",
  quality = 75,
  priority = false,
  cdn,
  decoding = "async",
  loading,
  ...rest
}: ImageProps) => {
  if (!src || isOpaqueSrc(src)) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        decoding={decoding}
        loading={priority ? "eager" : loading}
        {...rest}
      />
    );
  }

  const resolvedCdn = cdn; // unpic auto-detects known CDNs (Unsplash, Cloudinary, …) when undefined

  // Cast narrows unpic's discriminated-union props to the layout variant chosen
  // at the call site; `width`/`height` are required at the wrapper's type.
  const props = {
    src,
    alt,
    width,
    height,
    layout,
    priority,
    decoding,
    loading,
    cdn: resolvedCdn,
    operations: buildOperations(resolvedCdn, quality),
    ...rest,
  } as UnpicImageProps;

  return <UnpicImage {...props} />;
};
