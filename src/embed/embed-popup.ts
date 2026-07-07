/**
 * Reform Popup Embed Script — embeds Reform as popups on external sites.
 * Usage:
 * 1. <script async src="https://yoursite.com/embed/popup.js"></script>
 * 2. <button data-form-id="your-form-id">Open Form</button>
 * 3. or JS API: Reform.openPopup('your-form-id', options)
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

// Active popups, incl. "hidden" (hover pre-mounted) — handlers + closePopup treat all uniformly.
const activePopups = new Map<string, PopupInstance>();

const fireOnOpen = (options: PopupOptions): void => {
  if (!options.onOpen) return;
  try {
    options.onOpen();
  } catch (e) {
    console.error("[Reform] onOpen callback error:", e);
  }
};

/** Pre-mount popup hidden — iframe loads + React mounts during hover. Click just flips visibility; no spinner/height-jump/refetch. */
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

/** Open popup. If a hover-warmup instance exists, reveal it instead of rebuilding (iframe already loaded). */
export const openPopup = (formId: string, options: PopupOptions = {}): void => {
  const existing = activePopups.get(formId);

  if (existing) {
    if (!existing.hidden) {
      console.warn(`[Reform] Popup for form ${formId} is already open`);
      return;
    }

    // Promote hidden instance; caller options now authoritative (pre-mount lacked these callbacks).
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

export const closePopup = (formId: string): void => {
  const instance = activePopups.get(formId);
  if (!instance || instance.hidden) {
    return;
  }

  // Hide, don't destroy — keeps iframe alive so reopen is a style flip, not a full re-download.
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

/** Tear down popup — removes iframe + drops from registry. For long-lived SPAs reclaiming memory; normal flows use closePopup. */
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
      // Hide spinner on SSR-HTML parse — iframe `load` waits for all chunks, leaving veil up after form is visible.
      if (instance.loadingEl) {
        hideLoading(instance.loadingEl);
      }
      // Match the popup frame radius to the form's cover radius (else the fixed 12px frame corners
      // clip a larger cover radius, leaving a sliver).
      if (data.frameRadius) {
        instance.container.style.borderRadius = data.frameRadius;
        const iframeContainer = instance.iframe.parentElement;
        if (iframeContainer) iframeContainer.style.borderRadius = data.frameRadius;
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
