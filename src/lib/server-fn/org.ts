import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

/**
 * Server-only: fetches org data with request headers for SSR.
 * Used by _authenticated loader - must stay in server fn to preserve client boundary.
 * Auth is handled by the route's authMiddleware — no need to re-validate session here.
 *
 * `auth` is lazy-imported inside the handler body. Static-importing it here
 * would drag `@polar-sh/sdk` + `@/db` + `pg` into the client bundle (this
 * file is statically imported by `_authenticated.tsx`).
 */
export const getOrgDataForLayout = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await import("@/lib/auth/auth");
  const headers = getRequestHeaders();
  const [activeOrg, orgsData] = await Promise.all([
    auth.api.getFullOrganization({ headers }),
    auth.api.listOrganizations({ headers }),
  ]);

  // Activate first org server-side to avoid client-side setActive loops
  // (e.g. after magic link login)
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
