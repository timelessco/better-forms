import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/auth-client";
import { useLoaderData } from "@tanstack/react-router";
import { Loader2Icon } from "@/components/ui/icons";
import { useUserPlan } from "@/hooks/use-user-plan";
import { openOrgBillingPortal } from "@/lib/server-fn/billing";
import { PLAN_RANK } from "@/lib/config/plan-gates";
import type { Plan } from "@/lib/config/plan-config";

type TierAction = "Current" | "Upgrade" | "Downgrade";
type ButtonVariant = "default" | "outline" | "ghost";

const tierActionLabel = (currentPlan: Plan, tier: Plan): TierAction => {
  if (currentPlan === tier) return "Current";
  return PLAN_RANK[tier] > PLAN_RANK[currentPlan] ? "Upgrade" : "Downgrade";
};

// Visual weight follows action: Upgrade is the CTA (filled), Downgrade is
// a soft secondary (ghost), Current is shown as a disabled outline marker.
const tierActionVariant = (action: TierAction): ButtonVariant => {
  if (action === "Upgrade") return "default";
  if (action === "Current") return "outline";
  return "ghost";
};

export const BillingContent = () => {
  const activeOrg = useLoaderData({ from: "/_authenticated", select: (d) => d.activeOrg });

  const {
    isPro: isProPlan,
    isBusiness: isBusinessPlan,
    isFree: isFreePlan,
    isLoading,
    plan: currentPlan,
  } = useUserPlan(activeOrg?.id);

  const freeLabel = tierActionLabel(currentPlan, "free");
  const proLabel = tierActionLabel(currentPlan, "pro");
  const businessLabel = tierActionLabel(currentPlan, "business");
  const freeVariant = tierActionVariant(freeLabel);
  const proVariant = tierActionVariant(proLabel);
  const businessVariant = tierActionVariant(businessLabel);

  const handleOpenPortal = useCallback(async () => {
    if (!activeOrg) {
      toast.error("Please select an organization first");
      return;
    }
    try {
      const { url } = await openOrgBillingPortal({ data: { orgId: activeOrg.id } });
      window.location.href = url;
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to open billing portal");
    }
  }, [activeOrg]);

  const handleUpgrade = useCallback(
    async (planSlug: string) => {
      if (!activeOrg) {
        toast.error("Please select an organization first");
        return;
      }
      // Polar's checkout creates a *new* subscription and rejects customers
      // who already have an active one. Route existing paid customers through
      // the customer portal, which supports plan switching with proration.
      if (!isFreePlan) {
        await handleOpenPortal();
        return;
      }
      try {
        const { data, error } = (await authClient.checkout({
          slug: planSlug,
          referenceId: activeOrg.id,
        })) as { data: { url: string } | null; error: Error | null };

        if (error) throw error;

        if (data?.url) {
          window.location.href = data.url;
        }
      } catch (error: unknown) {
        toast.error((error as Error).message || "Failed to initiate checkout");
      }
    },
    [activeOrg, isFreePlan, handleOpenPortal],
  );

  const handleUpgradePro = useCallback(() => handleUpgrade("Pro"), [handleUpgrade]);
  const handleUpgradeBusiness = useCallback(() => handleUpgrade("Business"), [handleUpgrade]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2Icon aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!isFreePlan && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPortal}
            className="h-[30px] rounded-lg"
          >
            Manage Billing
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`${isFreePlan ? "border-primary" : "border-border"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Free</CardTitle>
            <CardDescription className="text-xs">Perfect for personal projects.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3 text-2xl font-bold">$0</div>
            <ul className="mb-4 space-y-1.5 text-xs text-muted-foreground">
              <li>• 1 member</li>
              <li>• 3 forms</li>
              <li>• 100 submissions/mo</li>
            </ul>
            <Button
              className="w-full"
              variant={freeVariant}
              size="sm"
              onClick={isFreePlan ? undefined : handleOpenPortal}
              disabled={isFreePlan}
            >
              {freeLabel}
            </Button>
          </CardContent>
        </Card>

        <Card className={`${isProPlan ? "border-primary" : "border-border"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pro</CardTitle>
            <CardDescription className="text-xs">For growing teams.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3 text-2xl font-bold">$19/mo</div>
            <ul className="mb-4 space-y-1.5 text-xs text-muted-foreground">
              <li>• 5 members</li>
              <li>• Unlimited forms</li>
              <li>• 10k submissions/mo</li>
            </ul>
            <Button
              className="w-full"
              variant={proVariant}
              size="sm"
              onClick={handleUpgradePro}
              disabled={isProPlan}
            >
              {proLabel}
            </Button>
          </CardContent>
        </Card>

        <Card className={`${isBusinessPlan ? "border-primary" : "border-border"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business</CardTitle>
            <CardDescription className="text-xs">Enterprise-grade features.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3 text-2xl font-bold">$49/mo</div>
            <ul className="mb-4 space-y-1.5 text-xs text-muted-foreground">
              <li>• Unlimited members</li>
              <li>• Custom domains</li>
              <li>• API access</li>
            </ul>
            <Button
              className="w-full"
              variant={businessVariant}
              size="sm"
              onClick={handleUpgradeBusiness}
              disabled={isBusinessPlan}
            >
              {businessLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
