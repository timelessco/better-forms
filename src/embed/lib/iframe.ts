import type { PopupOptions } from "./types";

/** Forms base URL — from script src in prod, current origin in local dev. */
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

/** Build iframe URL. Exported so warmup prefetches the exact same URL — any param divergence is a different cache entry. */
export const buildIframeUrl = (formId: string, options: PopupOptions): string => {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams();

  // validateSearch 307-redirects non-canonical URLs; prefetch doesn't follow redirects → cold page. Emit canonical form (all bools, schema order, "true"/"false") so prefetch + click hit the same URL.
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

  // Forward page query params (UTM etc.).
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

/** Update iframe height, clamped to min(600, viewport-40); taller content scrolls inside the iframe. */
export const updateIframeHeight = (iframe: HTMLIFrameElement, height: number): void => {
  const max = Math.min(IFRAME_HEIGHT_MAX, window.innerHeight - IFRAME_VIEWPORT_MARGIN);
  const adjustedHeight = Math.min(height + 2, max);
  iframe.style.height = `${adjustedHeight}px`;
};

export const destroyIframe = (iframe: HTMLIFrameElement): void => {
  iframe.remove();
};
