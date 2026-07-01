// Minimal color math for deriving readable contrast tokens from the Customize colors. Hex-only —
// the 7 Customize colors and the presets are all hex; a non-hex value returns null so callers skip
// derivation and fall back to existing tokens. Kept dependency-free (runs in SSR + the theme engine).

type RGB = { r: number; g: number; b: number };

const parseHex = (hex: string): RGB | null => {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/(.)/g, "$1$1") : m[1];
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
};

const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

const toHex = ({ r, g, b }: RGB): string =>
  `#${[r, g, b].map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")}`;

// WCAG relative luminance (sRGB).
const luminance = ({ r, g, b }: RGB): number => {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

const NEAR_BLACK: RGB = { r: 23, g: 23, b: 23 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

// Whichever of near-black / white has the higher WCAG contrast ratio against `bg`.
const pickInk = (bg: RGB): RGB => {
  const l = luminance(bg);
  const contrastWhite = (1 + 0.05) / (l + 0.05);
  const contrastBlack = (l + 0.05) / (luminance(NEAR_BLACK) + 0.05);
  return contrastBlack >= contrastWhite ? NEAR_BLACK : WHITE;
};

// Linear blend a→b by t (0..1).
const mix = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/**
 * Contrast tokens derived from the resolved theme tokens (needs a hex `input`):
 * - --bf-input-foreground: readable ink for the input bg (also used by placeholders @ 50%).
 * - --bf-badge / --bf-badge-foreground: a chip surface lifted off the input + its auto-contrast ink.
 * Returns {} when `input` isn't a parseable hex, so consumers keep their fallbacks.
 */
export const deriveContrastTokens = (tokens: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {};

  const input = tokens.input ? parseHex(tokens.input) : null;
  if (input) {
    const ink = pickInk(input);
    const badge = mix(input, ink, 0.15);
    // Badge text is the auto-contrast ink dimmed 50% toward the badge = a muted "placeholder" tone
    // (matches the placeholder feel) rather than a stark full-contrast letter.
    const badgeInk = mix(pickInk(badge), badge, 0.5);
    out["--bf-input-foreground"] = toHex(ink);
    out["--bf-badge"] = toHex(badge);
    out["--bf-badge-foreground"] = toHex(badgeInk);
  }

  // Button label auto-contrasts with the Buttons color (--bf-primary), same idea as the input ink.
  const primary = tokens.primary ? parseHex(tokens.primary) : null;
  if (primary) out["--bf-button-foreground"] = toHex(pickInk(primary));

  return out;
};
