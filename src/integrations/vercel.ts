import { Vercel } from "@vercel/sdk";

/**
 * Shared Vercel SDK client. One bearer token read, one place to swap
 * implementations in tests. Consumers reach into the namespaced sub-clients
 * (`vercel.edgeCache.invalidateByTags`, `vercel.projects.addProjectDomain`,
 * etc.) for typed responses.
 */
export const vercel = new Vercel({ bearerToken: process.env.VERCEL_TOKEN });

/** The Team identifier passed on every request. `undefined` when the env var
 * is unset so a personal Vercel account is targeted. Lazy so test-time
 * `process.env` mocks (set in `beforeEach`) are honoured. */
export const vercelTeamId = (): string | undefined => process.env.VERCEL_TEAM_ID || undefined;

/** Project identifier read from the env. `undefined` if unset — callers that
 * tolerate a missing project (e.g. the dev-mode no-op in `cdn-cache`) check
 * truthiness; callers that require it use {@link requireVercelProjectId}. */
export const vercelProjectId = (): string | undefined => process.env.VERCEL_PROJECT_ID || undefined;

/** Project identifier read from the env, throwing if unset. Use from server
 * paths where a missing project is a configuration error, not a soft no-op. */
export const requireVercelProjectId = (): string => {
  const id = vercelProjectId();
  if (!id) throw new Error("VERCEL_PROJECT_ID is not set");
  return id;
};
