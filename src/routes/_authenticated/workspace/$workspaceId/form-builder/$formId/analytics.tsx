import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  AppleLineIcon,
  ChromeOsIcon,
  DesktopLineIcon,
  DirectArrowIcon,
  LinuxIcon,
  MobileLineIcon,
  TabAnswersIcon,
  TabDropoffsIcon,
  TabletLineIcon,
  TabVisitsIcon,
  WindowsIcon,
} from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFormInsights } from "@/lib/server-fn/analytics";
import { numberFormatter } from "@/lib/analytics/format";
import type { CountBreakdown, FormInsightsMetrics, TimeRangeFilter } from "@/types/analytics";
import { cn } from "@/lib/utils";

// ── Range options (Figma "Last 7 days" dropdown) ───────────────────────────
const RANGE_OPTIONS: { value: Extract<TimeRangeFilter, `last_${string}`>; label: string }[] = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
];

// City → country (for flag emoji on the Cities breakdown; cities carry no ISO code).
const CITY_COUNTRY: Record<string, string> = {
  Hamburg: "DE",
  "New Delhi": "IN",
  Chennai: "IN",
  Brisbane: "AU",
  Shanghai: "CN",
  Geelong: "AU",
  "Xi'an": "CN",
  Toronto: "CA",
  Paris: "FR",
};

// ── Icon resolution (browser/OS/source brand glyphs from Figma; flags via emoji) ──
// Raster brand logos (Figma image fills; SVG export is blank) — kept as <img>, not SVG components.
const BRAND_ICON: Record<string, string> = {
  chrome: "/icons/analytics/chrome.png",
  brave: "/icons/analytics/brave.png",
  arc: "/icons/analytics/arc.png",
  opera: "/icons/analytics/opera.png",
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

const lineCls = "size-4 shrink-0 text-muted-foreground";

const resolveIcon = (kind: StatKind, key: string): React.ReactNode => {
  const k = key.toLowerCase();
  if (kind === "countries") {
    return <span className="text-[14px] leading-none">{flagEmoji(key)}</span>;
  }
  if (kind === "cities") {
    const cc = CITY_COUNTRY[key];
    return <span className="text-[14px] leading-none">{cc ? flagEmoji(cc) : flagEmoji(key)}</span>;
  }
  if (kind === "devices") {
    if (k.includes("mobile")) return <MobileLineIcon className={lineCls} />;
    if (k.includes("tablet")) return <TabletLineIcon className={lineCls} />;
    return <DesktopLineIcon className={lineCls} />;
  }
  if (kind === "sources") {
    if (k.includes("linkedin")) return brandImg(BRAND_ICON.linkedin, "LinkedIn");
    if (k.includes("notion")) return brandImg(BRAND_ICON.notion, "Notion");
    if (k.includes("direct")) return <DirectArrowIcon className={lineCls} />;
    return <Globe className={lineCls} />;
  }
  // OS rows use vector brand glyphs (from icons.tsx); Apple is currentColor (no baked bg).
  if (kind === "os") {
    if (k.includes("mac") || k === "ios") return <AppleLineIcon className={lineCls} />;
    if (k.includes("windows")) return <WindowsIcon className={lineCls} />;
    if (k.includes("chrome")) return <ChromeOsIcon className={lineCls} />;
    if (k.includes("linux")) return <LinuxIcon className={lineCls} />;
  }
  // Other browsers match a raster brand image.
  const match = Object.keys(BRAND_ICON).find((brand) => k.includes(brand));
  if (match) return brandImg(BRAND_ICON[match], key);
  return <Globe className={lineCls} />;
};

const labelFor = (kind: StatKind, key: string): string =>
  kind === "countries" ? countryLabel(key) : key;

// ── Formatting ──────────────────────────────────────────────────────────────

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

// ── Activity chart (custom recharts multi-line, Figma 26835:11656) ───────────
// Mid-luminance brand colors hold their brightness on both light and dark surfaces.
type ActivityPoint = { date: string; visits: number; submissions: number; partial: number };
const ACTIVITY_SERIES = [
  { key: "visits", label: "Visits", color: "#3b82f6" },
  { key: "submissions", label: "Submissions", color: "#22c55e" },
  { key: "partial", label: "Partial", color: "#eab308" },
] as const;

const ActivityTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-popover px-2.5 py-2 shadow-md">
      {ACTIVITY_SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
        return (
          <div key={s.key} className="flex items-center gap-2 py-0.5 text-[13px]">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 pr-4 text-muted-foreground">{s.label}</span>
            <span className="font-medium text-foreground tabular-nums">{v}</span>
          </div>
        );
      })}
    </div>
  );
};

const FormActivityChart = ({ data }: { data: ActivityPoint[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
      {/* Faint dashed horizontal gridlines (Figma gray/100). */}
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-gray-100)" />
      <XAxis
        dataKey="date"
        tickFormatter={formatWeekday}
        tickLine={false}
        axisLine={false}
        tickMargin={10}
        interval={0}
        padding={{ left: 14, right: 14 }}
        tick={{ fill: "var(--color-gray-550, #8c8c8c)", fontSize: 12 }}
      />
      <YAxis hide domain={[0, "auto"]} />
      <Tooltip
        content={<ActivityTooltip />}
        cursor={{ stroke: "var(--color-gray-300)", strokeWidth: 1, strokeDasharray: "4 4" }}
      />
      {ACTIVITY_SERIES.map((s) => (
        <Line
          key={s.key}
          type="linear"
          dataKey={s.key}
          stroke={s.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

// ── Card chrome (rounded-12 border, light/dark via tokens) ──────────────────
// Card surface (Figma light + dark): white in light; in dark a slightly-elevated #1c1c1c over the
// #131313 page (not bg-card #292929 = too light, not gray-0 #131313 = full black) + gray/100 border.
const cardClass =
  "rounded-[12px] border border-[var(--color-gray-100)] bg-gray-0 dark:bg-[#1c1c1c]";

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
  scrollable = false,
}: {
  title: string;
  kind: StatKind;
  data: CountBreakdown;
  /** Countries/Cities (Figma 26835:11865): cap at 250px, scroll the list, fade the bottom edge. */
  scrollable?: boolean;
}) => {
  const rows = useMemo(() => {
    const entries = Object.entries(data ?? {}).filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    return entries.map(([key, value]) => ({ key, value, pct: Math.max(12, (value / max) * 100) }));
  }, [data]);

  return (
    // Figma 26835:11709 / :11865: gray/100 border, gap-14 title→list, pt-14 pb-2 px-1.5.
    <div
      className={cn(
        "bg-gray-0 relative flex flex-col gap-[14px] overflow-hidden rounded-[12px] border border-[var(--color-gray-100)] px-1.5 pt-[14px] pb-2 dark:bg-[#1c1c1c]",
        scrollable && "h-[250px]",
      )}
    >
      <h3 className="px-2 text-[15px] font-medium tracking-[0.02em] text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-2 pb-3 text-[13px] text-muted-foreground">No data yet</p>
      ) : (
        // 3px gap between rows (Figma); when capped, the list scrolls (scrollbar hidden).
        <ul
          className={cn(
            "flex flex-col gap-[3px]",
            scrollable &&
              "min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {rows.map((row) => (
            <li key={row.key} className="relative flex h-7 shrink-0 items-center rounded-lg">
              {/* Proportional bar (Figma Rectangle 41927) — gray/100, rounded-8. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-lg bg-[var(--color-gray-100)]"
                style={{ width: `${row.pct}%` }}
              />
              <div className="relative flex w-full items-center gap-2 px-2">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {resolveIcon(kind, row.key)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] tracking-[0.02em] text-gray-600">
                  {labelFor(kind, row.key)}
                </span>
                <span className="shrink-0 text-[14px] tracking-[0.02em] text-gray-800 tabular-nums">
                  {numberFormatter.format(row.value)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {/* Bottom fade/blur (Figma 26835:11928) — hints at scrollable overflow below. */}
      {scrollable && rows.length > 0 && (
        <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 h-8 rounded-b-[10px] bg-gradient-to-t from-card to-transparent [mask-image:linear-gradient(to_top,black,transparent)] backdrop-blur-[0.5px]" />
      )}
    </div>
  );
};

type AnalyticsTab = "visits" | "answers" | "dropoffs";
const TABS: { id: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
  { id: "visits", label: "Visits", icon: <TabVisitsIcon className="size-4" /> },
  { id: "answers", label: "Answers", icon: <TabAnswersIcon className="size-4" /> },
  { id: "dropoffs", label: "Dropoffs", icon: <TabDropoffsIcon className="size-4" /> },
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

  const breakdowns = {
    sources: metrics?.sources ?? {},
    devices: metrics?.devices ?? {},
    browsers: metrics?.browsers ?? {},
    operatingSystems: metrics?.operatingSystems ?? {},
    countries: metrics?.countries ?? {},
    cities: metrics?.cities ?? {},
  };

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
        {/* Title (Figma 26835:12210) — 18px SemiBold gray-950. font-sans re-binds the wght axis so
            font-semibold actually renders 600 (the inherited fvs wght otherwise pins it to ~450). */}
        <h1 className="font-sans text-[18px] leading-[1.15] font-semibold text-gray-950">
          Analytics
        </h1>

        {/* Tabs (Figma 26835:12159) — shared line-variant Tabs: Base UI slides the indicator between
            tabs (same component + animation as the settings page). gray/200 rail, gray/900 active. */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as AnalyticsTab)} className="mt-5">
          <TabsList
            variant="line"
            size="default"
            className="h-auto! w-full justify-start gap-6 border-gray-200! p-0!"
          >
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="h-8! flex-none gap-2 px-0! font-[420]! tracking-[0.02em] text-gray-600 hover:text-gray-800 data-active:text-gray-950 [&_svg]:size-4"
              >
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
            <TabsIndicator className="bg-gray-950!" />
          </TabsList>
        </Tabs>

        {tab !== "visits" ? (
          <div className="flex h-60 items-center justify-center text-[14px] text-muted-foreground">
            Coming soon
          </div>
        ) : (
          <>
            {/* Sub-toolbar: section label + range + export */}
            <div className="mt-6 flex items-center justify-between gap-3">
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
            <div className="mt-5 flex gap-3">
              <MetricCard
                label="Visits"
                value={numberFormatter.format(metrics?.totalVisits ?? 0)}
              />
              <MetricCard
                label="Submissions"
                value={numberFormatter.format(metrics?.totalSubmissions ?? 0)}
              />
              <MetricCard label="Completion rate" value={`${completionRate}%`} />
              <MetricCard
                label="Avg. time"
                value={formatDuration(metrics?.avgVisitDurationMs ?? 0)}
              />
            </div>

            {/* Activity chart (Figma 26835:11656) — fixed 200px card, gray/100 border. Title 15px
                medium; the series legend lives only in the hover tooltip (no header legend). */}
            <div className="bg-gray-0 mt-3 flex h-[200px] flex-col overflow-hidden rounded-[12px] border border-[var(--color-gray-100)] dark:bg-[#1c1c1c]">
              <h3 className="px-[13px] pt-[13px] text-[15px] font-medium tracking-[0.02em] text-gray-900">
                Form activity over time
              </h3>
              {chartData.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-[14px] text-muted-foreground">
                  {isLoading ? "Loading…" : "No activity for this range"}
                </div>
              ) : (
                <div className="min-h-0 flex-1 pt-2 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none">
                  <FormActivityChart data={chartData} />
                </div>
              )}
            </div>

            {/* Breakdown grid */}
            <div className="mt-5 grid grid-cols-2 gap-5">
              <StatCard title="Sources" kind="sources" data={breakdowns.sources} />
              <StatCard title="Devices" kind="devices" data={breakdowns.devices} />
              <StatCard title="Browsers" kind="browsers" data={breakdowns.browsers} />
              <StatCard title="Operating systems" kind="os" data={breakdowns.operatingSystems} />
              <StatCard title="Countries" kind="countries" data={breakdowns.countries} scrollable />
              <StatCard title="Cities" kind="cities" data={breakdowns.cities} scrollable />
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
