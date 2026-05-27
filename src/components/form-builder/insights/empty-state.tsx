import { BarChart3, LineChart, Lock, Rocket, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextSwap } from "@/components/transitions/text-swap";

interface EmptyStateProps {
  /** Form's lifecycle status — drives the publish-vs-share branch. */
  formStatus: string;
  /** Total submissions the form has received (lifetime). */
  submissionCount: number;
  /** Whether any raw visit has been recorded (writers run unconditionally). */
  hasAnyVisits: boolean;
  /** Raw `formSettings.analytics` — distinguishes "off" from "on but plan-locked". */
  analyticsToggle: boolean;
  /** Toggle AND the org plan unlocks analytics. */
  analyticsEnabled: boolean;
  isEnablingAnalytics?: boolean;
  onPublishClick?: () => void;
  onShareClick?: () => void;
  onEnableAnalyticsClick?: () => void;
  onUpgradeClick?: () => void;
}

export const EmptyState = ({
  formStatus,
  submissionCount,
  hasAnyVisits,
  analyticsToggle,
  analyticsEnabled,
  isEnablingAnalytics = false,
  onPublishClick,
  onShareClick,
  onEnableAnalyticsClick,
  onUpgradeClick,
}: EmptyStateProps) => {
  if (formStatus !== "published") {
    return (
      <PromptCard
        icon={<Rocket className="size-6 text-muted-foreground" aria-hidden="true" />}
        title="Publish your form to start collecting insights"
        body="Once your form is live and a respondent visits it, visit and drop-off data will start flowing in here."
        action={
          onPublishClick && (
            <Button size="sm" onClick={onPublishClick}>
              Publish form
            </Button>
          )
        }
      />
    );
  }

  // Toggle on but plan-locked → upgrade prompt (flipping the toggle is a no-op).
  if (!analyticsEnabled && analyticsToggle && (submissionCount > 0 || hasAnyVisits)) {
    return (
      <PromptCard
        icon={<Lock className="size-6 text-muted-foreground" aria-hidden="true" />}
        title="Analytics is on, but your plan blocks the view"
        body={
          submissionCount > 0
            ? `Your form has ${submissionCount} ${submissionCount === 1 ? "submission" : "submissions"} so far. Upgrade to Pro to see visits, drop-off, and device breakdowns — your data has been kept and will appear here once you upgrade.`
            : "Visits are being recorded. Upgrade to Pro to surface them as charts — your data has been kept and will appear here once you upgrade."
        }
        action={
          onUpgradeClick && (
            <Button size="sm" onClick={onUpgradeClick}>
              Upgrade to Pro
            </Button>
          )
        }
      />
    );
  }

  // Toggle off → enable prompt. `setFormAnalytics` re-checks the plan server-side.
  if (!analyticsEnabled && (submissionCount > 0 || hasAnyVisits)) {
    return (
      <PromptCard
        icon={<LineChart className="size-6 text-muted-foreground" aria-hidden="true" />}
        title="Turn on analytics to view your insights"
        body={
          submissionCount > 0
            ? `Your form has ${submissionCount} ${submissionCount === 1 ? "submission" : "submissions"} so far. Enable analytics to see visits, drop-off, and device breakdowns — Pro feature.`
            : "Visits are being recorded for this form. Enable analytics to surface them as charts — Pro feature."
        }
        action={
          onEnableAnalyticsClick && (
            <Button size="sm" onClick={onEnableAnalyticsClick} disabled={isEnablingAnalytics}>
              <TextSwap key={isEnablingAnalytics ? "Enabling…" : "Enable analytics"}>
                {isEnablingAnalytics ? "Enabling…" : "Enable analytics"}
              </TextSwap>
            </Button>
          )
        }
      />
    );
  }

  return (
    <PromptCard
      icon={<Share2 className="size-6 text-muted-foreground" aria-hidden="true" />}
      title="No visits yet"
      body="Share your form to start collecting visits. Once people view or submit it, your insights will appear here."
      action={
        onShareClick && (
          <Button size="sm" onClick={onShareClick}>
            Share form
          </Button>
        )
      }
    />
  );
};

const PromptCard = ({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        {icon ?? <BarChart3 className="size-6 text-muted-foreground" aria-hidden="true" />}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </CardContent>
  </Card>
);
