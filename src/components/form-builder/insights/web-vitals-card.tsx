import { EvilAreaChart } from "@/components/evilcharts/charts/area-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberPopIn } from "@/components/transitions/number-pop-in";
import { cn } from "@/lib/utils";
import type { VitalRating, WebVitalName } from "@/lib/analytics/vitals";
import type { FormVitalsMetrics, VitalMetricSummary } from "@/types/analytics";

interface WebVitalsCardProps {
  vitals: FormVitalsMetrics;
}

interface MetricMeta {
  name: WebVitalName;
  label: string;
  description: string;
  /** Fixed mid-luminance OKLCH color so the chart blends in both themes. */
  color: string;
}

const METRICS: readonly MetricMeta[] = [
  {
    name: "lcp",
    label: "LCP",
    description: "Largest Contentful Paint",
    color: "oklch(0.62 0.18 250)",
  },
  {
    name: "inp",
    label: "INP",
    description: "Interaction to Next Paint",
    color: "oklch(0.7 0.16 300)",
  },
  {
    name: "cls",
    label: "CLS",
    description: "Cumulative Layout Shift",
    color: "oklch(0.7 0.18 145)",
  },
] as const;

// CWV rating colors are a standard traffic-light semantic, so explicit hues are
// intentional here rather than neutral design tokens.
const RATING_DOT: Record<VitalRating, string> = {
  good: "bg-emerald-500",
  "needs-improvement": "bg-amber-500",
  poor: "bg-red-500",
};

const formatValue = (metric: WebVitalName, value: number | null): string => {
  if (value === null) {
    return "—";
  }
  if (metric === "lcp") {
    return `${(value / 1000).toFixed(1)}s`;
  }
  if (metric === "inp") {
    return `${Math.round(value)}ms`;
  }
  return value.toFixed(2);
};

const formatMagnitude = (metric: WebVitalName, magnitude: number): string =>
  metric === "cls" ? magnitude.toFixed(2) : `${Math.round(magnitude)}ms`;

interface DeltaLine {
  text: string;
  improved: boolean | null;
}

const describeDelta = (metric: WebVitalName, summary: VitalMetricSummary): DeltaLine | null => {
  const delta = summary.deltaVsPrev;
  if (delta === null) {
    return null;
  }
  const magnitude = Math.abs(delta);
  const magnitudeText = formatMagnitude(metric, magnitude);
  // A rounded-away magnitude reads as no movement.
  if (magnitudeText === "0ms" || magnitudeText === "0.00") {
    return { text: "no change vs prior period", improved: null };
  }
  // Lower is better for all three metrics.
  const improved = delta < 0;
  const direction =
    metric === "cls" ? (improved ? "lower" : "higher") : improved ? "faster" : "slower";
  return { text: `${magnitudeText} ${direction} vs prior period`, improved };
};

const axisFormatter =
  (metric: WebVitalName) =>
  (value: number): string =>
    metric === "lcp"
      ? `${(value / 1000).toFixed(1)}s`
      : metric === "inp"
        ? `${Math.round(value)}`
        : value.toFixed(2);

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const formatDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateLabelFormatter.format(parsed);
};

const seriesKeyFor = (metric: WebVitalName): keyof FormVitalsMetrics["series"][number] =>
  metric === "lcp" ? "lcpP75" : metric === "inp" ? "inpP75" : "clsP75";

const StatTile = ({ meta, summary }: { meta: MetricMeta; summary: VitalMetricSummary }) => {
  const delta = describeDelta(meta.name, summary);
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            summary.rating ? RATING_DOT[summary.rating] : "bg-muted-foreground/40",
          )}
          aria-hidden={true}
        />
        <p className="text-sm font-medium">{meta.label}</p>
      </div>
      <p className="text-xs text-pretty text-muted-foreground">{meta.description}</p>
      <p className="text-2xl font-semibold text-balance">
        <NumberPopIn value={formatValue(meta.name, summary.p75)} className="tabular-nums" />
      </p>
      {delta ? (
        <p
          className={cn(
            "text-xs",
            delta.improved === null
              ? "text-muted-foreground"
              : delta.improved
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400",
          )}
        >
          {delta.text}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">no prior data</p>
      )}
    </li>
  );
};

const VitalTrendChart = ({
  metric,
  series,
}: {
  metric: WebVitalName;
  series: FormVitalsMetrics["series"];
}) => {
  const key = seriesKeyFor(metric);
  const data = series.map((point) => ({ date: point.date, value: point[key] }));
  // A line needs at least two days with data; one point can't draw a trend.
  const daysWithData = data.reduce((n, point) => (point.value === null ? n : n + 1), 0);

  if (daysWithData < 2) {
    return (
      <div className="flex h-[220px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {daysWithData === 0
          ? "No Core Web Vitals collected for this range yet."
          : "Only one day has data so far — the trend fills in once there are at least two days. The p75 above already reflects every session in this range."}
      </div>
    );
  }

  const meta = METRICS.find((m) => m.name === metric);
  const chartConfig = {
    value: {
      label: `${meta?.label ?? metric} (p75)`,
      colors: {
        light: [meta?.color ?? "oklch(0.62 0.18 250)"],
        dark: [meta?.color ?? "oklch(0.62 0.18 250)"],
      },
    },
  } satisfies ChartConfig;

  return (
    <EvilAreaChart
      className="h-[220px] w-full"
      chartConfig={chartConfig}
      data={data}
      xDataKey="date"
      curveType="monotone"
      areaVariant="gradient"
      strokeVariant="solid"
      connectNulls={true}
      xAxisProps={{ tickFormatter: formatDateLabel }}
      yAxisProps={{ tickFormatter: axisFormatter(metric) }}
    />
  );
};

export const WebVitalsCard = ({ vitals }: WebVitalsCardProps) => {
  const summaries: Record<WebVitalName, VitalMetricSummary> = {
    lcp: vitals.lcp,
    inp: vitals.inp,
    cls: vitals.cls,
  };
  const hasAnySample = METRICS.some((meta) => summaries[meta.name].sampleCount > 0);

  return (
    <Card className="bg-transparent ring-0">
      <CardHeader className="border-b">
        <CardTitle>Core Web Vitals</CardTitle>
        <CardDescription>
          Field experience on real sessions, measured at the origin.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {hasAnySample ? (
          <div className="flex flex-col gap-6">
            <ul className="grid gap-6 sm:grid-cols-3">
              {METRICS.map((meta) => (
                <StatTile key={meta.name} meta={meta} summary={summaries[meta.name]} />
              ))}
            </ul>
            <Tabs defaultValue="lcp">
              <TabsList className="mb-4">
                {METRICS.map((meta) => (
                  <TabsTrigger key={meta.name} value={meta.name}>
                    {meta.label}
                  </TabsTrigger>
                ))}
                <TabsIndicator />
              </TabsList>
              {METRICS.map((meta) => (
                <TabsContent key={meta.name} value={meta.name}>
                  <VitalTrendChart metric={meta.name} series={vitals.series} />
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No Core Web Vitals collected for this range yet. They accrue as respondents load the
            published form.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
