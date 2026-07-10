import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth/auth-client";
import { useQuery } from "@tanstack/react-query";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
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

// Weight by action: Upgrade=CTA (filled), Downgrade=ghost, Current=disabled outline.
const tierActionVariant = (action: TierAction): ButtonVariant => {
  if (action === "Upgrade") return "default";
  if (action === "Current") return "outline";
  return "ghost";
};

type Tier = {
  plan: Plan;
  title: string;
  description: string;
  price: string;
  features: readonly string[];
};

// Plan copy in one data table; the three cards are structurally identical (TierCard).
const TIERS: readonly Tier[] = [
  {
    plan: "free",
    title: "Free",
    description: "Perfect for personal projects.",
    price: "$0",
    features: ["1 member", "3 forms", "100 submissions/mo"],
  },
  {
    plan: "pro",
    title: "Pro",
    description: "For growing teams.",
    price: "$19/mo",
    features: ["5 members", "Unlimited forms", "10k submissions/mo"],
  },
  {
    plan: "business",
    title: "Business",
    description: "Enterprise-grade features.",
    price: "$49/mo",
    features: ["Unlimited members", "Custom domains", "API access"],
  },
];

const TierCard = ({
  tier,
  active,
  label,
  variant,
  onAction,
}: {
  tier: Tier;
  active: boolean;
  label: TierAction;
  variant: ButtonVariant;
  onAction: () => void;
}) => (
  <Card className={active ? "border-primary" : "border-border"}>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{tier.title}</CardTitle>
      <CardDescription className="text-xs">{tier.description}</CardDescription>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="mb-3 text-2xl font-bold">{tier.price}</div>
      <ul className="mb-4 space-y-1.5 text-xs text-muted-foreground">
        {tier.features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
      <Button
        className="w-full"
        variant={variant}
        size="sm"
        onClick={active ? undefined : onAction}
        disabled={active}
      >
        {label}
      </Button>
    </CardContent>
  </Card>
);

export const BillingContent = () => {
  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });

  const { isFree: isFreePlan, isLoading, plan: currentPlan } = useUserPlan(activeOrg?.id);

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
      // Polar checkout creates a *new* sub, rejects active customers. Route paid users to portal (plan switch with proration).
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2Icon aria-hidden="true" className="size-8 animate-spin text-muted-foreground" />
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
        {TIERS.map((tier) => {
          const label = tierActionLabel(currentPlan, tier.plan);
          return (
            <TierCard
              key={tier.plan}
              tier={tier}
              active={currentPlan === tier.plan}
              label={label}
              variant={tierActionVariant(label)}
              // Free's action is a downgrade → billing portal; paid tiers route through handleUpgrade
              // (which itself sends existing paid customers to the portal for proration).
              onAction={
                tier.plan === "free" ? handleOpenPortal : () => void handleUpgrade(tier.title)
              }
            />
          );
        })}
      </div>
    </div>
  );
};
