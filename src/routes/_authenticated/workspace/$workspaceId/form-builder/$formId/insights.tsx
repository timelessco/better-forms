import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { BreakdownCards } from "@/components/form-builder/insights/breakdown-cards";
import { DropoffFunnel } from "@/components/form-builder/insights/dropoff-funnel";
import { EmptyState } from "@/components/form-builder/insights/empty-state";
import { MetricsRow } from "@/components/form-builder/insights/metrics-row";
import { TimeRangeSelector } from "@/components/form-builder/insights/time-range-selector";
import { TimeSeriesChart } from "@/components/form-builder/insights/time-series-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCwIcon } from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { getFormDropoff, getFormInsights } from "@/lib/server-fn/analytics";
import type { TimeRangeFilter } from "@/types/analytics";

const DEFAULT_FILTER: TimeRangeFilter = "last_30_days";

const InsightsPage = () => {
  const { formId } = Route.useParams();
  const [filter, setFilter] = useState<TimeRangeFilter>(DEFAULT_FILTER);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const insightsQuery = useQuery({
    queryKey: ["insights", formId, filter, startDate, endDate],
    queryFn: () => getFormInsights({ data: { formId, filter, startDate, endDate } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const dropoffQuery = useQuery({
    queryKey: ["dropoff", formId, filter, startDate, endDate],
    queryFn: () => getFormDropoff({ data: { formId, filter, startDate, endDate } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const isRefetching = insightsQuery.isFetching || dropoffQuery.isFetching;
  const handleRefresh = () => {
    void insightsQuery.refetch();
    void dropoffQuery.refetch();
  };

  const handleRangeChange = (next: {
    filter: TimeRangeFilter;
    startDate?: string;
    endDate?: string;
  }) => {
    setFilter(next.filter);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
  };

  if (insightsQuery.isPending || dropoffQuery.isPending) {
    return <Loader />;
  }

  if (insightsQuery.isError || dropoffQuery.isError || !insightsQuery.data || !dropoffQuery.data) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Insights</h1>
          <TimeRangeSelector
            value={filter}
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
          />
        </div>
        <Card className="bg-transparent ring-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Failed to load insights. Try a different time range or refresh.
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = insightsQuery.data;
  const dropoff = dropoffQuery.data;
  const hasData = metrics.totalVisits > 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={isRefetching}
            aria-label="Refresh insights"
          >
            <RefreshCwIcon className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
          <TimeRangeSelector
            value={filter}
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
          />
        </div>
      </div>
      {hasData ? (
        <>
          <MetricsRow metrics={metrics} />
          <Card className="bg-transparent ring-0">
            <CardHeader>
              <CardTitle>Visits over time</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesChart dailyData={metrics.dailyData} />
            </CardContent>
          </Card>
          {dropoff.questions.length > 0 && (
            <Card className="bg-transparent ring-0">
              <CardHeader>
                <CardTitle>Drop-off funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <DropoffFunnel dropoff={dropoff} />
              </CardContent>
            </Card>
          )}
          <BreakdownCards metrics={metrics} />
        </>
      ) : (
        <EmptyState hasData={false} />
      )}
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/insights",
)({
  component: InsightsPage,
});
