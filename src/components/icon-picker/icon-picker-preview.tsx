import { useResolvedTheme } from "@/components/theme-provider";
import { useEditorTheme } from "@/contexts/editor-theme-context";
import { getThemeStyleVars } from "@/lib/theme/generate-theme-css";
import { DEFAULT_ICON, SPRITE_PATH } from "@/lib/config/app-config";
import { cn, DEFAULT_ICON_NAME, isValidUrl } from "@/lib/utils";
import { BLACK_COLOR, iconMap, WHITE_COLOR } from "./icon-data";
import type { IconPickerPreviewProps } from "./types";

/** Swap white/black in dark mode for visibility. */
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

// Cross-doc `<use>` clones only the symbol's subtree; color via CSS `color` (inherits into `fill="currentColor"`), not `fill` (doesn't inherit across ref).
// Full sprite because static-asset middleware intercepts `Sec-Fetch-Dest: image` before per-icon routes; sprite gzips ~306 KB, cached immutable.
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
  // /api/icons resolves from the full sprite, so curated iconMap (236 names) doesn't gate standalone:
  // sprite-only icons (e.g. star-01, asterisk-01) must still render.
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
  monochrome = false,
  disc = false,
  standaloneIcon = false,
}: IconPickerPreviewProps) => {
  // Dark/light comes from the FORM's resolved mode (customization.mode), not the
  // app theme — a light form must render light icons even inside a dark editor.
  // Falls back to app theme only when the form has no customization (matches the
  // canvas's effectiveTheme). No ref/closest: that finds the app's <html.dark>.
  const appTheme = useResolvedTheme();
  const formMode = useEditorTheme().customization?.mode;
  const isDarkMode = (formMode ?? appTheme) === "dark";

  const matchedIcon = icon ? iconMap.get(icon) : undefined;

  // Sidebar style (Figma 25380:8709): bare glyph in currentColor, no circle. Follows the
  // row's text color (dark in light mode, light in dark mode) so it's always visible.
  // `disc` adds the active-row circle — the gray/0 disc the Figma shows on the selected item.
  if (monochrome) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center",
          disc && "rounded-full bg-sidebar",
        )}
        style={{ width: `${size}px`, height: `${size}px` }}
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

  if (useThemeColor) {
    // Form logo card (Figma 25408:8959): a surface-coloured circle with a soft drop shadow and
    // a foreground glyph — NOT a primary-tinted circle. bg-card/text-foreground theme with the
    // form (white+dark in light, elevated-dark+light in dark). Minimal logo mode strips the
    // bg + shadow via CSS ([data-bf-logo-icon="minimal"]).
    return (
      <div
        className="flex items-center justify-center rounded-full bg-card text-foreground shadow-[0px_1px_8px_0px_rgba(0,0,0,0.1)]"
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

/** Form icon w/ optional theme customization; handles URL images, sprite icons, default-icon sentinel. */
export const ThemedFormIcon = ({
  icon,
  customization,
  iconSize = "10",
  size = "18",
  monochrome = false,
  disc = false,
}: {
  icon?: string | null;
  customization?: Record<string, string> | null;
  iconSize?: string;
  size?: string;
  /** Sidebar form-list style: flat glyph in currentColor, no themed circle. */
  monochrome?: boolean;
  /** With `monochrome`: draw the active-row disc behind the glyph. */
  disc?: boolean;
}) => {
  const resolvedAppTheme = useResolvedTheme();

  // Uploaded image icons stay as a small rounded image in every mode.
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

  if (monochrome) {
    // Figma 25390:13897/13911: constant 18px disc + 12px glyph in EVERY state. The disc is the
    // sidebar surface colour, so it's invisible at rest and only reads as a circle on the
    // active/hover row (whose bg differs). The glyph size never changes between states.
    return (
      <IconPickerPreview
        icon={iconName}
        iconColor={undefined}
        monochrome
        disc={disc}
        iconSize={iconSize}
        size={size}
      />
    );
  }

  const themedCustomization = customization
    ? { ...customization, mode: resolvedAppTheme }
    : customization;
  const themeVars =
    themedCustomization && Object.keys(themedCustomization).length > 0
      ? getThemeStyleVars(themedCustomization)
      : undefined;

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
