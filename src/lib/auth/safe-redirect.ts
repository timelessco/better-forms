// Whitelist for post-signin `callbackURL`. open-redirect guard, rejects:
// - no leading `/` (absolute URLs)
// - leading `//` (protocol-relative — browsers treat `//host` as `https://host`)
// - `/_` (TanStack internals) or `/api/` — valid endpoints but not navigable
//   (no HTML on GET-without-body → blank screen)
// - chars outside the conservative slug set
export const SAFE_REDIRECT_PATTERN = /^\/(?![/_]|api\/)[a-zA-Z0-9\-_/$.~]+$/;

export const isSafeRedirect = (path: string | undefined | null): path is string =>
  typeof path === "string" && SAFE_REDIRECT_PATTERN.test(path);

/** Post-signin destination: the requested redirect if safe, else the dashboard. */
export const resolveCallbackURL = (redirectTo: string | undefined | null): string =>
  isSafeRedirect(redirectTo) ? redirectTo : "/dashboard";
