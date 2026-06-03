// Hook-free RSC icon. Uses per-icon endpoint /api/icons/{name}.svg (~1 kB) not the ~40 kB sprite, so SSR'd public form fetches one glyph. Editor still uses bundled sprite (better for many distinct icons per session).
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
    // Form logo card (Figma 25408:8959): surface circle + soft shadow + foreground glyph,
    // matching the editor's IconPickerPreview useThemeColor branch.
    className="flex items-center justify-center rounded-full bg-card text-foreground shadow-[0px_1px_8px_0px_rgba(0,0,0,0.1)]"
    style={{ width: `${size}px`, height: `${size}px` }}
  >
    <svg height={iconSize} style={{ color: "currentColor" }} viewBox="0 0 18 18" width={iconSize}>
      <use href={`/api/icons/${iconName}.svg#${iconName}`} />
    </svg>
  </div>
);
