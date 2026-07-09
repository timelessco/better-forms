// Stub for @vercel/oidc. The real package is CJS-only and crashes Vite 7's module
// runner in dev (`Cannot read properties of undefined (reading
// '__cjs_module_runner_transform')`) when bundled, and the nitro production build
// can't resolve it as a bare `ssr.external` import from `node_modules/.nitro/`.
//
// This project never uses AI Gateway / OIDC at runtime — the import only exists
// transitively via `ai` → `@ai-sdk/gateway` → `@vercel/oidc`. Aliasing the bare
// specifier to this stub lets both dev and prod resolve it deterministically.

export class AccessTokenMissingError extends Error {}
export class RefreshAccessTokenFailedError extends Error {}

export const getContext = () => undefined;

export const getVercelOidcToken = async (): Promise<string> => {
  throw new Error("@vercel/oidc stub: OIDC not configured");
};

export const getVercelOidcTokenSync = (): string => {
  throw new Error("@vercel/oidc stub: OIDC not configured");
};

export const getVercelToken = async (): Promise<string> => {
  throw new Error("@vercel/oidc stub: OIDC not configured");
};
