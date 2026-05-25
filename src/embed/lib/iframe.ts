/**
 * Reform Popup Embed - Iframe Management
 */

import type { PopupOptions } from "./types";

/**
 * Get the base URL for forms.
 * In production, this comes from the script's src attribute.
 * Falls back to current origin for local development.
 */
const getBaseUrl = (): string => {
  const scripts = document.getElementsByTagName("script");
  for (let i = scripts.length - 1; i >= 0; i--) {
    const src = scripts[i].src;
    if (src?.includes("/embed/popup.js")) {
      try {
        const url = new URL(src);
        return url.origin;
      } catch {
        // Fall through to default
      }
    }
  }

  return window.location.origin;
};

/**
 * Build the iframe URL with query parameters.
 * Exported so the bubble's warmup can prefetch the exact same URL — any
 * parameter divergence causes the browser to treat it as a different
 * resource and skip the prefetched cache entry.
 */
export const buildIframeUrl = (formId: string, options: PopupOptions): string => {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();

  // The /forms/$formId route's validateSearch normalizes booleans to
  // "true"/"false" and fills every optional bool with its default, then
  // 307-redirects non-canonical URLs. Prefetch (<link rel="prefetch">) does
  // NOT follow redirects, so a mismatched URL warms nothing and the click
  // lands on a cold page. Emit the canonical form here — all bool params,
  // in schema order, as "true"/"false" — so hover-prefetch and click hit
  // the exact same cacheable URL.
  params.set("popup", "true");
  params.set("originPage", window.location.pathname);
  params.set("transparent", "true");
  params.set("transparentBackground", "false");
  params.set("hideTitle", options.hideTitle ? "true" : "false");
  params.set("alignLeft", options.alignLeft ? "true" : "false");
  params.set("dynamicHeight", "false");
  params.set("dynamicWidth", "false");

  if (options.hiddenFields) {
    for (const [key, value] of Object.entries(options.hiddenFields)) {
      params.set(key, value);
    }
  }

  // Forward current page's query params (useful for UTM tracking, etc.)
  const currentParams = new URLSearchParams(window.location.search);
  currentParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return `${baseUrl}/forms/${formId}?${params.toString()}`;
};

export const createIframe = (
  formId: string,
  options: PopupOptions,
  container: HTMLElement,
): HTMLIFrameElement => {
  const iframe = document.createElement("iframe");
  iframe.className = "bf-iframe";
  iframe.setAttribute("title", "Reform");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allow", "fullscreen");
  iframe.setAttribute("data-bf-form-id", formId);

  iframe.style.height = "400px";

  const url = buildIframeUrl(formId, options);
  iframe.src = url;

  container.appendChild(iframe);

  return iframe;
};

/** Hard cap on popup height — matches the original bubble-mode clamp. */
const IFRAME_HEIGHT_MAX = 600;
/** Leave margin top+bottom so the popup never touches the viewport edges. */
const IFRAME_VIEWPORT_MARGIN = 40;

/**
 * Update iframe height. Clamps to min(600, viewport - 40) so the iframe
 * never overflows the popup container. If the form content is taller than
 * the clamp, the iframe's own page scroll handles overflow.
 */
export const updateIframeHeight = (iframe: HTMLIFrameElement, height: number): void => {
  const max = Math.min(IFRAME_HEIGHT_MAX, window.innerHeight - IFRAME_VIEWPORT_MARGIN);
  const adjustedHeight = Math.min(height + 2, max);
  iframe.style.height = `${adjustedHeight}px`;
};

export const destroyIframe = (iframe: HTMLIFrameElement): void => {
  iframe.remove();
};
