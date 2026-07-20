import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/auth";
import { logger } from "@/lib/utils";

/** Server-only org data for SSR (_authenticated loader). Auth handled by route's authMiddleware.
 * `auth` (server-only marker) is used only in the handler, so Start prunes it + its @polar-sh/sdk
 * + @/db + pg deps from the client bundle even though this file is statically imported by
 * _authenticated.tsx. */
export const getOrgDataForLayout = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const [activeOrg, orgsData] = await Promise.all([
    auth.api.getFullOrganization({ headers }),
    auth.api.listOrganizations({ headers }),
  ]);

  // Activate first org server-side to avoid client setActive loops (e.g. after magic-link login).
  if (!activeOrg && orgsData && orgsData.length > 0) {
    const activated = await auth.api.setActiveOrganization({
      headers,
      body: { organizationId: orgsData[0].id },
    });
    if (activated) {
      const freshActiveOrg = await auth.api.getFullOrganization({ headers });
      return { activeOrg: freshActiveOrg, orgsData };
    }
  }

  return { activeOrg, orgsData };
});

/** Query options for org layout data - use with ensureQueryData in loaders */
export const orgDataForLayoutQueryOptions = () =>
  queryOptions({
    queryKey: ["org-data-for-layout"] as const,
    queryFn: () => getOrgDataForLayout(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Aligns the session's active org with the org that owns the workspace being opened.
 *
 * Workspaces from ALL of a user's orgs render in one sidebar, but the active org (set arbitrarily
 * to the first membership at session creation — auth.ts) drives BOTH plan gating and the
 * requireScopedForm/authForm write scoping. So opening a workspace owned by a non-active org left
 * plan + writes keyed to the wrong org. Called from the $workspaceId route loader so every nested
 * form action runs with the correct active org. Idempotent: only writes when they differ; catches
 * non-membership so a stale/foreign workspaceId leaves the active org untouched.
 */
export const ensureActiveOrgForWorkspace = createServerFn({ method: "GET" })
  .validator((workspaceId: string) => workspaceId)
  .handler(async ({ data: workspaceId }) => {
    // Fully best-effort: this runs as the $workspaceId route loader, so ANY throw (session read,
    // DB lookup, or a non-membership setActive) must resolve to null rather than fail navigation
    // with an error boundary. The route's own auth still surfaces genuine access errors.
    try {
      const headers = getRequestHeaders();
      const session = await auth.api.getSession({ headers });
      if (!session) return null;

      const { db } = await import("@/db");
      const { workspaces } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const [ws] = await db
        .select({ orgId: workspaces.organizationId })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId));
      const owningOrgId = ws?.orgId;
      if (!owningOrgId) return null;

      const activeOrgId = (session.session as { activeOrganizationId?: string | null })
        .activeOrganizationId;
      if (activeOrgId === owningOrgId) return { orgId: owningOrgId };

      await auth.api.setActiveOrganization({ headers, body: { organizationId: owningOrgId } });
      return { orgId: owningOrgId };
    } catch (e) {
      logger("[ensureActiveOrgForWorkspace] alignment skipped", {
        workspaceId,
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  });
