import { clamp } from "@/lib/utils";

// Shared CSS-color normalization. Any CSS color → rgba/hex via the canvas
// `fillStyle` round-trip, with an SSR guard + try/catch fallback so the color
// picker and the style controls share one implementation and one edge-case set.

const round = (n: number) => Math.round(n);

export const parseHex = (raw: string): { r: number; g: number; b: number; a: number } | null => {
  const m = raw.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(m)) return null;
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  if (m.length === 3 || m.length === 4) {
    r = Number.parseInt(m[0] + m[0], 16);
    g = Number.parseInt(m[1] + m[1], 16);
    b = Number.parseInt(m[2] + m[2], 16);
    if (m.length === 4) a = Number.parseInt(m[3] + m[3], 16) / 255;
  } else if (m.length === 6 || m.length === 8) {
    r = Number.parseInt(m.slice(0, 2), 16);
    g = Number.parseInt(m.slice(2, 4), 16);
    b = Number.parseInt(m.slice(4, 6), 16);
    if (m.length === 8) a = Number.parseInt(m.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r, g, b, a };
};

export const cssColorToRgba = (color: string): { r: number; g: number; b: number; a: number } => {
  if (!color) return { r: 0, g: 0, b: 0, a: 1 };
  const direct = parseHex(color);
  if (direct) return direct;
  if (typeof document === "undefined") return { r: 0, g: 0, b: 0, a: 1 };
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return { r: 0, g: 0, b: 0, a: 1 };
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    const out = parseHex(ctx.fillStyle);
    return out ?? { r: 0, g: 0, b: 0, a: 1 };
  } catch {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
};

export const rgbaToHex = (r: number, g: number, b: number, a: number): string => {
  const hex = [r, g, b].map((n) => clamp(round(n), 0, 255).toString(16).padStart(2, "0")).join("");
  if (a >= 0.999) return `#${hex}`;
  const ah = clamp(round(a * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${ah}`;
};

/** Any CSS color (hex, oklch, rgb, etc.) → opaque `#rrggbb` for `<input type="color">`. */
export const cssColorToHex = (color: string): string => {
  const { r, g, b } = cssColorToRgba(color);
  return rgbaToHex(r, g, b, 1);
};
