import { useQuery } from "@tanstack/react-query";
import { auth, useSession } from "@/lib/auth/auth-client";
import { planForProductId } from "@/lib/config/plan-config";
import type { Plan } from "@/lib/config/plan-config";

export type UserPlan = Plan;

export type UseUserPlanResult = {
  isPro: boolean;
  isBusiness: boolean;
  isFree: boolean;
  isLoading: boolean;
  plan: UserPlan;
};

type SubscriptionsListResult = {
  result?: { items?: Array<{ productId: string }> };
};

export const useUserPlan = (orgIdOverride?: string): UseUserPlanResult => {
  const { data: session } = useSession();
  const sessionOrgId = session?.session?.activeOrganizationId as string | undefined;
  const orgId = orgIdOverride ?? sessionOrgId;

  const { data, isLoading } = useQuery({
    ...auth.customer.subscriptions.list.queryOptions({
      query: { referenceId: orgId ?? "", active: true },
    }),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });

  const items = (data as SubscriptionsListResult | undefined)?.result?.items ?? [];
  const plan = planForProductId(items[0]?.productId);

  return {
    isPro: plan === "pro",
    isBusiness: plan === "business",
    isFree: plan === "free",
    isLoading,
    plan,
  };
};
