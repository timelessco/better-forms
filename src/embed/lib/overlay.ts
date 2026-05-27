import type { PopupOptions } from "./types";

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Close popup</title><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

const DEFAULT_WIDTH = 376;

const DEFAULT_MAX_HEIGHT = 600;

interface OverlayElements {
  overlay: HTMLElement;
  popup: HTMLElement;
  iframeContainer: HTMLElement;
  closeBtn: HTMLButtonElement;
  loadingEl: HTMLElement;
  emojiEl?: HTMLElement;
}

export const createOverlay = (
  formId: string,
  options: PopupOptions,
  onClose: () => void,
  meta: { startHidden?: boolean } = {},
): OverlayElements => {
  const isModal = options.layout === "modal" || options.position === "center";
  const showOverlay = options.overlay !== false || isModal;
  const position = options.position || "bottom-right";
  const width = options.width || DEFAULT_WIDTH;

  const overlay = document.createElement("div");
  overlay.className = `bf-overlay ${!showOverlay ? "bf-overlay--no-bg" : ""}`;
  overlay.setAttribute("data-bf-form-id", formId);

  // Pre-mount: in DOM but invisible/non-interactive so iframe loads pre-click. Suppress fade-in too, else it plays (invisibly) at mount and won't animate on reveal.
  if (meta.startHidden) {
    applyHiddenStyles(overlay);
  }

  if (showOverlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        onClose();
      }
    });
  }

  const popup = document.createElement("div");
  popup.className = `bf-popup bf-popup--${isModal ? "center" : position}`;
  Object.assign(popup.style, {
    width: `${width}px`,
    maxHeight: `${DEFAULT_MAX_HEIGHT}px`,
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "bf-close-btn";
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.setAttribute("aria-label", "Close form");
  closeBtn.addEventListener("click", onClose);

  const iframeContainer = document.createElement("div");
  iframeContainer.className = "bf-iframe-container";

  const loadingEl = document.createElement("div");
  loadingEl.className = "bf-loading";
  loadingEl.innerHTML = '<div class="bf-loading-spinner"></div>';

  let emojiEl: HTMLElement | undefined;
  if (options.emoji?.text) {
    emojiEl = document.createElement("div");
    emojiEl.className = `bf-emoji ${getEmojiAnimationClass(options.emoji.animation)}`;
    emojiEl.textContent = options.emoji.text;
  }

  popup.appendChild(closeBtn);
  popup.appendChild(loadingEl);
  popup.appendChild(iframeContainer);
  if (emojiEl) {
    popup.appendChild(emojiEl);
  }

  overlay.appendChild(popup);

  // Lock body scroll while visible; deferred to reveal in startHidden mode.
  if (showOverlay && !meta.startHidden) {
    document.body.style.overflow = "hidden";
  }

  document.body.appendChild(overlay);

  return {
    overlay,
    popup,
    iframeContainer,
    closeBtn,
    loadingEl,
    emojiEl,
  };
};

/** Reveal pre-mounted overlay — undo startHidden styles + scroll lock. Pure style flip; iframe already loaded. */
export const revealOverlay = (overlay: HTMLElement, options: PopupOptions): void => {
  const isModal = options.layout === "modal" || options.position === "center";
  const showOverlay = options.overlay !== false || isModal;

  overlay.style.visibility = "";
  overlay.style.pointerEvents = "";
  overlay.style.animation = "";

  if (showOverlay) {
    document.body.style.overflow = "hidden";
  }
};

const applyHiddenStyles = (el: HTMLElement): void => {
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.animation = "none";
};

/** Hide (not remove) so iframe stays mounted — reopen is a style flip, no refetch. */
export const hideOverlay = (overlay: HTMLElement): void => {
  document.body.style.overflow = "";
  applyHiddenStyles(overlay);
};

export const destroyOverlay = (overlay: HTMLElement): void => {
  document.body.style.overflow = "";

  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.15s ease";

  setTimeout(() => {
    overlay.remove();
  }, 150);
};

/** Update popup height, clamped to min(600, viewport-40) to match updateIframeHeight. Sets height + maxHeight to pin exact size even when content is shorter. */
export const updatePopupHeight = (popup: HTMLElement, height: number): void => {
  const max = Math.min(DEFAULT_MAX_HEIGHT, window.innerHeight - 40);
  const clampedHeight = Math.min(height, max);
  popup.style.height = `${clampedHeight}px`;
  popup.style.maxHeight = `${clampedHeight}px`;
};

export const hideLoading = (loadingEl: HTMLElement): void => {
  loadingEl.style.display = "none";
};

const getEmojiAnimationClass = (animation?: string): string => {
  switch (animation) {
    case "wave":
      return "bf-emoji--wave";
    case "bounce":
      return "bf-emoji--bounce";
    case "pulse":
      return "bf-emoji--pulse";
    default:
      return "";
  }
};

export const hideEmoji = (emojiEl?: HTMLElement): void => {
  if (emojiEl) {
    emojiEl.style.display = "none";
  }
};
