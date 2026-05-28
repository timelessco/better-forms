import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useCallback, useState } from "react";
import { DropoffSankey } from "@/components/form-builder/insights/dropoff-sankey.lazy";
import { toast } from "sonner";

import { BreakdownCards } from "@/components/form-builder/insights/breakdown-cards";
import { DropoffFunnel } from "@/components/form-builder/insights/dropoff-funnel";
import { EmptyState } from "@/components/form-builder/insights/empty-state";
import { MetricsRow } from "@/components/form-builder/insights/metrics-row";
import { TimeRangeSelector } from "@/components/form-builder/insights/time-range-selector";
import { TimeSeriesChart } from "@/components/form-builder/insights/time-series-chart";
import { WebVitalsCard } from "@/components/form-builder/insights/web-vitals-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCwIcon } from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  dropoffKey,
  insightsAvailabilityKey,
  insightsKey,
  invalidateInsightsQueries,
  vitalsKey,
} from "@/lib/analytics/insights-query-keys";
import {
  getFormDropoff,
  getFormInsights,
  getFormVitals,
  getInsightsAvailability,
} from "@/lib/server-fn/analytics";
import { setFormAnalytics } from "@/lib/server-fn/forms";
import type { TimeRangeFilter } from "@/types/analytics";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";

const DEFAULT_FILTER: TimeRangeFilter = "last_30_days";

// Time range is a cross-form preference — persist so it restores next visit, not resets to default.
const TIME_RANGE_STORAGE_KEY = "reform:insights-time-range";

const TIME_RANGE_FILTERS: readonly TimeRangeFilter[] = [
  "last_24_hours",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "custom",
];

interface StoredTimeRange {
  filter: TimeRangeFilter;
  startDate?: string;
  endDate?: string;
}

const readStoredRange = (): StoredTimeRange | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(TIME_RANGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredTimeRange>;
    if (!parsed.filter || !TIME_RANGE_FILTERS.includes(parsed.filter)) {
      return null;
    }
    // A custom range is only valid with both endpoints; otherwise fall back.
    if (parsed.filter === "custom" && !(parsed.startDate && parsed.endDate)) {
      return null;
    }
    return { filter: parsed.filter, startDate: parsed.startDate, endDate: parsed.endDate };
  } catch {
    return null;
  }
};

const writeStoredRange = (range: StoredTimeRange): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(TIME_RANGE_STORAGE_KEY, JSON.stringify(range));
  } catch {
    // Best-effort: ignore quota / privacy-mode write failures.
  }
};

const InsightsPage = () => {
  const { formId, workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TimeRangeFilter>(
    () => readStoredRange()?.filter ?? DEFAULT_FILTER,
  );
  const [startDate, setStartDate] = useState<string | undefined>(
    () => readStoredRange()?.startDate,
  );
  const [endDate, setEndDate] = useState<string | undefined>(() => readStoredRange()?.endDate);

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

  const vitalsQuery = useQuery({
    queryKey: [...vitalsKey(formId), filter, startDate, endDate],
    queryFn: () => getFormVitals({ data: { formId, filter, startDate, endDate } }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Cheap, time-range-independent — drives empty-state branch. Mutations invalidate this key, so no per-focus refetch needed.
  const availabilityQuery = useQuery({
    queryKey: insightsAvailabilityKey(formId),
    queryFn: () => getInsightsAvailability({ data: { formId } }),
    staleTime: 60_000,
  });

  const isRefetching =
    insightsQuery.isFetching ||
    dropoffQuery.isFetching ||
    vitalsQuery.isFetching ||
    availabilityQuery.isFetching;
  const handleRefresh = () => {
    void insightsQuery.refetch();
    void dropoffQuery.refetch();
    void vitalsQuery.refetch();
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
    writeStoredRange(next);
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
          {vitalsQuery.data ? <WebVitalsCard vitals={vitalsQuery.data} /> : null}
          <Card className="bg-transparent ring-0">
            <CardHeader>
              <CardTitle>Drop-off funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="flow">
                <TabsList className="mb-4">
                  <TabsTrigger value="flow">Flow</TabsTrigger>
                  <TabsTrigger value="funnel">Funnel</TabsTrigger>
                  <TabsIndicator />
                </TabsList>
                <TabsContent value="funnel">
                  <DropoffFunnel dropoff={dropoff} />
                </TabsContent>
                <TabsContent value="flow">
                  <Suspense fallback={<Skeleton className="h-[320px] w-full" />}>
                    <DropoffSankey dropoff={dropoff} />
                  </Suspense>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          <BreakdownCards metrics={metrics} />
        </>
      ) : (
        <EmptyState
          formStatus={availability?.formStatus ?? "draft"}
          submissionCount={availability?.submissionCount ?? 0}
          hasAnyVisits={availability?.hasAnyVisits ?? false}
          analyticsToggle={availability?.analyticsToggle ?? false}
          analyticsEnabled={availability?.analyticsEnabled ?? false}
          isEnablingAnalytics={isEnablingAnalytics}
          onPublishClick={goToEditor}
          onShareClick={goToEditor}
          onEnableAnalyticsClick={() => enableAnalytics()}
          onUpgradeClick={() => settingsDialogStore.open("billing")}
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
