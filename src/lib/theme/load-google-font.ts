/**
 * Dynamic Google Fonts loader.
 * Injects <link> tags into document.head on demand, with deduplication.
 */

import { getGoogleFontUrl } from "./font-registry";

const loadedFonts = new Set<string>();

export const loadGoogleFont = (fontName: string): void => {
  if (!fontName || loadedFonts.has(fontName)) return;

  const url = getGoogleFontUrl(fontName);
  if (!url) return;

  const linkId = `gf-${fontName.replace(/\s+/g, "-").toLowerCase()}`;

  if (document.getElementById(linkId)) {
    loadedFonts.add(fontName);
    return;
  }

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
};
