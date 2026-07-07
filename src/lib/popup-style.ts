import type { CSSProperties } from "react";

// Compact popup form styling (Figma 26883) shared by the editor preview and the live/embed popup so
// both surfaces render identically. The card-mode popup shows no cover banner, so:
//  - cover vars neutralize the "Fit" 32px float + the full-page 100cqw breakout (no-op when no cover);
//  - the title is the compact 24px popup size, not the 48px full-page size.
// These are theme CSS vars, so they cascade to whatever header renders (preview's PreviewFormHeader
// or the live server-rendered header) without touching either component.
export const POPUP_FORM_STYLE_VARS = {
  "--bf-cover-mt": "0px",
  "--bf-cover-w": "100%",
  "--bf-cover-mx": "0px",
  "--bf-cover-x": "0%",
  // Popup cover is a compact, clipped banner (Figma 26889-14091): fixed 134px, no bottom
  // fade/blur dissolve and no ambient glow (those belong to the full-page/embed cover).
  "--bf-cover-height": "134px",
  "--bf-cover-fade": "none",
  "--bf-cover-glow": "none",
  // Cover keeps its top radius (--bf-cover-radius, matching the popup frame) but its BOTTOM corners
  // are flush against the form body — otherwise a full cover radius notches over the fields.
  "--bf-cover-radius-b": "0px",
  "--bf-title-font-size": "24px",
  "--bf-title-letter-spacing": "-0.72px",
} as CSSProperties;
