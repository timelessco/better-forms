import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * True when the request is a Vercel cron invocation or carries the shared
 * CRON_SECRET bearer token. Must be called within an active request scope.
 */
export const isCronAuthorized = (): boolean => {
  if (getRequestHeader("x-vercel-cron")) return true;
  const auth = getRequestHeader("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
};
