import { isHexColor, isValidUrl, cn } from "@/lib/utils";

// Default cover from Figma (saved locally in /public) — same asset the editor's "Add cover" applies.
const DEFAULT_COVER = "/header-image.png";

type FormCardThumbnailProps = {
  title: string;
  /** Form cover — image URL or hex color. Falls back to the default cover image when unset. */
  cover?: string | null;
  className?: string;
};

/**
 * Cover banner rendered inside a dashboard card's preview area.
 *
 * Shows the form's cover (image URL or solid hex color). Forms with no cover fall back to the
 * default cover image so every card reads as a real form thumbnail.
 */
export const FormCardThumbnail = ({ title, cover, className }: FormCardThumbnailProps) => {
  const coverColor = cover && isHexColor(cover) ? cover : null;
  const coverImage =
    !coverColor && cover && isValidUrl(cover) ? cover : !cover ? DEFAULT_COVER : null;
  const displayTitle = title?.trim() || "Untitled";

  return (
    <div
      className={cn("relative h-[90px] w-full overflow-hidden rounded-[8px] bg-muted", className)}
      style={coverColor ? { backgroundColor: coverColor } : undefined}
      aria-hidden
    >
      {coverImage && <img src={coverImage} alt="" className="size-full object-cover" />}
      <span className="sr-only">{displayTitle}</span>
    </div>
  );
};

type FormListThumbnailProps = {
  title: string;
  /** Form cover — image URL or hex color. Falls back to the default cover image when unset. */
  cover?: string | null;
  className?: string;
};

/** Compact 36×20 landscape cover thumbnail for the dashboard's table/list rows (Figma 26235:8804). */
export const FormListThumbnail = ({ title, cover, className }: FormListThumbnailProps) => {
  const coverColor = cover && isHexColor(cover) ? cover : null;
  const coverImage =
    !coverColor && cover && isValidUrl(cover) ? cover : !cover ? DEFAULT_COVER : null;

  return (
    <div
      className={cn(
        "relative h-5 w-9 shrink-0 overflow-hidden rounded-[3px] bg-muted shadow-[0px_0px_0.3px_0px_rgba(0,0,0,0.16),0px_0.4px_1px_0px_rgba(0,0,0,0.14)]",
        className,
      )}
      style={coverColor ? { backgroundColor: coverColor } : undefined}
      aria-hidden
    >
      {coverImage && <img src={coverImage} alt="" className="size-full object-cover" />}
      <span className="sr-only">{title?.trim() || "Untitled"}</span>
    </div>
  );
};
