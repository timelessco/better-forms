import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";

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
import {
  dropoffKey,
  insightsAvailabilityKey,
  insightsKey,
  invalidateInsightsQueries,
} from "@/lib/analytics/insights-query-keys";
import {
  getFormDropoff,
  getFormInsights,
  getInsightsAvailability,
} from "@/lib/server-fn/analytics";
import { setFormAnalytics } from "@/lib/server-fn/forms";
import type { TimeRangeFilter } from "@/types/analytics";

const DEFAULT_FILTER: TimeRangeFilter = "last_30_days";

const InsightsPage = () => {
  const { formId, workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TimeRangeFilter>(DEFAULT_FILTER);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const insightsQuery = useQuery({
    queryKey: [...insightsKey(formId), filter, startDate, endDate],
    queryFn: () => getFormInsights({ data: { formId, filter, startDate, endDate } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const dropoffQuery = useQuery({
    queryKey: [...dropoffKey(formId), filter, startDate, endDate],
    queryFn: () => getFormDropoff({ data: { formId, filter, startDate, endDate } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Cheap, time-range-independent. Drives the empty-state branch.
  // Mutations invalidate this key explicitly, so the dashboard doesn't need
  // per-focus refetching to stay correct after a flip.
  const availabilityQuery = useQuery({
    queryKey: insightsAvailabilityKey(formId),
    queryFn: () => getInsightsAvailability({ data: { formId } }),
    staleTime: 60_000,
  });

  const isRefetching =
    insightsQuery.isFetching || dropoffQuery.isFetching || availabilityQuery.isFetching;
  const handleRefresh = () => {
    void insightsQuery.refetch();
    void dropoffQuery.refetch();
    void availabilityQuery.refetch();
  };

  const goToEditor = useCallback(() => {
    void navigate({
      to: "/workspace/$workspaceId/form-builder/$formId/edit",
      params: { workspaceId, formId },
    });
  }, [navigate, workspaceId, formId]);

  const { mutate: enableAnalytics, isPending: isEnablingAnalytics } = useMutation({
    mutationFn: () => setFormAnalytics({ data: { formId, enabled: true } }),
    onSuccess: async () => {
      toast.success("Analytics enabled");
      await invalidateInsightsQueries(queryClient, formId);
    },
    onError: (err) => {
      console.error("[Insights] enable analytics failed:", err);
      toast.error("Failed to enable analytics");
    },
  });

  const handleRangeChange = (next: {
    filter: TimeRangeFilter;
    startDate?: string;
    endDate?: string;
  }) => {
    setFilter(next.filter);
    setStartDate(next.startDate);
    setEndDate(next.endDate);
  };

  if (insightsQuery.isPending || dropoffQuery.isPending || availabilityQuery.isPending) {
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
  const availability = availabilityQuery.data;
  const hasData = metrics.totalVisits > 0 && availability?.analyticsEnabled === true;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleRefresh}
            disabled={isRefetching}
            aria-label="Refresh insights"
          >
            <RefreshCwIcon className={cn("size-4", isRefetching && "animate-spin")} />
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
        <EmptyState
          formStatus={availability?.formStatus ?? "draft"}
          submissionCount={availability?.submissionCount ?? 0}
          hasAnyVisits={availability?.hasAnyVisits ?? false}
          analyticsEnabled={availability?.analyticsEnabled ?? false}
          isEnablingAnalytics={isEnablingAnalytics}
          onPublishClick={goToEditor}
          onShareClick={goToEditor}
          onEnableAnalyticsClick={() => enableAnalytics()}
        />
      )}
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/insights",
)({
  component: InsightsPage,
});
