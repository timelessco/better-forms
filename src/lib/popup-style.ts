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
  "--bf-title-font-size": "24px",
  "--bf-title-letter-spacing": "-0.72px",
} as CSSProperties;
