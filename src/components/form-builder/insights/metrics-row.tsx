import { CheckCircle2, Clock, MousePointerClick, TrendingUp, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { FormInsightsMetrics } from "@/types/analytics";

interface MetricsRowProps {
  metrics: FormInsightsMetrics;
}

const numberFormatter = new Intl.NumberFormat("en-US");

const formatDuration = (ms: number): string => {
  if (!ms || ms <= 0) {
    return "—";
  }
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const formatCompletionRate = (submissions: number, uniqueVisitors: number): string => {
  if (uniqueVisitors <= 0) {
    return "—";
  }
  const rate = Math.round((submissions / uniqueVisitors) * 100);
  return `${rate}%`;
};

interface MetricCardProps {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const MetricCard = ({ label, value, Icon }: MetricCardProps) => (
  <Card className="bg-transparent">
    <CardContent className="flex flex-col gap-2 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden={true} />
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
    </CardContent>
  </Card>
);

export const MetricsRow = ({ metrics }: MetricsRowProps) => (
  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
    <MetricCard
      label="Visits"
      value={numberFormatter.format(metrics.totalVisits)}
      Icon={MousePointerClick}
    />
    <MetricCard
      label="Unique visitors"
      value={numberFormatter.format(metrics.uniqueVisitors)}
      Icon={Users}
    />
    <MetricCard
      label="Submissions"
      value={numberFormatter.format(metrics.totalSubmissions)}
      Icon={CheckCircle2}
    />
    <MetricCard
      label="Completion rate"
      value={formatCompletionRate(metrics.totalSubmissions, metrics.uniqueVisitors)}
      Icon={TrendingUp}
    />
    <MetricCard
      label="Avg duration"
      value={formatDuration(metrics.avgVisitDurationMs)}
      Icon={Clock}
    />
  </div>
);
