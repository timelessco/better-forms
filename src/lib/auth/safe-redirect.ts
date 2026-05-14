// Whitelist of redirect paths the login form will use as `callbackURL` after
// a successful signin. Rejects:
// - paths not starting with `/` (no absolute URLs — open-redirect guard)
// - paths starting with `//` (protocol-relative URLs — same open-redirect risk
//   because browsers treat `//host` as `https://host`)
// - paths starting with `/_` (TanStack internals like `/_serverFn/`) or
//   `/api/` — they're valid endpoints but not user-navigable. Sending the user
//   here lands them on a blank screen because serverFns and API routes don't
//   render HTML on GET-without-body.
// - paths containing chars outside the conservative slug set.
export const SAFE_REDIRECT_PATTERN = /^\/(?![/_]|api\/)[a-zA-Z0-9\-_/$.~]+$/;

export const isSafeRedirect = (path: string | undefined | null): path is string =>
  typeof path === "string" && SAFE_REDIRECT_PATTERN.test(path);
