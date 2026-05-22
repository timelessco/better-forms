import { useRef } from "react";

import { useResolvedTheme } from "@/components/theme-provider";
import { getThemeStyleVars } from "@/lib/theme/generate-theme-css";
import { DEFAULT_ICON, SPRITE_PATH } from "@/lib/config/app-config";
import { cn, DEFAULT_ICON_NAME, isValidUrl } from "@/lib/utils";
import { BLACK_COLOR, iconMap, WHITE_COLOR } from "./icon-data";
import type { IconPickerPreviewProps } from "./types";

/**
 * Swap white/black in dark mode for visibility
 */
const getAdjustedColor = (color: string | undefined, isDarkMode: boolean) => {
  if (!isDarkMode || !color) {
    return color;
  }

  if (color === WHITE_COLOR) {
    return BLACK_COLOR;
  }

  if (color === BLACK_COLOR) {
    return WHITE_COLOR;
  }

  return color;
};

// Cross-document `<use>` only clones the symbol's own subtree, so color is
// driven via CSS `color` (inheritable into the referenced `fill="currentColor"`)
// rather than the `fill` attribute (not inheritable across the reference).
// References the full sprite because the framework's static-asset middleware
// intercepts `Sec-Fetch-Dest: image` requests before route handlers can serve
// a per-icon endpoint; the sprite gzips to ~306 KB and is cached as immutable.
const StandaloneIcon = ({ name, color, size }: { name: string; color: string; size: string }) => (
  <svg height={size} style={{ color }} viewBox="0 0 18 18" width={size}>
    <use href={`${SPRITE_PATH}#${name}`} />
  </svg>
);

type RenderedIconProps = {
  color: string;
  icon: string | null;
  iconSize: string;
  matchedIcon: ReturnType<typeof iconMap.get>;
  standaloneIcon: boolean;
};

const RenderedIcon = ({
  color,
  icon,
  iconSize,
  matchedIcon,
  standaloneIcon,
}: RenderedIconProps) => {
  // The /api/icons route resolves names directly from the full sprite, so the
  // curated iconMap (236 names) doesn't gate the standalone path — picking an
  // icon that's in the sprite but not in iconMap (e.g. star-01, asterisk-01)
  // must still render.
  if (standaloneIcon && icon) {
    return <StandaloneIcon name={icon} color={color} size={iconSize} />;
  }
  return <>{matchedIcon?.icon(color, iconSize)}</>;
};

export const IconPickerPreview = ({
  icon,
  iconColor,
  iconSize = "10",
  size = "14",
  useThemeColor = false,
  standaloneIcon = false,
}: IconPickerPreviewProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isDarkMode = ref.current?.closest(".dark") != null;

  const matchedIcon = icon ? iconMap.get(icon) : undefined;

  if (useThemeColor) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded-full bg-primary text-primary-foreground"
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        <RenderedIcon
          color="currentColor"
          icon={icon}
          iconSize={iconSize}
          matchedIcon={matchedIcon}
          standaloneIcon={standaloneIcon}
        />
      </div>
    );
  }

  const adjustedBgColor = getAdjustedColor(iconColor, isDarkMode);
  const fillColor = adjustedBgColor === WHITE_COLOR ? BLACK_COLOR : WHITE_COLOR;

  return (
    <div
      ref={ref}
      className="flex items-center justify-center rounded-full"
      style={{
        backgroundColor: adjustedBgColor,
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <RenderedIcon
        color={fillColor}
        icon={icon}
        iconSize={iconSize}
        matchedIcon={matchedIcon}
        standaloneIcon={standaloneIcon}
      />
    </div>
  );
};

/**
 * Renders a form icon with optional theme customization.
 * Handles URL images, sprite icons, and the default-icon sentinel.
 */
export const ThemedFormIcon = ({
  icon,
  customization,
  iconSize = "10",
  size = "18",
}: {
  icon?: string | null;
  customization?: Record<string, string> | null;
  iconSize?: string;
  size?: string;
}) => {
  const resolvedAppTheme = useResolvedTheme();
  const themedCustomization = customization
    ? { ...customization, mode: resolvedAppTheme }
    : customization;
  const themeVars =
    themedCustomization && Object.keys(themedCustomization).length > 0
      ? getThemeStyleVars(themedCustomization)
      : undefined;

  if (icon && isValidUrl(icon)) {
    return (
      <img
        src={icon}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  const iconName = icon && icon !== DEFAULT_ICON ? icon : DEFAULT_ICON_NAME;

  return (
    <div
      style={themeVars}
      className={cn(themeVars && "bf-themed", themeVars && resolvedAppTheme === "dark" && "dark")}
    >
      <IconPickerPreview
        icon={iconName}
        iconColor={undefined}
        useThemeColor
        iconSize={iconSize}
        size={size}
      />
    </div>
  );
};
