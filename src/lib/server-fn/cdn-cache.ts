import { setResponseHeader } from "@tanstack/react-start/server";
import { vercel, vercelProjectId, vercelTeamId } from "@/integrations/vercel";
// Feature flag for the public-form edge cache. Previously OFF because
// purges appeared to succeed via the Vercel API but cached responses kept
// serving stale content. Root cause was emitting `Cache-Tag` (Fastly/
// Akamai convention) instead of Vercel's `Vercel-Cache-Tag` — the edge
// stored responses untagged, so `invalidateByTags` matched nothing.
// Now emits `Vercel-Cache-Tag` (the documented Vercel header) and
// `Vercel-CDN-Cache-Control` for the Cache-Control header (edge-only,
// not sent to clients). `addCacheTag()` from `@vercel/functions` would
// also work in production, but its `cache` subpath has a CJS interop
// bug with Vite 7's module runner that crashes dev (`Cannot read
// properties of undefined (reading '__cjs_module_runner_transform')`).
// Direct header is identical at the edge and dev-safe.
const isCdnCacheEnabled = (): boolean =>
  process.env.ENABLE_FORM_CDN_CACHE === "1" || process.env.ENABLE_FORM_CDN_CACHE === "true";

const PUBLIC_CACHE_CONTROL_ENABLED = [
  "public",
  "max-age=60",
  "s-maxage=31536000",
  "stale-while-revalidate=86400",
  "must-revalidate",
].join(", ");

// Used for both gated forms (always) and all forms when the CDN flag is off.
const PRIVATE_CACHE_CONTROL = "private, no-store";

export const formCacheTag = (formId: string) => `form:${formId}`;

// Header object form for routes that build their own `Response`. Mirrors
// the side-effect form (`applyFormCacheHeaders`) for use in handlers that
// return a constructed `Response` rather than relying on request-context.
export const formCacheHeaders = (
  formId: string,
  { gated }: { gated: boolean },
): Record<string, string> => {
  if (gated || !isCdnCacheEnabled()) return { "Cache-Control": PRIVATE_CACHE_CONTROL };
  return {
    // Vercel-CDN-Cache-Control targets only the edge — `Cache-Control`
    // would also reach client browsers and downstream proxies, which we
    // don't want at s-maxage=1y. The edge respects this header in
    // preference to `Cache-Control` when both are present.
    "Vercel-CDN-Cache-Control": PUBLIC_CACHE_CONTROL_ENABLED,
    "Vercel-Cache-Tag": formCacheTag(formId),
  };
};

// Attach cache headers to the current public-form response. `gated` covers
// password-protected forms, closed forms, over-limit forms, and error
// responses — all of which must bypass the shared cache to avoid leaking
// per-viewer state or stale gate decisions.
export const applyFormCacheHeaders = (formId: string, { gated }: { gated: boolean }) => {
  if (gated || !isCdnCacheEnabled()) {
    setResponseHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
    return;
  }
  setResponseHeader("Vercel-CDN-Cache-Control", PUBLIC_CACHE_CONTROL_ENABLED);
  setResponseHeader("Vercel-Cache-Tag", formCacheTag(formId));
};

// DEBUG: awaited (not waitUntil) and verbose-logged so we can read Vercel
// function logs to confirm the purge fires per publish. Raw `console.*`
// is intentional — `@/lib/utils:logger` no-ops in production, which would
// defeat the diagnostic. Revert to waitUntil + logger once verified.
const log = (msg: string, data?: unknown) =>
  data === undefined
    ? console.log(`[cdn-cache:purge] ${msg}`)
    : console.log(`[cdn-cache:purge] ${msg}`, data);

export const purgeFormCache = (formId: string): Promise<void> => purgeFormCacheBatch([formId]);

export const purgeFormCacheBatch = async (formIds: string[]): Promise<void> => {
  if (!isCdnCacheEnabled()) return;

  log("called", {
    formIds,
    hasToken: Boolean(process.env.VERCEL_TOKEN),
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID,
    nodeEnv: process.env.NODE_ENV,
    forcePurge: process.env.FORCE_CDN_PURGE,
  });

  if (formIds.length === 0) {
    log("empty formIds, skipping");
    return;
  }

  const projectId = vercelProjectId();
  if (!(process.env.VERCEL_TOKEN && projectId)) {
    log("missing VERCEL_TOKEN or projectId, skipping");
    return;
  }

  if (process.env.NODE_ENV !== "production" && process.env.FORCE_CDN_PURGE !== "1") {
    log("non-production and FORCE_CDN_PURGE!=1, skipping");
    return;
  }

  const tags = formIds.map(formCacheTag);
  log("calling Vercel edgeCache.invalidateByTags", { projectId, teamId: vercelTeamId(), tags });

  try {
    const result = await vercel.edgeCache.invalidateByTags({
      projectIdOrName: projectId,
      teamId: vercelTeamId(),
      requestBody: { tags },
    });
    log("success", result);
  } catch (err) {
    console.error("[cdn-cache:purge] FAILED", err);
  }
};
