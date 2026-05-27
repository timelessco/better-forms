import { Vercel } from "@vercel/sdk";

/** Shared Vercel SDK client — one token, one swap point for tests. Consumers use namespaced sub-clients (`vercel.edgeCache.invalidateByTags`, etc.). */
export const vercel = new Vercel({ bearerToken: process.env.VERCEL_TOKEN });

/** Team id per request; `undefined` (env unset) targets a personal account. Lazy so test-time `process.env` mocks are honoured. */
export const vercelTeamId = (): string | undefined => process.env.VERCEL_TEAM_ID || undefined;

/** Project id from env; `undefined` if unset. Tolerant callers (e.g. dev-mode no-op in `cdn-cache`) check truthiness; strict ones use {@link requireVercelProjectId}. */
export const vercelProjectId = (): string | undefined => process.env.VERCEL_PROJECT_ID || undefined;

/** Project id from env, throwing if unset. For server paths where a missing project is a config error, not a soft no-op. */
export const requireVercelProjectId = (): string => {
  const id = vercelProjectId();
  if (!id) throw new Error("VERCEL_PROJECT_ID is not set");
  return id;
};
