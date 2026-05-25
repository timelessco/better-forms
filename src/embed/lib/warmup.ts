// Warm the browser for the popup so clicking the bubble opens an
// already-ready popup.
//
// - preconnect: opens the TCP+TLS connection to the form origin eagerly.
// - warmupFormOnIntent: on first hover/focus/touch, fires a callback that
//   builds the full popup hidden — iframe loads + React mounts in the
//   background. Clicking after that just flips visibility.
//
// We used to prefetch the iframe document and its assets via <link rel=
// "prefetch">. That didn't help: the iframe loads subresources with
// different credentials mode than the prefetch hints, so the browser
// treated them as separate cache entries and refetched on click.

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

/**
 * Inject a preconnect hint for the given origin. No-op when the origin
 * matches the current page (the browser is already connected).
 */
export const preconnectOrigin = (origin: string): void => {
  if (origin === window.location.origin) return;
  ensureLinkTag("preconnect", origin, "anonymous");
  // dns-prefetch is a cheap fallback for browsers (mainly older Safari)
  // that don't act on preconnect aggressively.
  ensureLinkTag("dns-prefetch", origin);
};

/**
 * Attach one-shot intent listeners to the trigger. On the first hover,
 * focus, or touch, the provided `warmup` callback runs — usually building
 * the full popup hidden so the click after just reveals it.
 */
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
