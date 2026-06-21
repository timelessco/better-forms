import { getRequestHeaders } from "@tanstack/react-start/server";

/** True for an authorized cron invocation. Must run in an active request scope. Uses
 * getRequestHeaders() (plural): the singular returned falsy for cron-injected headers, 403'ing
 * every scheduled invocation (rollup dead since the May 6 refactor).
 * Primary check is the CRON_SECRET bearer token — x-vercel-cron alone is attacker-controllable and
 * is only honored as a fallback on Vercel when no secret is configured. */
export const isCronAuthorized = (): boolean => {
  const headers = getRequestHeaders();
  const auth = headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  // Primary: CRON_SECRET bearer token (set on Vercel cron via request headers).
  if (secret && auth === `Bearer ${secret}`) return true;
  // Fallback ONLY on Vercel when no secret is configured: trust the platform header.
  // (Vercel sets x-vercel-cron for genuine cron invocations.) Never trusted off-Vercel.
  if (!secret && process.env.VERCEL && headers.get("x-vercel-cron")) return true;
  return false;
};
