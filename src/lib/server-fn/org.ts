import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/auth";

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
