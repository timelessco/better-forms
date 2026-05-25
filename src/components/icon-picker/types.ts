import type { ReactNode } from "react";

export type IconOption = {
  icon: (color: string, size?: string, className?: string) => ReactNode;
  label: string;
};

export type IconPickerProps = {
  /**
   * Size of the trigger button icon in px
   */
  buttonIconSize?: number;
  /**
   * Current icon color (hex string)
   */
  iconColor: string;
  /**
   * Current icon name (from sprite)
   */
  iconValue: string | null;
  /**
   * Called when the user selects a new color
   */
  onColorChange: (color: string) => void;
  /**
   * Called when the user selects a new icon
   */
  onIconChange: (icon: string) => void;
};

export type IconPickerPreviewProps = {
  /**
   * Icon color (hex) and icon name
   */
  icon: string | null;
  iconColor: string | undefined;
  /**
   * SVG icon size in px
   */
  iconSize?: string;
  /**
   * Outer circle size in px
   */
  size?: string;
  /**
   * When true, uses CSS theme colors (bg-primary / text-primary-foreground)
   * instead of inline iconColor. iconColor is ignored when this is true.
   */
  useThemeColor?: boolean;
  /**
   * When true, renders the icon via the per-icon API endpoint
   * (`/api/icons/<name>#<name>`) instead of the shared sprite. Shipping
   * only the one icon saves ~306 KB on the published form's initial load;
   * the sprite is still used everywhere else (icon picker, form builder).
   */
  standaloneIcon?: boolean;
};
