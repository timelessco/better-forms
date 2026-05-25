import { EvilAreaChart } from "@/components/evilcharts/charts/area-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import type { FormInsightsMetrics } from "@/types/analytics";

interface TimeSeriesChartProps {
  dailyData: FormInsightsMetrics["dailyData"];
}

// Use fixed mid-luminance colors instead of `--chart-N` tokens — those flip
// to dark `blue-900..blue-500` in dark mode which renders as harsh dark blobs
// against the dark card bg. These OKLCH values keep the same perceived
// brightness across themes so the chart blends with the card in both modes.
const chartConfig = {
  visits: {
    label: "Visits",
    colors: {
      light: ["oklch(0.62 0.18 250)"],
      dark: ["oklch(0.62 0.18 250)"],
    },
  },
  uniqueVisitors: {
    label: "Unique visitors",
    colors: {
      light: ["oklch(0.55 0.16 200)"],
      dark: ["oklch(0.55 0.16 200)"],
    },
  },
  submissions: {
    label: "Submissions",
    colors: {
      light: ["oklch(0.7 0.18 145)"],
      dark: ["oklch(0.7 0.18 145)"],
    },
  },
} satisfies ChartConfig;

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const formatDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return dateLabelFormatter.format(parsed);
};

export const TimeSeriesChart = ({ dailyData }: TimeSeriesChartProps) => {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No data for this range
      </div>
    );
  }

  return (
    <EvilAreaChart
      className="h-[260px] w-full"
      chartConfig={chartConfig}
      data={dailyData}
      xDataKey="date"
      curveType="monotone"
      areaVariant="gradient"
      strokeVariant="solid"
      xAxisProps={{ tickFormatter: formatDateLabel }}
    />
  );
};
