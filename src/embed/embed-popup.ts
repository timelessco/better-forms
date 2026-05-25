/**
 * Reform Popup Embed Script
 *
 * This script provides the ability to embed Reform as popups on external websites.
 *
 * Usage:
 * 1. Include this script: <script async src="https://yoursite.com/embed/popup.js"></script>
 * 2. Add trigger elements: <button data-form-id="your-form-id">Open Form</button>
 * 3. Or use the JS API: Reform.openPopup('your-form-id', options)
 */

import { setupAutoBubble } from "./lib/bubble";
import { createIframe, destroyIframe, updateIframeHeight } from "./lib/iframe";
import {
  createOverlay,
  destroyOverlay,
  hideEmoji,
  hideLoading,
  hideOverlay,
  revealOverlay,
  updatePopupHeight,
} from "./lib/overlay";
import { injectStyles } from "./lib/styles";
import { checkHashTrigger, setupClickTriggers, setupHashChangeListener } from "./lib/triggers";
import type { IframeEvent, PopupInstance, PopupOptions } from "./lib/types";

// Registry of active popup instances. Instances may be in "hidden" state
// (pre-mounted on hover) — they live here so message handlers and `closePopup`
// treat them uniformly.
const activePopups = new Map<string, PopupInstance>();

const fireOnOpen = (options: PopupOptions): void => {
  if (!options.onOpen) return;
  try {
    options.onOpen();
  } catch (e) {
    console.error("[Reform] onOpen callback error:", e);
  }
};

/**
 * Pre-mount the popup in a hidden state. The iframe loads, React mounts,
 * and the form is ready — all while the user is still hovering. On click,
 * `openPopup` just flips visibility; no spinner, no height jump, no refetch.
 */
export const preMountPopup = (formId: string, options: PopupOptions = {}): void => {
  if (activePopups.has(formId)) return;

  const elements = createOverlay(formId, options, () => closePopup(formId), {
    startHidden: true,
  });
  const iframe = createIframe(formId, options, elements.iframeContainer);

  const instance: PopupInstance = {
    formId,
    options,
    container: elements.popup,
    iframe,
    overlay: elements.overlay,
    loadingEl: elements.loadingEl,
    hidden: true,
  };
  activePopups.set(formId, instance);

  iframe.addEventListener("load", () => {
    hideLoading(elements.loadingEl);
  });
};

/**
 * Open a popup for the given form. If a pre-mounted instance exists (from
 * hover warmup), reveal it instead of building a new one — the iframe is
 * already loaded and the form is already rendered.
 */
export const openPopup = (formId: string, options: PopupOptions = {}): void => {
  const existing = activePopups.get(formId);

  if (existing) {
    if (!existing.hidden) {
      console.warn(`[Reform] Popup for form ${formId} is already open`);
      return;
    }

    // Promote hidden instance. The caller's options (onOpen/onClose/onSubmit)
    // are authoritative now — the pre-mount used bubble-provided defaults
    // without these callbacks.
    existing.options = options;
    existing.hidden = false;
    if (existing.overlay) {
      revealOverlay(existing.overlay, options);
    }
    fireOnOpen(options);
    return;
  }

  const elements = createOverlay(formId, options, () => closePopup(formId));
  const iframe = createIframe(formId, options, elements.iframeContainer);

  const instance: PopupInstance = {
    formId,
    options,
    container: elements.popup,
    iframe,
    overlay: elements.overlay,
    loadingEl: elements.loadingEl,
  };
  activePopups.set(formId, instance);

  iframe.addEventListener("load", () => {
    hideLoading(elements.loadingEl);
  });

  fireOnOpen(options);
};

/**
 * Close the popup for the given form
 */
export const closePopup = (formId: string): void => {
  const instance = activePopups.get(formId);
  if (!instance || instance.hidden) {
    return;
  }

  // Hide instead of destroy: keeps the iframe alive so reopening is a pure
  // style flip. Without this, every close+open cycle re-downloads the form
  // document, CSS, all lazy field chunks, and fonts.
  if (instance.overlay) {
    hideOverlay(instance.overlay);
  }
  instance.hidden = true;

  if (instance.options.onClose) {
    try {
      instance.options.onClose();
    } catch (e) {
      console.error("[Reform] onClose callback error:", e);
    }
  }
};

/**
 * Fully tear down a popup instance — removes the iframe from the DOM and
 * drops it from the registry. Use this for long-lived single-page apps that
 * want to reclaim memory; normal close/reopen flows should use `closePopup`.
 */
export const destroyPopup = (formId: string): void => {
  const instance = activePopups.get(formId);
  if (!instance) {
    return;
  }

  destroyIframe(instance.iframe);
  if (instance.overlay) {
    destroyOverlay(instance.overlay);
  }
  activePopups.delete(formId);
};

const handleMessage = (event: MessageEvent): void => {
  let data: IframeEvent;
  try {
    data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }

  if (!data?.event?.startsWith("Reform.")) {
    return;
  }

  let instance: PopupInstance | undefined;
  for (const popup of activePopups.values()) {
    if (popup.iframe.contentWindow === event.source) {
      instance = popup;
      break;
    }
  }

  if (!instance) {
    return;
  }

  switch (data.event) {
    case "Reform.FormLoaded":
      // Hide spinner as soon as SSR HTML is parsed — the iframe `load` event
      // waits for every CSS/JS chunk, leaving the veil up after the form is
      // already visible.
      if (instance.loadingEl) {
        hideLoading(instance.loadingEl);
      }
      break;

    case "Reform.Resize":
      if (typeof data.height === "number") {
        const next = Math.max(instance.maxContentHeight ?? 0, data.height);
        instance.maxContentHeight = next;
        updateIframeHeight(instance.iframe, next);
        updatePopupHeight(instance.container, next);
      }
      break;

    case "Reform.FormSubmitted":
      if (instance.options.onSubmit) {
        try {
          instance.options.onSubmit(data.payload);
        } catch (e) {
          console.error("[Reform] onSubmit callback error:", e);
        }
      }

      if (instance.options.autoClose && instance.options.autoClose > 0) {
        setTimeout(() => {
          closePopup(instance?.formId);
        }, instance.options.autoClose);
      }

      // TODO: Analytics forwarding (future)
      // Forward to dataLayer/fbq if available
      break;

    case "Reform.PageView":
      if (instance.options.onPageView && "page" in data) {
        try {
          instance.options.onPageView(data.page);
        } catch (e) {
          console.error("[Reform] onPageView callback error:", e);
        }
      }

      if ("page" in data && data.page > 1) {
        const overlayEl = instance.overlay;
        if (overlayEl) {
          const emojiEl = overlayEl.querySelector(".bf-emoji") as HTMLElement | null;
          if (emojiEl) {
            hideEmoji(emojiEl);
          }
        }
      }
      break;

    case "Reform.Close":
      closePopup(instance.formId);
      break;
  }
};

const init = (): void => {
  injectStyles();
  setupClickTriggers(openPopup);
  checkHashTrigger(openPopup);
  setupHashChangeListener(openPopup);
  window.addEventListener("message", handleMessage);
  // If the script tag carries `data-form-id`, mount the floating bubble.
  setupAutoBubble(openPopup, preMountPopup);
};

window.Reform = {
  openPopup,
  closePopup,
  destroyPopup,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
