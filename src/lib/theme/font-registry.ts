/**
 * Unified font registry for self-hosted and Google Fonts.
 * Google Fonts are loaded dynamically at runtime — zero bundle cost.
 */

export interface FontEntry {
  cssValue: string;
  googleFamily?: string;
  weights?: string;
  category: "sans-serif" | "serif" | "monospace" | "display";
}

export const FONT_REGISTRY: Record<string, FontEntry> = {
  Inter: {
    cssValue: '"Inter-V", sans-serif',
    category: "sans-serif",
  },
  "Timeless Serif": {
    cssValue: '"Timeless Serif", ui-serif, Georgia, serif',
    category: "serif",
  },
  "Timeless Sans": {
    cssValue: '"Timeless Sans", sans-serif',
    category: "sans-serif",
  },

  Roboto: {
    cssValue: '"Roboto", sans-serif',
    googleFamily: "Roboto",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  "Open Sans": {
    cssValue: '"Open Sans", sans-serif',
    googleFamily: "Open+Sans",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  Lato: {
    cssValue: '"Lato", sans-serif',
    googleFamily: "Lato",
    weights: "400;700",
    category: "sans-serif",
  },
  Montserrat: {
    cssValue: '"Montserrat", sans-serif',
    googleFamily: "Montserrat",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  Poppins: {
    cssValue: '"Poppins", sans-serif',
    googleFamily: "Poppins",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  Raleway: {
    cssValue: '"Raleway", sans-serif',
    googleFamily: "Raleway",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  Nunito: {
    cssValue: '"Nunito", sans-serif',
    googleFamily: "Nunito",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  "DM Sans": {
    cssValue: '"DM Sans", sans-serif',
    googleFamily: "DM+Sans",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  "Work Sans": {
    cssValue: '"Work Sans", sans-serif',
    googleFamily: "Work+Sans",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  Outfit: {
    cssValue: '"Outfit", sans-serif',
    googleFamily: "Outfit",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  "Space Grotesk": {
    cssValue: '"Space Grotesk", sans-serif',
    googleFamily: "Space+Grotesk",
    weights: "400;500;600;700",
    category: "sans-serif",
  },
  "Source Sans 3": {
    cssValue: '"Source Sans 3", sans-serif',
    googleFamily: "Source+Sans+3",
    weights: "400;500;600;700",
    category: "sans-serif",
  },

  "Playfair Display": {
    cssValue: '"Playfair Display", serif',
    googleFamily: "Playfair+Display",
    weights: "400;500;600;700",
    category: "serif",
  },
  Merriweather: {
    cssValue: '"Merriweather", serif',
    googleFamily: "Merriweather",
    weights: "400;700",
    category: "serif",
  },
  "DM Serif Display": {
    cssValue: '"DM Serif Display", serif',
    googleFamily: "DM+Serif+Display",
    weights: "400",
    category: "serif",
  },
  "Crimson Text": {
    cssValue: '"Crimson Text", serif',
    googleFamily: "Crimson+Text",
    weights: "400;600;700",
    category: "serif",
  },
  "Libre Baskerville": {
    cssValue: '"Libre Baskerville", serif',
    googleFamily: "Libre+Baskerville",
    weights: "400;700",
    category: "serif",
  },
  Lora: {
    cssValue: '"Lora", serif',
    googleFamily: "Lora",
    weights: "400;500;600;700",
    category: "serif",
  },

  "JetBrains Mono": {
    cssValue: '"JetBrains Mono", monospace',
    googleFamily: "JetBrains+Mono",
    weights: "400;500;600;700",
    category: "monospace",
  },
  "Fira Code": {
    cssValue: '"Fira Code", monospace',
    googleFamily: "Fira+Code",
    weights: "400;500;600;700",
    category: "monospace",
  },
};

export const FONT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FONT_REGISTRY).map(([name, entry]) => [name, entry.cssValue]),
);

/**
 * Returns the Google Fonts CSS API URL for a font name, or null if self-hosted.
 */
export const getGoogleFontUrl = (fontName: string): string | null => {
  const entry = FONT_REGISTRY[fontName];
  if (!entry?.googleFamily) return null;
  return `https://fonts.googleapis.com/css2?family=${entry.googleFamily}:wght@${entry.weights}&display=swap`;
};
