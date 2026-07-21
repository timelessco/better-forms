import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/auth";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";

/**
 * Cached `organization.plan` column for an org the caller belongs to. Client fallback for
 * `useUserPlan` when the live Polar query is unavailable (local dev has no POLAR_ACCESS_TOKEN, so
 * the subscription list is empty and every org reads as "free"). Membership-checked so an authed
 * user can't probe arbitrary orgs' tiers; non-members / unknown orgs resolve to "free".
 */
export const getCachedOrgPlan = createServerFn({ method: "GET" })
  .validator((orgId: string) => orgId)
  .handler(async ({ data: orgId }): Promise<ServerPlan> => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session?.user?.id || !orgId) return "free";

    const { db } = await import("@/db");
    const { member } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const [membership] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, orgId)));
    if (!membership) return "free";

    const { getOrgPlan } = await import("@/lib/server-fn/plan-helpers.server");
    return getOrgPlan(orgId);
  });

export const cachedOrgPlanQueryOptions = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["cached-org-plan", orgId ?? ""] as const,
    queryFn: () => getCachedOrgPlan({ data: orgId as string }),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
  });
