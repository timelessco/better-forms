// Hook-free icon for RSC composite rendering. References the per-icon API
// endpoint (`/api/icons/{name}.svg`) instead of the full sprite so the SSR'd
// public form fetches ~1 kB for the single visible logo glyph rather than the
// full ~40 kB sprite. The /api/icons route extracts one symbol from sprite.svg
// and caches it; client-side icon usage in the editor still hits the bundled
// sprite (better when many distinct icons are rendered in one session).
export const ServerFormIcon = ({
  iconName,
  iconSize = "48",
  size = "100",
}: {
  iconName: string;
  iconSize?: string;
  size?: string;
}) => (
  <div
    className="flex items-center justify-center rounded-full bg-primary text-primary-foreground"
    style={{ width: `${size}px`, height: `${size}px` }}
  >
    <svg height={iconSize} style={{ color: "currentColor" }} viewBox="0 0 18 18" width={iconSize}>
      <use href={`/api/icons/${iconName}.svg#${iconName}`} />
    </svg>
  </div>
);
