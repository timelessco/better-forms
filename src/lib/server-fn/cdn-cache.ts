import { setResponseHeader } from "@tanstack/react-start/server";
import { vercel, vercelProjectId, vercelTeamId } from "@/integrations/vercel";
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
