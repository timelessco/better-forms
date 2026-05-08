import { setResponseHeader } from "@tanstack/react-start/server";
import { vercel, vercelProjectId, vercelTeamId } from "@/integrations/vercel";

// Re-implements `waitUntil` from `@vercel/functions` directly: that package's
// barrel pulls in `@vercel/functions/cache` which trips Vite's SSR
// module runner (`__cjs_module_runner_transform`). On Vercel runtimes the
// `@vercel/request-context` symbol is set by the platform; off-Vercel this
// degrades to a no-op (the promise is left to settle on its own).
const VERCEL_REQUEST_CONTEXT = Symbol.for("@vercel/request-context");
type VercelRequestContext = { waitUntil?: (promise: Promise<unknown>) => void };
const waitUntil = (promise: Promise<unknown>): void => {
  const ctx = (globalThis as Record<symbol, unknown>)[VERCEL_REQUEST_CONTEXT] as
    | { get?: () => VercelRequestContext | undefined }
    | undefined;
  ctx?.get?.()?.waitUntil?.(promise);
};
// Public forms are immutable per published version. We serve a year-long
// edge cache with stale-while-revalidate, and invalidate the cache tag
// when the form republishes, its branding changes, or it gets deleted.
// Clients (browsers) cache briefly so repeated in-session navigation is
// instant without hiding republish updates from authenticated viewers.
const PUBLIC_CACHE_CONTROL = [
  "public",
  "max-age=60",
  "s-maxage=31536000",
  "stale-while-revalidate=86400",
  "must-revalidate",
].join(", ");

const PRIVATE_CACHE_CONTROL = "private, no-store";

export const formCacheTag = (formId: string) => `form:${formId}`;

// Header object form for routes that build their own `Response`. Equivalent
// to `applyFormCacheHeaders` but doesn't depend on the request-context
// `setResponseHeader` side effect.
export const formCacheHeaders = (
  formId: string,
  { gated }: { gated: boolean },
): Record<string, string> => {
  if (gated) return { "Cache-Control": PRIVATE_CACHE_CONTROL };
  return {
    "Cache-Control": PUBLIC_CACHE_CONTROL,
    "Cache-Tag": formCacheTag(formId),
  };
};

// Attach cache headers to the current public-form response. `gated` covers
// password-protected forms, closed forms, over-limit forms, and error
// responses — all of which must bypass the shared cache to avoid leaking
// per-viewer state or stale gate decisions.
export const applyFormCacheHeaders = (formId: string, { gated }: { gated: boolean }) => {
  if (gated) {
    setResponseHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
    return;
  }
  setResponseHeader("Cache-Control", PUBLIC_CACHE_CONTROL);
  // Vercel honours Cache-Tag on the Edge Network for tag-based purging;
  // non-Vercel CDNs ignore it harmlessly.
  setResponseHeader("Cache-Tag", formCacheTag(formId));
};

// No-op outside Vercel; on Vercel, registers the invalidation with
// `waitUntil` so the serverless runtime doesn't freeze the function before
// the HTTP call to the Edge Cache API completes.
export const purgeFormCache = (formId: string): void => {
  purgeFormCacheBatch([formId]);
};

export const purgeFormCacheBatch = (formIds: string[]): void => {
  if (formIds.length === 0) return;

  const projectId = vercelProjectId();
  if (!(process.env.VERCEL_TOKEN && projectId)) return;

  // Set FORCE_CDN_PURGE=1 to exercise this path from a local branch against
  // a real Vercel project — otherwise non-prod skips to avoid log noise.
  if (process.env.NODE_ENV !== "production" && process.env.FORCE_CDN_PURGE !== "1") {
    return;
  }

  const purge = vercel.edgeCache
    .invalidateByTags({
      projectIdOrName: projectId,
      teamId: vercelTeamId(),
      requestBody: { tags: formIds.map(formCacheTag) },
    })
    .catch((err: unknown) => {
      // Swallow: a failed purge must not break publish/update flows. Worst
      // case the browser revalidates after `max-age=60`.
      console.warn(`[cdn-cache] purge failed for ${formIds.length} tag(s):`, err);
    });

  waitUntil(purge);
};
