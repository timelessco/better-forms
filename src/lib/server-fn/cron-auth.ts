import { getRequestHeaders } from "@tanstack/react-start/server";

/** True for a Vercel cron invocation or a request with the CRON_SECRET bearer token. Must run in
 * an active request scope. Uses getRequestHeaders() (plural): the singular returned falsy for
 * cron-injected headers, 403'ing every scheduled invocation (rollup dead since the May 6 refactor). */
export const isCronAuthorized = (): boolean => {
  const headers = getRequestHeaders();
  if (headers.get("x-vercel-cron")) return true;
  const auth = headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
};
