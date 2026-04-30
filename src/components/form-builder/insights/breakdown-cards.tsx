import { EvilBarChart } from "@/components/evilcharts/charts/bar-chart";
import { EvilPieChart } from "@/components/evilcharts/charts/pie-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CountBreakdown, FormInsightsMetrics } from "@/types/analytics";

interface BreakdownCardsProps {
  metrics: FormInsightsMetrics;
}

interface BreakdownDatum extends Record<string, unknown> {
  name: string;
  value: number;
}

// Fixed OKLCH palette — `--chart-N` tokens flip to a dark blue palette in
// dark mode which renders as dark blobs against the dark card bg.
// These values keep the same perceived luminance across themes.
const PALETTE: string[] = [
  "oklch(0.62 0.18 250)", // blue
  "oklch(0.7 0.18 145)", // green
  "oklch(0.72 0.16 65)", // amber
  "oklch(0.65 0.22 25)", // red-orange
  "oklch(0.6 0.2 305)", // purple
];

const TOP_N_SOURCES = 5;
const numberFormatter = new Intl.NumberFormat("en-US");

const breakdownToArray = (breakdown: CountBreakdown): BreakdownDatum[] =>
  Object.entries(breakdown)
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

const collapseToTopN = (entries: BreakdownDatum[], topN: number): BreakdownDatum[] => {
  if (entries.length <= topN) {
    return entries;
  }
  const top = entries.slice(0, topN);
  const rest = entries.slice(topN);
  const otherTotal = rest.reduce((sum, entry) => sum + entry.value, 0);
  if (otherTotal <= 0) {
    return top;
  }
  return [...top, { name: "Other", value: otherTotal }];
};

// Each slice in a pie chart needs its own ChartConfig key so EvilPieChart can resolve --color-{name}-0.
const buildPerSliceConfig = (entries: BreakdownDatum[]): ChartConfig => {
  const config: ChartConfig = {};
  entries.forEach((entry, index) => {
    const color = PALETTE[index % PALETTE.length];
    config[entry.name] = {
      label: entry.name,
      colors: { light: [color], dark: [color] },
    };
  });
  return config;
};

const barChartConfig = {
  value: {
    label: "Visits",
    colors: {
      light: ["var(--chart-1)"],
      dark: ["var(--chart-1)"],
    },
  },
} satisfies ChartConfig;

interface EmptyMessageProps {
  height?: number;
}

const EmptyMessage = ({ height = 180 }: EmptyMessageProps) => (
  <div
    className="flex items-center justify-center text-sm text-muted-foreground"
    style={{ height }}
  >
    No data yet
  </div>
);

interface PieBreakdownProps {
  data: BreakdownDatum[];
}

const PieBreakdown = ({ data }: PieBreakdownProps) => {
  if (data.length === 0) {
    return <EmptyMessage height={200} />;
  }
  const config = buildPerSliceConfig(data);
  // Tighter ring + sliceless single-category case still reads as a stat.
  const isSingleSlice = data.length === 1;
  return (
    <EvilPieChart
      className="h-[200px] w-full"
      chartConfig={config}
      data={data}
      dataKey="value"
      nameKey="name"
      innerRadius={isSingleSlice ? "0%" : "40%"}
      outerRadius="80%"
      paddingAngle={isSingleSlice ? 0 : 2}
      showLabels={!isSingleSlice}
      labelKey="value"
    />
  );
};

interface SourcesBarProps {
  data: BreakdownDatum[];
}

const SourcesBar = ({ data }: SourcesBarProps) => {
  if (data.length === 0) {
    return <EmptyMessage height={200} />;
  }
  return (
    <EvilBarChart
      className="h-[200px] w-full"
      chartConfig={barChartConfig}
      data={data}
      xDataKey="name"
      yDataKey="value"
      layout="horizontal"
      barVariant="gradient"
      hideLegend
    />
  );
};

interface CountriesTableProps {
  data: BreakdownDatum[];
}

const CountriesTable = ({ data }: CountriesTableProps) => {
  if (data.length === 0) {
    return <EmptyMessage height={200} />;
  }
  const top = data.slice(0, 10);
  return (
    <div className="max-h-[220px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Country</TableHead>
            <TableHead className="text-right">Visits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.map((entry) => (
            <TableRow key={entry.name}>
              <TableCell className="font-medium">{entry.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {numberFormatter.format(entry.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const BreakdownCards = ({ metrics }: BreakdownCardsProps) => {
  const devices = breakdownToArray(metrics.devices);
  const sources = collapseToTopN(breakdownToArray(metrics.sources), TOP_N_SOURCES);
  const countries = breakdownToArray(metrics.countries);
  const browsers = breakdownToArray(metrics.browsers);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="bg-transparent ring-0">
        <CardHeader>
          <CardTitle>Devices</CardTitle>
        </CardHeader>
        <CardContent>
          <PieBreakdown data={devices} />
        </CardContent>
      </Card>
      <Card className="bg-transparent ring-0">
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <SourcesBar data={sources} />
        </CardContent>
      </Card>
      <Card className="bg-transparent ring-0">
        <CardHeader>
          <CardTitle>Countries</CardTitle>
        </CardHeader>
        <CardContent>
          <CountriesTable data={countries} />
        </CardContent>
      </Card>
      <Card className="bg-transparent ring-0">
        <CardHeader>
          <CardTitle>Browsers</CardTitle>
        </CardHeader>
        <CardContent>
          <PieBreakdown data={browsers} />
        </CardContent>
      </Card>
    </div>
  );
};
