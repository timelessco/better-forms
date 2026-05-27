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
import {
  Facebook,
  Github,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Slack,
  Twitter,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { numberFormatter } from "@/lib/analytics/format";
import type { CountBreakdown, FormInsightsMetrics } from "@/types/analytics";

interface BreakdownCardsProps {
  metrics: FormInsightsMetrics;
}

interface BreakdownDatum extends Record<string, unknown> {
  name: string;
  value: number;
}

// Fixed OKLCH palette — `--chart-N` tokens flip dark-blue in dark mode (dark blobs on dark card). These hold luminance across themes.
const PALETTE: string[] = [
  "oklch(0.62 0.18 250)", // blue
  "oklch(0.7 0.18 145)", // green
  "oklch(0.72 0.16 65)", // amber
  "oklch(0.65 0.22 25)", // red-orange
  "oklch(0.6 0.2 305)", // purple
];

const MAX_TABLE_ROWS = 10;

// Country breakdown keys are ISO-3166 alpha-2 codes (e.g. "IN", "NL").
const REGION_CODE_RE = /^[A-Za-z]{2}$/;
const REGIONAL_INDICATOR_BASE = 0x1f1e6; // 🇦
const ASCII_A = 65;
const countryDisplayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(undefined, { type: "region" })
    : null;

/** Flag emoji for a 2-letter country code, or "" for non-region keys. */
const countryFlag = (code: string): string => {
  if (!REGION_CODE_RE.test(code)) {
    return "";
  }
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((ch) => REGIONAL_INDICATOR_BASE + ch.charCodeAt(0) - ASCII_A),
  );
};

/** Localized country name for a code (falls back to the raw key). */
const countryLabel = (code: string): string => {
  if (!REGION_CODE_RE.test(code)) {
    return code;
  }
  try {
    return countryDisplayNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

const titleCase = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

const breakdownToArray = (breakdown: CountBreakdown): BreakdownDatum[] =>
  Object.entries(breakdown)
    .flatMap(([name, value]) => (value > 0 ? [{ name, value }] : []))
    .sort((a, b) => b.value - a.value);

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

interface BreakdownTableProps {
  data: BreakdownDatum[];
  /** Header for the label column, e.g. "Country" or "Source". */
  columnLabel: string;
  /** Custom renderer for a row's name cell (e.g. flag + country name). */
  renderName?: (name: string) => React.ReactNode;
}

const BreakdownTable = ({ data, columnLabel, renderName }: BreakdownTableProps) => {
  if (data.length === 0) {
    return <EmptyMessage height={200} />;
  }
  const top = data.slice(0, MAX_TABLE_ROWS);
  return (
    <div className="max-h-[220px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{columnLabel}</TableHead>
            <TableHead className="text-right">Visits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.map((entry) => (
            <TableRow key={entry.name}>
              <TableCell className="font-medium">
                {renderName ? renderName(entry.name) : entry.name}
              </TableCell>
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

const renderCountryName = (code: string): React.ReactNode => {
  const flag = countryFlag(code);
  return (
    <span className="flex items-center gap-2">
      {flag ? (
        <span aria-hidden="true" className="text-base leading-none">
          {flag}
        </span>
      ) : null}
      <span className="truncate">{countryLabel(code)}</span>
    </span>
  );
};

// lucide ships brand marks for these; everything else gets a neutral fallback.
const SOURCE_ICONS: Record<string, LucideIcon> = {
  twitter: Twitter,
  facebook: Facebook,
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  github: Github,
  slack: Slack,
};

const renderSourceName = (name: string): React.ReactNode => {
  const Icon = SOURCE_ICONS[name] ?? (name === "direct" ? Globe : Link2);
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{titleCase(name)}</span>
    </span>
  );
};

export const BreakdownCards = ({ metrics }: BreakdownCardsProps) => {
  const devices = breakdownToArray(metrics.devices);
  const sources = breakdownToArray(metrics.sources);
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
          <BreakdownTable data={sources} columnLabel="Source" renderName={renderSourceName} />
        </CardContent>
      </Card>
      <Card className="bg-transparent ring-0">
        <CardHeader>
          <CardTitle>Countries</CardTitle>
        </CardHeader>
        <CardContent>
          <BreakdownTable data={countries} columnLabel="Country" renderName={renderCountryName} />
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
