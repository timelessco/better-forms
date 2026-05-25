/**
 * Reform Popup Embed - Trigger Handlers
 * Handles click events on data-form-id elements and URL hash triggers
 */

import type { EmojiAnimation, PopupOptions } from "./types";

type OpenPopupCallback = (formId: string, options: PopupOptions) => void;

const parseDataAttributes = (element: HTMLElement): PopupOptions => {
  const options: PopupOptions = {};

  const layout = element.dataset.layout;
  if (layout === "modal" || layout === "default") {
    options.layout = layout;
  }

  const position = element.dataset.position;
  if (position === "bottom-right" || position === "bottom-left" || position === "center") {
    options.position = position;
  }

  const width = element.dataset.width;
  if (width) {
    options.width = parseInt(width, 10);
  }

  if (element.dataset.alignLeft === "1") {
    options.alignLeft = true;
  }
  if (element.dataset.hideTitle === "1") {
    options.hideTitle = true;
  }
  if (element.dataset.overlay === "1") {
    options.overlay = true;
  }

  const emojiText = element.dataset.emojiText;
  const emojiAnimation = element.dataset.emojiAnimation as EmojiAnimation | undefined;
  if (emojiText) {
    options.emoji = {
      text: emojiText,
      animation: emojiAnimation || "none",
    };
  }

  const autoClose = element.dataset.autoClose;
  if (autoClose) {
    options.autoClose = parseInt(autoClose, 10);
  }

  const hiddenFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(element.dataset)) {
    if (
      [
        "formId",
        "layout",
        "position",
        "width",
        "alignLeft",
        "hideTitle",
        "overlay",
        "emojiText",
        "emojiAnimation",
        "autoClose",
      ].includes(key)
    ) {
      continue;
    }
    if (value !== undefined) {
      hiddenFields[key] = value;
    }
  }
  if (Object.keys(hiddenFields).length > 0) {
    options.hiddenFields = hiddenFields;
  }

  return options;
};

/**
 * Parse options from URL hash parameters
 * Format: #form-open=formId&align-left=1&hide-title=1&overlay=1&emoji-text=👋&emoji-animation=wave&auto-close=5000
 */
const parseHashParams = (
  hash: string,
): {
  formId: string | null;
  options: PopupOptions;
} => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const formId = params.get("form-open");
  const options: PopupOptions = {};

  const position = params.get("position");
  if (position === "bottom-right" || position === "bottom-left" || position === "center") {
    options.position = position;
  }

  if (params.get("align-left") === "1") {
    options.alignLeft = true;
  }
  if (params.get("hide-title") === "1") {
    options.hideTitle = true;
  }
  if (params.get("overlay") === "1") {
    options.overlay = true;
  }

  const width = params.get("width");
  if (width) {
    options.width = parseInt(width, 10);
  }

  const emojiText = params.get("emoji-text");
  const emojiAnimation = params.get("emoji-animation") as EmojiAnimation | null;
  if (emojiText) {
    options.emoji = {
      text: emojiText,
      animation: emojiAnimation || "none",
    };
  }

  const autoClose = params.get("auto-close");
  if (autoClose) {
    options.autoClose = parseInt(autoClose, 10);
  }

  const hiddenFields: Record<string, string> = {};
  const knownParams = new Set([
    "form-open",
    "position",
    "align-left",
    "hide-title",
    "overlay",
    "width",
    "emoji-text",
    "emoji-animation",
    "auto-close",
  ]);
  params.forEach((value, key) => {
    if (!knownParams.has(key)) {
      hiddenFields[key] = value;
    }
  });
  if (Object.keys(hiddenFields).length > 0) {
    options.hiddenFields = hiddenFields;
  }

  return { formId, options };
};

export const setupClickTriggers = (openPopup: OpenPopupCallback): void => {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const triggerEl = target.closest("[data-form-id]") as HTMLElement | null;
    if (triggerEl) {
      e.preventDefault();
      const formId = triggerEl.dataset.formId;
      if (formId) {
        const options = parseDataAttributes(triggerEl);
        openPopup(formId, options);
      }
      return;
    }

    const linkEl = target.closest("a");
    if (linkEl?.href?.includes("form-open=")) {
      e.preventDefault();
      const hashIndex = linkEl.href.indexOf("#");
      if (hashIndex !== -1) {
        const hash = linkEl.href.substring(hashIndex);
        const { formId, options } = parseHashParams(hash);
        if (formId) {
          openPopup(formId, options);
        }
      }
    }
  });
};

export const checkHashTrigger = (openPopup: OpenPopupCallback): void => {
  const { hash } = window.location;
  if (hash?.includes("form-open=")) {
    const { formId, options } = parseHashParams(hash);
    if (formId) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        openPopup(formId, options);
      }, 100);
    }
  }
};

export const setupHashChangeListener = (openPopup: OpenPopupCallback): void => {
  window.addEventListener("hashchange", () => {
    const { hash } = window.location;
    if (hash?.includes("form-open=")) {
      const { formId, options } = parseHashParams(hash);
      if (formId) {
        openPopup(formId, options);
      }
    }
  });
};
