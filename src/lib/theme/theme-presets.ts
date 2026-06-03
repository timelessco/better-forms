/** Theme preset definitions. Colors in hex for uniform color-picker display. */

export interface BaseColorTokens {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  border: string;
  input: string;
}

export type BaseColorMap = Record<string, BaseColorTokens>;

export const BASE_COLORS: BaseColorMap = {
  neutral: {
    background: "#ffffff",
    foreground: "#212121",
    card: "#ffffff",
    "card-foreground": "#212121",
    popover: "#ffffff",
    "popover-foreground": "#2e2e2e",
    muted: "#f5f5f5",
    "muted-foreground": "#7c7c7c",
    accent: "#ededed",
    "accent-foreground": "#2e2e2e",
    border: "#ededed",
    input: "#ffffff",
  },
  zinc: {
    background: "#ffffff",
    foreground: "#09090b",
    card: "#ffffff",
    "card-foreground": "#09090b",
    popover: "#ffffff",
    "popover-foreground": "#09090b",
    muted: "#f4f4f5",
    "muted-foreground": "#71717b",
    accent: "#f4f4f5",
    "accent-foreground": "#18181b",
    border: "#e4e4e7",
    input: "#e4e4e7",
  },
  slate: {
    background: "#ffffff",
    foreground: "#020618",
    card: "#ffffff",
    "card-foreground": "#020618",
    popover: "#ffffff",
    "popover-foreground": "#020618",
    muted: "#f1f5f9",
    "muted-foreground": "#62748e",
    accent: "#f1f5f9",
    "accent-foreground": "#0f172b",
    border: "#e2e8f0",
    input: "#e2e8f0",
  },
  stone: {
    background: "#ffffff",
    foreground: "#0c0a09",
    card: "#ffffff",
    "card-foreground": "#0c0a09",
    popover: "#ffffff",
    "popover-foreground": "#0c0a09",
    muted: "#f5f5f4",
    "muted-foreground": "#79716b",
    accent: "#f5f5f4",
    "accent-foreground": "#1c1917",
    border: "#e7e5e4",
    input: "#e7e5e4",
  },
  gray: {
    background: "#ffffff",
    foreground: "#030712",
    card: "#ffffff",
    "card-foreground": "#030712",
    popover: "#ffffff",
    "popover-foreground": "#030712",
    muted: "#f3f4f6",
    "muted-foreground": "#6a7282",
    accent: "#f3f4f6",
    "accent-foreground": "#101828",
    border: "#e5e7eb",
    input: "#e5e7eb",
  },
};

// Alpha values (border/input) blended against the preset's background.
export const DARK_BASE_COLORS: BaseColorMap = {
  neutral: {
    background: "#131313",
    foreground: "#d1d1d1",
    card: "#292929",
    "card-foreground": "#f8f8f8",
    popover: "#1c1c1c",
    "popover-foreground": "#afafaf",
    muted: "#3d3d3d",
    "muted-foreground": "#a6a6a6",
    accent: "#363636",
    "accent-foreground": "#d1d1d1",
    border: "#363636",
    input: "#1c1c1c",
  },
  zinc: {
    background: "#09090b",
    foreground: "#fafafa",
    card: "#18181b",
    "card-foreground": "#fafafa",
    popover: "#18181b",
    "popover-foreground": "#fafafa",
    muted: "#27272a",
    "muted-foreground": "#9f9fa9",
    accent: "#27272a",
    "accent-foreground": "#fafafa",
    border: "#222223",
    input: "#2e2e30",
  },
  slate: {
    background: "#020618",
    foreground: "#f8fafc",
    card: "#0f172b",
    "card-foreground": "#f8fafc",
    popover: "#0f172b",
    "popover-foreground": "#f8fafc",
    muted: "#1d293d",
    "muted-foreground": "#90a1b9",
    accent: "#1d293d",
    "accent-foreground": "#f8fafc",
    border: "#1b1f2f",
    input: "#282b3b",
  },
  stone: {
    background: "#0c0a09",
    foreground: "#fafaf9",
    card: "#1c1917",
    "card-foreground": "#fafaf9",
    popover: "#1c1917",
    "popover-foreground": "#fafaf9",
    muted: "#292524",
    "muted-foreground": "#a6a09b",
    accent: "#292524",
    "accent-foreground": "#fafaf9",
    border: "#242322",
    input: "#302f2e",
  },
  gray: {
    background: "#030712",
    foreground: "#f9fafb",
    card: "#101828",
    "card-foreground": "#f9fafb",
    popover: "#101828",
    "popover-foreground": "#f9fafb",
    muted: "#1e2939",
    "muted-foreground": "#99a1af",
    accent: "#1e2939",
    "accent-foreground": "#f9fafb",
    border: "#1c202a",
    input: "#292c36",
  },
};

export interface ThemeColorTokens {
  primary: string;
  "primary-foreground": string;
  ring: string;
}

export const THEME_COLORS: Record<string, ThemeColorTokens> = {
  neutral: {
    primary: "#212121",
    "primary-foreground": "#ffffff",
    ring: "#7c7c7c",
  },
  zinc: {
    primary: "#18181b",
    "primary-foreground": "#fafafa",
    ring: "#18181b",
  },
  rose: {
    primary: "#e11d48",
    "primary-foreground": "#fff1f2",
    ring: "#e11d48",
  },
  blue: {
    primary: "#2563eb",
    "primary-foreground": "#eff6ff",
    ring: "#2563eb",
  },
  green: {
    primary: "#16a34a",
    "primary-foreground": "#f0fdf4",
    ring: "#16a34a",
  },
  amber: {
    primary: "#d97706",
    "primary-foreground": "#fffbeb",
    ring: "#d97706",
  },
  orange: {
    primary: "#ea580c",
    "primary-foreground": "#fff7ed",
    ring: "#ea580c",
  },
  violet: {
    primary: "#7c3aed",
    "primary-foreground": "#f5f3ff",
    ring: "#7c3aed",
  },
  emerald: {
    primary: "#059669",
    "primary-foreground": "#ecfdf5",
    ring: "#059669",
  },
  cyan: {
    primary: "#0891b2",
    "primary-foreground": "#ecfeff",
    ring: "#0891b2",
  },
  indigo: {
    primary: "#4f46e5",
    "primary-foreground": "#eef2ff",
    ring: "#4f46e5",
  },
  pink: {
    primary: "#db2777",
    "primary-foreground": "#fdf2f8",
    ring: "#db2777",
  },
  red: { primary: "#dc2626", "primary-foreground": "#fef2f2", ring: "#dc2626" },
};

export const RADIUS_MAP: Record<string, string> = {
  none: "0px",
  small: "0.375rem",
  medium: "0.625rem",
  large: "0.875rem",
};

export { FONT_MAP } from "./font-registry";

export const SPACING_MAP: Record<string, string> = {
  dense: "0.5rem",
  compact: "0.75rem",
  normal: "1rem",
  spacious: "1.25rem",
};

export interface StyleConfig {
  radius: string;
  spacing: string;
  baseColor: string;
  themeColor: string;
  font: string;
}

export const STYLES: Record<string, StyleConfig> = {
  vega: {
    radius: "medium",
    spacing: "normal",
    baseColor: "neutral",
    themeColor: "neutral",
    font: "Inter",
  },
  nova: {
    radius: "small",
    spacing: "compact",
    baseColor: "slate",
    themeColor: "zinc",
    font: "Inter",
  },
  maia: {
    radius: "large",
    spacing: "spacious",
    baseColor: "stone",
    themeColor: "zinc",
    font: "Inter",
  },
  lyra: {
    radius: "none",
    spacing: "normal",
    baseColor: "gray",
    themeColor: "zinc",
    font: "Inter",
  },
  mira: {
    radius: "small",
    spacing: "dense",
    baseColor: "neutral",
    themeColor: "zinc",
    font: "Inter",
  },
};

export const DESTRUCTIVE_TOKENS = {
  destructive: "#ef4444",
  "destructive-foreground": "#fafafa",
} as const;

export const SUCCESS_TOKENS = {
  success: "#16a34a",
  "success-foreground": "#f0fdf4",
} as const;
