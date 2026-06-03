import type { ReactNode } from "react";

export type IconOption = {
  icon: (color: string, size?: string, className?: string) => ReactNode;
  label: string;
};

export type IconPickerProps = {
  /** Trigger button icon size, px. */
  buttonIconSize?: number;
  /** Icon color, hex. */
  iconColor: string;
  /** Icon name from sprite. */
  iconValue: string | null;
  /** Called on color select. */
  onColorChange: (color: string) => void;
  /** Called on icon select. */
  onIconChange: (icon: string) => void;
};

export type IconPickerPreviewProps = {
  /** Icon name. */
  icon: string | null;
  iconColor: string | undefined;
  /** SVG icon size, px. */
  iconSize?: string;
  /** Outer circle size, px. */
  size?: string;
  /** Use CSS theme colors (bg-primary/text-primary-foreground); ignores iconColor. */
  useThemeColor?: boolean;
  /** Flat glyph in `currentColor`, no background circle (sidebar form-list style). */
  monochrome?: boolean;
  /** With `monochrome`: draw a `bg-sidebar` disc behind the glyph (active-row style). */
  disc?: boolean;
  /** Render via per-icon endpoint (`/api/icons/<name>#<name>`) not the sprite; saves ~306 KB on published form load. */
  standaloneIcon?: boolean;
};
