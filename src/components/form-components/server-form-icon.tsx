// Hook-free RSC icon. Per-icon endpoint /api/icons/{name} (~1 kB, one glyph) not the ~40 kB sprite, so the SSR'd public form fetches just the visible logo. No `.svg` suffix — that URL is intercepted by static-asset handling (404). Editor still uses the bundled sprite (better for many icons per session).
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
      <use href={`/api/icons/${iconName}#${iconName}`} />
    </svg>
  </div>
);
