import { SPRITE_PATH } from "@/lib/config/app-config";

// Hook-free sprite icon for RSC composite rendering.
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
      <use href={`${SPRITE_PATH}#${iconName}`} />
    </svg>
  </div>
);
