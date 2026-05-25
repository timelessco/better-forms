export const APP_NAME = import.meta.env.VITE_APP_NAME || "Reform";
// Trailing slash stripped at the source so callers can safely concat paths
// without producing `//api/...`. `VITE_APP_WEBSITE_URL` is sometimes set with
// a trailing slash (e.g. preview deploys), so normalize once here.
export const APP_WEBSITE_URL = (
  import.meta.env.VITE_APP_WEBSITE_URL || "https://betterforms.com"
).replace(/\/+$/, "");

/** Default icon identifier used throughout the app (forms, pickers, previews) */
export const DEFAULT_ICON = "default-icon";

/** Path to the shared SVG sprite served from /public */
export const SPRITE_PATH = "/sprite.svg";
