import type * as React from "react";
import { useUserPlan } from "@/hooks/use-user-plan";
import type { UserPlan } from "@/hooks/use-user-plan";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type RequiredPlan = Exclude<UserPlan, "free">;

type FeatureGateProps = {
  requiredPlan: RequiredPlan;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /**
   * "inline" (default): wraps children in inline-flex, for disabling a single switch/input.
   * "block": wraps children as a block with an overlay link, for gating a section of controls.
   */
  variant?: "inline" | "block";
};

const PLAN_LABEL: Record<RequiredPlan, string> = {
  pro: "Pro",
  business: "Business",
};

const openBilling = () => settingsDialogStore.open("billing");

export const useHasPlan = (requiredPlan: RequiredPlan): boolean => {
  const { isPro, isBusiness } = useUserPlan();
  if (requiredPlan === "business") return isBusiness;
  return isPro || isBusiness;
};

export const FeatureGate = ({
  requiredPlan,
  children,
  fallback,
  tooltipSide = "top",
  variant = "inline",
}: FeatureGateProps) => {
  const hasAccess = useHasPlan(requiredPlan);

  if (hasAccess) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  const label = PLAN_LABEL[requiredPlan];

  if (variant === "block") {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-60 select-none" aria-disabled="true">
          {children}
        </div>
        <button
          type="button"
          onClick={openBilling}
          className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground transition-colors hover:text-primary"
          aria-label={`Upgrade to ${label}`}
        >
          <span className="rounded-md border border-border bg-background/90 px-2.5 py-1 underline underline-offset-2 shadow-sm">
            Upgrade to {label}
          </span>
        </button>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="pointer-events-none inline-flex cursor-not-allowed items-center gap-1.5 opacity-60"
            aria-disabled="true"
          >
            {children}
          </div>
        }
      />
      <TooltipContent side={tooltipSide} className="text-xs">
        <button
          type="button"
          onClick={openBilling}
          className="pointer-events-auto underline underline-offset-2"
        >
          Upgrade to {label}
        </button>
      </TooltipContent>
    </Tooltip>
  );
};
