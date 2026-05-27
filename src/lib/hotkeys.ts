import type { Hotkey } from "@tanstack/react-hotkeys";
import { formatForDisplay } from "@tanstack/react-hotkeys";

// All app-level hotkey definitions (single source of truth)
export const HOTKEYS = {
  // Global
  TOGGLE_SIDEBAR: "Mod+B",
  TOGGLE_COMMAND_PALETTE: "Mod+K",
  TOGGLE_THEME: "M",
  // Form builder — scoped
  TOGGLE_SETTINGS_SIDEBAR: "Mod+Alt+,",
  TOGGLE_CUSTOMIZE_SIDEBAR: "Mod+Shift+C",
  TOGGLE_VERSION_HISTORY: "Mod+Shift+V",
  TOGGLE_FAVORITE: "Mod+D",
  PUBLISH_FORM: "Mod+Shift+P",
  EDIT_FORM: "Mod+E",
  TOGGLE_PREVIEW: "Mod+Shift+E",
  TOGGLE_SHARE_SIDEBAR: "Mod+Shift+S",
  DISMISS_SIDEBARS: "Mod+.",
  // Dashboard — scoped
  DASHBOARD_SELECT_ALL: "Mod+A",
  // Mac laptops emit Backspace for "Delete"; full keyboards emit Delete. Call
  // sites bind both; this is the primary shown in tooltips/labels.
  DASHBOARD_DELETE: "Backspace",
  DASHBOARD_CLEAR_SELECTION: "Escape",
  // Submissions page — scoped
  SUBMISSIONS_SELECT_ALL: "Mod+A",
  SUBMISSIONS_EXPORT: "Mod+E",
  SUBMISSIONS_DELETE: "Backspace",
  SUBMISSIONS_CLEAR_SELECTION: "Escape",
} as const satisfies Record<string, Hotkey>;

export { formatForDisplay };
