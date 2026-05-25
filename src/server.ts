import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

// AsyncLocalStorage symbol TanStack Start uses to track the active H3Event.
// We reach in here purely to grab the underlying Node `ServerResponse` so we
// can call `writeEarlyHints` directly. This is an unstable internal seam —
// if Start ever exposes a first-class accessor (e.g. `getNodeResponse()`),
// replace this with that.
const EVENT_STORAGE_SYMBOL = Symbol.for("tanstack-start:event-storage");

type NodeWriteEarlyHints = (hints: { link: string | Array<string> }) => void;
type EventStorage = {
  getStore?: () => {
    h3Event?: { runtime?: { node?: { res?: { writeEarlyHints?: NodeWriteEarlyHints } } } };
  };
};

const getNodeResponse = () => {
  const storage = (globalThis as Record<symbol, unknown>)[EVENT_STORAGE_SYMBOL] as
    | EventStorage
    | undefined;
  return storage?.getStore?.()?.h3Event?.runtime?.node?.res;
};

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request, {
      // Final-response `Link:` header — the cross-platform fallback. Works on
      // every host. CDNs that synthesise 103 from cached `Link:` headers
      // (Cloudflare, in some configs Vercel's edge) use this on repeat hits.
      responseLinkHeader: true,

      // Best-effort real HTTP 103 attempt. On Node runtimes (Vercel
      // `nodejs22.x`, direct Node, Fly) we grab the underlying
      // `ServerResponse` and call `writeEarlyHints`, emitting a true 103
      // informational response. Whether the upstream proxy forwards it to
      // the browser is platform-specific:
      //   - Cloudflare Workers/in-front: forwards 103 ✓
      //   - Direct Node behind nginx ≥1.13.9 / Caddy: forwards ✓
      //   - Vercel serverless: currently buffers/strips 103 — call is a
      //     no-op end-to-end, but the function still returns normally and
      //     the response Link header above does its job.
      // To check on Vercel: open DevTools Network → click the document
      // request → look for an "Early Hints" / 103 row in the timing detail.
      // Skipped automatically by Start in dev (TSS_DEV_SERVER === 'true').
      onEarlyHints: ({ phase, links }) => {
        if (phase !== "static" || links.length === 0) return;
        try {
          getNodeResponse()?.writeEarlyHints?.({ link: links });
        } catch {
          // Never let a hint attempt fail the request.
        }
      },
    });
  },
});
