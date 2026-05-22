// Auto-bubble: when the popup.js script tag has `data-form-id`, mount a
// floating bubble button that opens the popup on click. Config lives on the
// script tag's data-* attributes.

import type { PopupOptions, PopupPosition } from "./types";
import { preconnectOrigin, warmupFormOnIntent } from "./warmup";

type PopupCallback = (formId: string, options: PopupOptions) => void;

/** data-form-id holds the Form Short ID (7-char base62) — guards against path traversal. */
const FORM_ID_RE = /^[A-Za-z0-9]{7}$/;

/** data-* attributes read as config rather than treated as hidden fields. */
const KNOWN_CONFIG_KEYS = new Set([
  "formId",
  "position",
  "width",
  "darkOverlay",
  "overlay",
  "hideTitle",
  "alignLeft",
  "autoClose",
]);

/** Single emoji (~2 codepoints with VS16/skin tones), no letters/digits. */
const EMOJI_RE = /^(?:\p{Extended_Pictographic}\uFE0F?){1,3}$/u;

interface BubbleConfig {
  formId: string;
  position: PopupPosition;
  width: number;
  darkOverlay: boolean;
  hideTitle: boolean;
  alignLeft: boolean;
  autoClose: number;
  hiddenFields: Record<string, string>;
}

interface FormMeta {
  title?: string;
  icon?: string;
}

/**
 * Find the popup.js script tag in the DOM. Walks backward so re-injected
 * copies win — the most recent script tag controls the bubble.
 */
const findScriptTag = (): HTMLScriptElement | null => {
  const scripts = document.getElementsByTagName("script");
  for (let i = scripts.length - 1; i >= 0; i--) {
    const src = scripts[i].src || "";
    if (src.includes("/embed/popup.js")) return scripts[i];
  }
  return null;
};

const getOriginFromScript = (scriptTag: HTMLScriptElement | null): string => {
  if (scriptTag?.src) {
    try {
      return new URL(scriptTag.src).origin;
    } catch {
      // fall through
    }
  }
  return window.location.origin;
};

const parseConfig = (el: HTMLScriptElement): BubbleConfig | null => {
  const ds = el.dataset || {};
  const formId = ds.formId && FORM_ID_RE.test(ds.formId) ? ds.formId : "";
  if (!formId) return null;

  // Object.create(null) avoids prototype-pollution surface for unknown keys.
  const hiddenFields: Record<string, string> = Object.create(null);
  for (const [k, v] of Object.entries(ds)) {
    if (!KNOWN_CONFIG_KEYS.has(k) && typeof v === "string") {
      hiddenFields[k] = v;
    }
  }

  const pos = ds.position;
  const position: PopupPosition = pos === "bottom-left" || pos === "center" ? pos : "bottom-right";

  return {
    formId,
    position,
    width: ds.width ? parseInt(ds.width, 10) : 376,
    darkOverlay: ds.darkOverlay === "1" || ds.overlay === "1",
    hideTitle: ds.hideTitle === "1",
    alignLeft: ds.alignLeft === "1",
    autoClose: ds.autoClose ? parseInt(ds.autoClose, 10) : 0,
    hiddenFields,
  };
};

const fetchMeta = async (origin: string, formId: string): Promise<FormMeta | null> => {
  try {
    const res = await fetch(`${origin}/api/forms/${encodeURIComponent(formId)}/meta`, {
      method: "GET",
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as FormMeta;
  } catch {
    return null;
  }
};

/**
 * Set the visual content of the bubble button:
 * - URL → <img>
 * - Emoji codepoints → <span> (large emoji)
 * - Sprite name → fetch SVG, inline so currentColor resolves
 * - Fallback → default sprite icon
 */
const SVG_NS = "http://www.w3.org/2000/svg";

// Inline default "document" glyph so pages without a custom icon don't hit
// /api/icons on every page load.
const buildDefaultIcon = (): SVGElement => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "bf-bubble__icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const body = document.createElementNS(SVG_NS, "path");
  body.setAttribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
  svg.appendChild(body);

  const fold = document.createElementNS(SVG_NS, "polyline");
  fold.setAttribute("points", "14 2 14 8 20 8");
  svg.appendChild(fold);

  return svg;
};

const replaceBubbleContent = (btn: HTMLButtonElement, child: Node): void => {
  while (btn.firstChild) btn.removeChild(btn.firstChild);
  btn.appendChild(child);
};

const setBubbleContent = (
  btn: HTMLButtonElement,
  origin: string,
  icon: string | undefined,
): void => {
  if (icon && /^(https?:\/\/|\/)/.test(icon)) {
    const img = document.createElement("img");
    img.className = "bf-bubble__icon";
    img.src = icon;
    img.alt = "";
    replaceBubbleContent(btn, img);
    return;
  }

  if (icon && EMOJI_RE.test(icon)) {
    const span = document.createElement("span");
    span.className = "bf-bubble__emoji";
    span.textContent = icon;
    replaceBubbleContent(btn, span);
    return;
  }

  const isSprite = icon && /^[a-z0-9-]+$/i.test(icon);
  if (!isSprite) {
    replaceBubbleContent(btn, buildDefaultIcon());
    return;
  }

  replaceBubbleContent(btn, buildDefaultIcon());
  fetch(`${origin}/api/icons/${icon}`)
    .then((r) => (r.ok ? r.text() : null))
    .then((text) => {
      if (!text) return;
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const svgEl = doc.documentElement;
      if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") return;
      svgEl.setAttribute("class", "bf-bubble__icon");
      replaceBubbleContent(btn, document.importNode(svgEl, true));
    })
    .catch(() => {
      // already showing default icon — nothing to do
    });
};

const createBubble = (
  cfg: BubbleConfig,
  meta: FormMeta | null,
  origin: string,
): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `bf-bubble bf-bubble--${cfg.position}`;
  btn.setAttribute("aria-label", meta?.title || "Open form");
  setBubbleContent(btn, origin, meta?.icon);
  document.body.appendChild(btn);
  return btn;
};

/**
 * Read script-tag config and mount a floating bubble.
 * Returns early (no bubble) if the script lacks `data-form-id` or the id is
 * invalid — preserves the current no-bubble behavior for pages that only use
 * the `[data-form-id]`-element click trigger or the `Reform.openPopup()` API.
 */
export const setupAutoBubble = (openPopup: PopupCallback, preMountPopup: PopupCallback): void => {
  const scriptTag = findScriptTag();
  if (!scriptTag) return;

  const cfg = parseConfig(scriptTag);
  if (!cfg) return;

  const origin = getOriginFromScript(scriptTag);

  // Open the TCP+TLS connection to the form origin eagerly so the iframe
  // request on click doesn't wait on handshake RTTs.
  preconnectOrigin(origin);

  // Mount immediately with default icon; upgrade once meta arrives so the
  // bubble never waits on the network to appear.
  const bubble = createBubble(cfg, null, origin);

  // On first hover/focus/touch, pre-mount the real popup hidden. The iframe
  // loads, React mounts, and the form is ready in the background — clicking
  // later just reveals it. Prefetching alone didn't work because the iframe
  // loads subresources with different credentials mode than <link rel="prefetch">,
  // so the browser treated them as distinct cache entries and refetched on click.
  const popupOptions: PopupOptions = {
    position: cfg.position,
    width: cfg.width,
    hideTitle: cfg.hideTitle,
    alignLeft: cfg.alignLeft,
    overlay: cfg.darkOverlay,
    autoClose: cfg.autoClose,
    hiddenFields: cfg.hiddenFields,
  };
  warmupFormOnIntent(bubble, () => preMountPopup(cfg.formId, popupOptions));
  void fetchMeta(origin, cfg.formId).then((meta) => {
    if (!meta) return;
    if (meta.title) bubble.setAttribute("aria-label", meta.title);
    if (meta.icon) setBubbleContent(bubble, origin, meta.icon);
  });

  bubble.addEventListener("click", () => {
    bubble.classList.add("bf-bubble--hidden");
    openPopup(cfg.formId, {
      position: cfg.position,
      width: cfg.width,
      hideTitle: cfg.hideTitle,
      alignLeft: cfg.alignLeft,
      overlay: cfg.darkOverlay,
      autoClose: cfg.autoClose,
      hiddenFields: cfg.hiddenFields,
      onClose: () => {
        bubble.classList.remove("bf-bubble--hidden");
      },
    });
  });
};
