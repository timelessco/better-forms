import { getRequestHeaders } from "@tanstack/react-start/server";

/**
 * True when the request is a Vercel cron invocation or carries the shared
 * CRON_SECRET bearer token. Must be called within an active request scope.
 *
 * Uses `getRequestHeaders()` (plural). The singular `getRequestHeader()`
 * silently returned falsy for cron-injected headers, causing every Vercel-
 * scheduled invocation to 403 — the daily rollup hadn't run since the May 6
 * refactor that introduced it.
 */
export const isCronAuthorized = (): boolean => {
  const headers = getRequestHeaders();
  if (headers.get("x-vercel-cron")) return true;
  const auth = headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
};
