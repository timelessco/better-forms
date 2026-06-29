import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  CircleCheck,
  Download,
  Globe,
  Monitor,
  MousePointerClick,
  Smartphone,
  Tablet,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

import { EvilAreaChart } from "@/components/evilcharts/charts/area-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { getFormInsights } from "@/lib/server-fn/analytics";
import type { CountBreakdown, FormInsightsMetrics, TimeRangeFilter } from "@/types/analytics";
import { cn } from "@/lib/utils";

// ── Range options (Figma "Last 7 days" dropdown) ───────────────────────────
const RANGE_OPTIONS: { value: Extract<TimeRangeFilter, `last_${string}`>; label: string }[] = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
];

// ── Icon resolution (browser/OS/source brand glyphs from Figma; flags via emoji) ──
const BRAND_ICON: Record<string, string> = {
  chrome: "/icons/analytics/chrome.png",
  brave: "/icons/analytics/brave.png",
  arc: "/icons/analytics/arc.png",
  opera: "/icons/analytics/opera.png",
  macos: "/icons/analytics/apple.svg",
  ios: "/icons/analytics/apple.svg",
  windows: "/icons/analytics/windows.svg",
  linux: "/icons/analytics/linux.svg",
  chromeos: "/icons/analytics/chromeos.svg",
  linkedin: "/icons/analytics/linkedin.png",
  notion: "/icons/analytics/notion.png",
};

const brandImg = (src: string, alt: string) => (
  <img src={src} alt={alt} className="size-4 shrink-0 object-contain" />
);

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const isAlpha2 = (code: string) => /^[A-Za-z]{2}$/.test(code);

// ISO alpha-2 → regional-indicator flag emoji.
const flagEmoji = (code: string): string =>
  isAlpha2(code)
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🌐";

const countryLabel = (code: string): string => {
  if (!isAlpha2(code)) return code;
  try {
    return regionNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

type StatKind = "sources" | "devices" | "browsers" | "os" | "countries" | "cities";

const resolveIcon = (kind: StatKind, key: string): React.ReactNode => {
  const k = key.toLowerCase();
  if (kind === "countries" || kind === "cities") {
    return <span className="text-[14px] leading-none">{flagEmoji(key)}</span>;
  }
  if (kind === "devices") {
    const cls = "size-4 shrink-0 text-muted-foreground";
    if (k.includes("mobile")) return <Smartphone className={cls} />;
    if (k.includes("tablet")) return <Tablet className={cls} />;
    return <Monitor className={cls} />;
  }
  if (kind === "sources") {
    if (k.includes("linkedin")) return brandImg(BRAND_ICON.linkedin, "LinkedIn");
    if (k.includes("notion")) return brandImg(BRAND_ICON.notion, "Notion");
    if (k.includes("direct"))
      return <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />;
    return <Globe className="size-4 shrink-0 text-muted-foreground" />;
  }
  // browsers + os: match a brand glyph by substring, else a globe.
  const match = Object.keys(BRAND_ICON).find((brand) => k.includes(brand));
  if (match) return brandImg(BRAND_ICON[match], key);
  return <Globe className="size-4 shrink-0 text-muted-foreground" />;
};

const labelFor = (kind: StatKind, key: string): string =>
  kind === "countries" || kind === "cities" ? countryLabel(key) : key;

// ── Formatting ──────────────────────────────────────────────────────────────
const numberFmt = new Intl.NumberFormat("en-US");

const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const formatWeekday = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : weekdayFmt.format(parsed);
};

// ── Chart config (fixed mid-luminance colors — hold brightness across themes) ──
const activityChartConfig = {
  visits: {
    label: "Visits",
    colors: { light: ["oklch(0.62 0.18 250)"], dark: ["oklch(0.62 0.18 250)"] },
  },
  submissions: {
    label: "Submissions",
    colors: { light: ["oklch(0.7 0.18 145)"], dark: ["oklch(0.7 0.18 145)"] },
  },
  partial: {
    label: "Partial",
    colors: { light: ["oklch(0.78 0.16 85)"], dark: ["oklch(0.78 0.16 85)"] },
  },
} satisfies ChartConfig;

// ── Card chrome (rounded-12 border, light/dark via tokens) ──────────────────
const cardClass = "rounded-[12px] border border-border bg-card";

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className={cn(cardClass, "flex h-21 flex-1 flex-col justify-between p-3")}>
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <span className="text-[18px] font-semibold tracking-[-0.01em] text-foreground tabular-nums">
      {value}
    </span>
  </div>
);

const StatCard = ({
  title,
  kind,
  data,
}: {
  title: string;
  kind: StatKind;
  data: CountBreakdown;
}) => {
  const rows = useMemo(() => {
    const entries = Object.entries(data ?? {}).filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    return entries.map(([key, value]) => ({ key, value, pct: Math.max(4, (value / max) * 100) }));
  }, [data]);

  return (
    <div className={cn(cardClass, "flex flex-col p-3.5")}>
      <h3 className="px-2 pb-2 text-[14px] font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-[13px] text-muted-foreground">No data yet</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <li key={row.key} className="relative flex h-7 items-center">
              {/* Proportional bar (Figma Rectangle 41927) */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-md bg-secondary"
                style={{ width: `${row.pct}%` }}
              />
              <div className="relative flex w-full items-center gap-2 px-2">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {resolveIcon(kind, row.key)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                  {labelFor(kind, row.key)}
                </span>
                <span className="shrink-0 text-[14px] text-muted-foreground tabular-nums">
                  {numberFmt.format(row.value)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

type AnalyticsTab = "visits" | "answers" | "dropoffs";
const TABS: { id: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
  { id: "visits", label: "Visits", icon: <MousePointerClick className="size-4" /> },
  { id: "answers", label: "Answers", icon: <CircleCheck className="size-4" /> },
  { id: "dropoffs", label: "Dropoffs", icon: <TrendingDown className="size-4" /> },
];

const AnalyticsPage = () => {
  const { formId } = Route.useParams();
  const [range, setRange] = useState<RangeValue>("last_7_days");
  const [tab, setTab] = useState<AnalyticsTab>("visits");

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", formId, range],
    queryFn: () => getFormInsights({ data: { formId, filter: range } }),
    staleTime: 30_000,
  });

  const metrics: FormInsightsMetrics | undefined = data;

  const chartData = useMemo(
    () =>
      (metrics?.dailyData ?? []).map((d) => ({
        date: d.date,
        visits: d.visits,
        submissions: d.submissions,
        partial: Math.max(0, d.visits - d.submissions),
      })),
    [metrics?.dailyData],
  );

  const completionRate =
    metrics && metrics.totalVisits > 0
      ? Math.round((metrics.totalSubmissions / metrics.totalVisits) * 100)
      : 0;

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "Last 7 days";

  const handleExport = (format: "csv" | "pdf" | "excel") => {
    if (!metrics) return;
    if (format !== "csv") {
      toast.message(`${format.toUpperCase()} export coming soon`);
      return;
    }
    const lines = [
      ["Metric", "Value"],
      ["Visits", String(metrics.totalVisits)],
      ["Submissions", String(metrics.totalSubmissions)],
      ["Completion rate", `${completionRate}%`],
      ["Avg. time", formatDuration(metrics.avgVisitDurationMs)],
    ];
    const csv = lines.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${formId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[760px] px-6 py-6">
        {/* Title */}
        <h1 className="text-[18px] font-semibold text-foreground">Analytics</h1>

        {/* Tabs (Figma 26835:12130) — 16px icon + label, active underline */}
        <div className="mt-4 flex items-center gap-6 border-b border-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {tab !== "visits" ? (
          <div className="flex h-60 items-center justify-center text-[14px] text-muted-foreground">
            Coming soon
          </div>
        ) : (
          <>
            {/* Sub-toolbar: section label + range + export */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-foreground">Visits</span>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        suffix={<ChevronDown className="size-4 shrink-0" />}
                        className="h-7 rounded-lg bg-secondary px-2 font-case text-base font-[450] tracking-[0.14px] text-gray-800 hover:bg-secondary/80"
                      />
                    }
                  >
                    {rangeLabel}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    {RANGE_OPTIONS.map((r) => (
                      <DropdownMenuItem key={r.value} onClick={() => setRange(r.value)}>
                        {r.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        size="sm"
                        prefix={<Download className="size-4 shrink-0" strokeWidth={2} />}
                        suffix={<ChevronDown className="size-4 shrink-0" />}
                        className="h-7 rounded-lg font-case text-base tracking-[0.14px]"
                      />
                    }
                  >
                    Export
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => handleExport("csv")}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Metric cards */}
            <div className="mt-4 flex gap-3">
              <MetricCard label="Visits" value={numberFmt.format(metrics?.totalVisits ?? 0)} />
              <MetricCard
                label="Submissions"
                value={numberFmt.format(metrics?.totalSubmissions ?? 0)}
              />
              <MetricCard label="Completion rate" value={`${completionRate}%`} />
              <MetricCard
                label="Avg. time"
                value={formatDuration(metrics?.avgVisitDurationMs ?? 0)}
              />
            </div>

            {/* Activity chart */}
            <div className={cn(cardClass, "mt-3 p-3.5")}>
              <h3 className="px-2 text-[14px] font-semibold text-foreground">
                Form activity over time
              </h3>
              {chartData.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-[14px] text-muted-foreground">
                  {isLoading ? "Loading…" : "No activity for this range"}
                </div>
              ) : (
                <EvilAreaChart
                  className="h-[200px] w-full"
                  chartConfig={activityChartConfig}
                  data={chartData}
                  xDataKey="date"
                  curveType="monotone"
                  areaVariant="gradient"
                  strokeVariant="solid"
                  xAxisProps={{ tickFormatter: formatWeekday }}
                />
              )}
            </div>

            {/* Breakdown grid */}
            <div className="mt-5 grid grid-cols-2 gap-5">
              <StatCard title="Sources" kind="sources" data={metrics?.sources ?? {}} />
              <StatCard title="Devices" kind="devices" data={metrics?.devices ?? {}} />
              <StatCard title="Browsers" kind="browsers" data={metrics?.browsers ?? {}} />
              <StatCard
                title="Operating systems"
                kind="os"
                data={metrics?.operatingSystems ?? {}}
              />
              <StatCard title="Countries" kind="countries" data={metrics?.countries ?? {}} />
              <StatCard title="Cities" kind="cities" data={metrics?.cities ?? {}} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/analytics",
)({
  component: AnalyticsPage,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  ssr: "data-only",
});
