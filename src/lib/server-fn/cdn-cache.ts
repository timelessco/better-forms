import { setResponseHeader } from "@tanstack/react-start/server";
import { vercel, vercelProjectId, vercelTeamId } from "@/integrations/vercel";
// Public-form edge-cache flag. Was OFF: purges "succeeded" but stayed stale because we
// emitted Cache-Tag (Fastly/Akamai) not Vercel-Cache-Tag, so edge stored responses untagged
// and invalidateByTags matched nothing. Now emit Vercel-Cache-Tag + Vercel-CDN-Cache-Control
// (edge-only). @vercel/functions addCacheTag() works in prod but its cache subpath has a CJS
// interop bug that crashes Vite 7 dev; direct header is identical at the edge and dev-safe.
const isCdnCacheEnabled = (): boolean =>
  process.env.ENABLE_FORM_CDN_CACHE === "1" || process.env.ENABLE_FORM_CDN_CACHE === "true";

const PUBLIC_CACHE_CONTROL_ENABLED = [
  "public",
  "max-age=60",
  "s-maxage=31536000",
  "stale-while-revalidate=86400",
  "must-revalidate",
].join(", ");

// For gated forms (always) and all forms when CDN flag off.
const PRIVATE_CACHE_CONTROL = "private, no-store";

export const formCacheTag = (formId: string) => `form:${formId}`;

// Header-object form for routes that build their own Response (mirrors applyFormCacheHeaders).
export const formCacheHeaders = (
  formId: string,
  { gated }: { gated: boolean },
): Record<string, string> => {
  if (gated || !isCdnCacheEnabled()) return { "Cache-Control": PRIVATE_CACHE_CONTROL };
  return {
    // Vercel-CDN-Cache-Control is edge-only; plain Cache-Control would also hit browsers/proxies
    // (unwanted at s-maxage=1y). Edge prefers this header over Cache-Control when both present.
    "Vercel-CDN-Cache-Control": PUBLIC_CACHE_CONTROL_ENABLED,
    "Vercel-Cache-Tag": formCacheTag(formId),
  };
};

// Attach cache headers to current public-form response. gated (password/closed/over-limit/error)
// must bypass the shared cache to avoid leaking per-viewer state or stale gate decisions.
export const applyFormCacheHeaders = (formId: string, { gated }: { gated: boolean }) => {
  if (gated || !isCdnCacheEnabled()) {
    setResponseHeader("Cache-Control", PRIVATE_CACHE_CONTROL);
    return;
  }
  setResponseHeader("Vercel-CDN-Cache-Control", PUBLIC_CACHE_CONTROL_ENABLED);
  setResponseHeader("Vercel-Cache-Tag", formCacheTag(formId));
};

// DEBUG: awaited (not waitUntil) + verbose-logged to confirm purge fires per publish in Vercel
// logs. Raw console.* intentional — logger no-ops in prod, defeating the diagnostic. Revert to
// waitUntil + logger once verified.
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
