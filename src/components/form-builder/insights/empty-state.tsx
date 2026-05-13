import { BarChart3, LineChart, Rocket, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  /** Form's lifecycle status — drives the publish-vs-share branch. */
  formStatus: string;
  /** Total submissions the form has received (lifetime). */
  submissionCount: number;
  /** Whether any raw visit has been recorded (writers run unconditionally). */
  hasAnyVisits: boolean;
  /** Whether the analytics toggle is on AND the org plan unlocks analytics. */
  analyticsEnabled: boolean;
  /** Spinner state on the "Enable analytics" button while the mutation runs. */
  isEnablingAnalytics?: boolean;
  /** Caller-supplied actions for the relevant prompt. */
  onPublishClick?: () => void;
  onShareClick?: () => void;
  onEnableAnalyticsClick?: () => void;
}

export const EmptyState = ({
  formStatus,
  submissionCount,
  hasAnyVisits,
  analyticsEnabled,
  isEnablingAnalytics = false,
  onPublishClick,
  onShareClick,
  onEnableAnalyticsClick,
}: EmptyStateProps) => {
  // Branch 1: form isn't published yet — nothing else matters until it is.
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

  // Branch 2: form is published and there's something to look at (submissions
  // or raw visits) but the analytics toggle/plan is off — we already kept the
  // data, just need the user to flip the switch (or upgrade) to see it.
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
              {isEnablingAnalytics ? "Enabling…" : "Enable analytics"}
            </Button>
          )
        }
      />
    );
  }

  // Branch 3: published, no data yet (and analytics-enabled if applicable) —
  // the user just needs to send people to the form.
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
