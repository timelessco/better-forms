/**
 * Reform Standard Embed Script — activates <iframe data-reform-src> placeholders and auto-resizes them.
 * Usage:
 *   <iframe data-reform-src="https://yoursite.com/forms/abc?dynamicHeight=true" loading="lazy" ...></iframe>
 *   <script async src="https://yoursite.com/widgets/embed.js"></script>
 * Runs on load; re-call Reform.loadEmbeds() after injecting iframes dynamically.
 */

/** Set src on every data-reform-src iframe not yet loaded. Idempotent — safe to re-call after DOM mutations. */
const loadEmbeds = (): void => {
  const iframes = document.querySelectorAll<HTMLIFrameElement>(
    "iframe[data-reform-src]:not([src])",
  );
  for (const iframe of iframes) {
    const src = iframe.dataset.reformSrc;
    if (src) {
      iframe.src = src;
    }
  }
};

/** dynamicHeight: form posts {event:"Reform.Resize", height}; match sender by contentWindow, set its height. */
const handleResize = (event: MessageEvent): void => {
  let data: { event?: string; height?: number };
  try {
    data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }
  if (data?.event !== "Reform.Resize" || typeof data.height !== "number") {
    return;
  }
  const iframes = document.querySelectorAll<HTMLIFrameElement>("iframe[data-reform-src]");
  for (const iframe of iframes) {
    if (iframe.contentWindow === event.source) {
      iframe.style.height = `${data.height}px`;
      return;
    }
  }
};

// Merge, don't clobber — a page may also load /embed/popup.js (which sets the popup methods).
window.Reform = { ...window.Reform, loadEmbeds };

window.addEventListener("message", handleResize);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEmbeds);
} else {
  loadEmbeds();
}
