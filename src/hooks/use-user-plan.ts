import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { auth, useSession } from "@/lib/auth/auth-client";
import { planForProductId } from "@/lib/config/plan-config";
import type { Plan } from "@/lib/config/plan-config";
import { PLAN_RANK } from "@/lib/config/plan-gates";
import { useWorkspace } from "@/hooks/use-live-hooks";
import { cachedOrgPlanQueryOptions } from "@/lib/server-fn/plan";

export type UserPlan = Plan;

export type UseUserPlanResult = {
  isPro: boolean;
  isBusiness: boolean;
  isFree: boolean;
  isLoading: boolean;
  plan: UserPlan;
};

/**
 * Resolves the effective plan for the org in scope. Precedence for the org id:
 * explicit override → the org that owns the current workspace (route param) → session active org.
 * Using the workspace's owning org keeps the badge/gates correct for multi-org users whose active
 * org differs from the workspace they're viewing (the server loader aligns the active org too, but
 * this makes the client display correct immediately, without waiting for the session to refetch).
 *
 * Plan value = the higher of the live Polar subscription and the cached organization.plan column.
 * The column fallback covers environments where the live Polar query can't run (local dev has no
 * POLAR_ACCESS_TOKEN → empty subscription list → everything reads "free").
 */
export const useUserPlan = (orgIdOverride?: string): UseUserPlanResult => {
  const { data: session } = useSession();
  const sessionOrgId = session?.session?.activeOrganizationId as string | undefined;

  const params = useParams({ strict: false }) as { workspaceId?: string };
  const { data: workspace } = useWorkspace(params.workspaceId);
  const workspaceOrgId = workspace?.organizationId;

  const orgId = orgIdOverride ?? workspaceOrgId ?? sessionOrgId;

  const { data, isLoading: isPolarLoading } = useQuery({
    ...auth.customer.subscriptions.list.queryOptions({
      query: { referenceId: orgId ?? "", active: true },
    }),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const { data: cachedPlan, isLoading: isCachedLoading } = useQuery(
    cachedOrgPlanQueryOptions(orgId),
  );

  const items = data?.result?.items ?? [];
  const polarPlan = planForProductId(items[0]?.productId);
  const columnPlan: Plan = cachedPlan ?? "free";
  // Take the higher tier — Polar is source of truth in prod; the cached column carries dev + any
  // window where the live query is unavailable.
  const plan: Plan = PLAN_RANK[columnPlan] > PLAN_RANK[polarPlan] ? columnPlan : polarPlan;

  return {
    isPro: plan === "pro",
    isBusiness: plan === "business",
    isFree: plan === "free",
    // Loading while EITHER source is pending — the plan is only trustworthy once both have
    // resolved, so a paid user is never briefly read as free (which would trip the publish gate).
    isLoading: isPolarLoading || isCachedLoading,
    plan,
  };
};
