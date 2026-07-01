import { Image } from "@/components/ui/image";
import { isHexColor, isValidUrl, cn } from "@/lib/utils";

// Default cover from Figma (saved locally in /public) — same asset the editor's "Add cover" applies.
const DEFAULT_COVER = "/header-image.png";

// Generated content render (preview) wins over the user's cover, which wins over the default image.
// Returns the image src (preview/cover URL or default) and a solid color for hex covers.
const resolveThumbnail = (cover?: string | null, preview?: string | null) => {
  const previewImage = preview && isValidUrl(preview) ? preview : null;
  if (previewImage) return { coverColor: null, coverImage: previewImage };
  const coverColor = cover && isHexColor(cover) ? cover : null;
  if (coverColor) return { coverColor, coverImage: null };
  // Image-URL cover wins; anything else (unset or unrecognized) falls back to the default cover.
  const coverImage = cover && isValidUrl(cover) ? cover : DEFAULT_COVER;
  return { coverColor: null, coverImage };
};

// One thumbnail image, or a light/dark pair when a dark variant exists (template previews carry both;
// the pair swaps on the `.dark` class so the screenshot matches the app theme — no JS, no flicker).
const ThumbnailImage = ({
  src,
  dark,
  width,
  height,
  sizes,
}: {
  src: string;
  dark: string | null;
  width: number;
  height: number;
  sizes?: string;
}) => {
  if (!dark) {
    return (
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        sizes={sizes}
        className="size-full object-cover"
      />
    );
  }
  return (
    <>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        sizes={sizes}
        className="size-full object-cover dark:hidden"
      />
      <Image
        src={dark}
        alt=""
        width={width}
        height={height}
        sizes={sizes}
        className="hidden size-full object-cover dark:block"
      />
    </>
  );
};

type FormCardThumbnailProps = {
  title: string;
  /** Form cover — image URL or hex color. Falls back to the default cover image when unset. */
  cover?: string | null;
  /** Generated content thumbnail (Plate render). Takes precedence over `cover`. */
  preview?: string | null;
  /** Dark-mode variant of `preview` (template previews only); shown under `.dark`. */
  previewDark?: string | null;
  className?: string;
};

/**
 * Cover banner rendered inside a dashboard card's preview area.
 *
 * Prefers the generated content thumbnail; otherwise shows the form's cover (image URL or solid hex
 * color), falling back to the default cover image so every card reads as a real form thumbnail.
 */
export const FormCardThumbnail = ({
  title,
  cover,
  preview,
  previewDark,
  className,
}: FormCardThumbnailProps) => {
  const { coverColor, coverImage } = resolveThumbnail(cover, preview);
  const displayTitle = title?.trim() || "Untitled";
  const darkImage = previewDark && isValidUrl(previewDark) ? previewDark : null;

  return (
    <div
      className={cn("relative h-[90px] w-full overflow-hidden rounded-[8px] bg-muted", className)}
      style={coverColor ? { backgroundColor: coverColor } : undefined}
      aria-hidden
    >
      {coverImage && (
        <ThumbnailImage
          src={coverImage}
          dark={darkImage}
          width={400}
          height={90}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        />
      )}
      <span className="sr-only">{displayTitle}</span>
    </div>
  );
};

type FormListThumbnailProps = {
  title: string;
  /** Form cover — image URL or hex color. Falls back to the default cover image when unset. */
  cover?: string | null;
  /** Generated content thumbnail (Plate render). Takes precedence over `cover`. */
  preview?: string | null;
  /** Dark-mode variant of `preview` (template previews only); shown under `.dark`. */
  previewDark?: string | null;
  className?: string;
};

/** Compact 36×20 landscape cover thumbnail for the dashboard's table/list rows (Figma 26235:8804). */
export const FormListThumbnail = ({
  title,
  cover,
  preview,
  previewDark,
  className,
}: FormListThumbnailProps) => {
  const { coverColor, coverImage } = resolveThumbnail(cover, preview);
  const darkImage = previewDark && isValidUrl(previewDark) ? previewDark : null;

  return (
    <div
      className={cn(
        "relative h-5 w-9 shrink-0 overflow-hidden rounded-[3px] bg-muted shadow-[0px_0px_0.3px_0px_rgba(0,0,0,0.16),0px_0.4px_1px_0px_rgba(0,0,0,0.14)]",
        className,
      )}
      style={coverColor ? { backgroundColor: coverColor } : undefined}
      aria-hidden
    >
      {/* 36×20 CSS box; sizes matches so 2× displays fetch the 72w variant, not 144w. */}
      {coverImage && (
        <ThumbnailImage src={coverImage} dark={darkImage} width={72} height={40} sizes="36px" />
      )}
      <span className="sr-only">{title?.trim() || "Untitled"}</span>
    </div>
  );
};
