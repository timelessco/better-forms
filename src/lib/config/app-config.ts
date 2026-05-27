export const APP_NAME = import.meta.env.VITE_APP_NAME || "Reform";
// Strip trailing slash once so callers can concat paths without `//api/...`
// (VITE_APP_WEBSITE_URL sometimes has one, e.g. preview deploys).
export const APP_WEBSITE_URL = (
  import.meta.env.VITE_APP_WEBSITE_URL || "https://betterforms.com"
).replace(/\/+$/, "");

/** Default icon identifier used throughout the app (forms, pickers, previews) */
export const DEFAULT_ICON = "default-icon";

/** Path to the shared SVG sprite served from /public */
export const SPRITE_PATH = "/sprite.svg";
