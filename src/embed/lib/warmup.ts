// Warm the browser so clicking the bubble opens an already-ready popup.
// - preconnect: eager TCP+TLS to form origin.
// - warmupFormOnIntent: first hover/focus/touch builds the popup hidden (iframe loads, React mounts); click flips visibility.
// Prefetch via <link rel="prefetch"> failed: iframe subresources use a different credentials mode, so the browser cached them separately and refetched on click.

const ensureLinkTag = (rel: string, href: string, crossOrigin?: string): void => {
  const existing = document.head.querySelector(
    `link[rel="${rel}"][href="${href}"]`,
  ) as HTMLLinkElement | null;
  if (existing) return;

  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (crossOrigin !== undefined) {
    link.crossOrigin = crossOrigin;
  }
  document.head.appendChild(link);
};

/** Preconnect hint for origin. No-op when it matches current page (already connected). */
export const preconnectOrigin = (origin: string): void => {
  if (origin === window.location.origin) return;
  ensureLinkTag("preconnect", origin, "anonymous");
  // dns-prefetch fallback for browsers (older Safari) that ignore preconnect.
  ensureLinkTag("dns-prefetch", origin);
};

/** One-shot intent listeners — first hover/focus/touch runs `warmup` (usually builds the popup hidden so click reveals). */
export const warmupFormOnIntent = (trigger: HTMLElement, warmup: () => void): void => {
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    warmup();
  };

  const opts: AddEventListenerOptions = { once: true, passive: true };
  trigger.addEventListener("pointerenter", fire, opts);
  trigger.addEventListener("focus", fire, opts);
  trigger.addEventListener("touchstart", fire, opts);
};
