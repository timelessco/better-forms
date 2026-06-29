import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Globe, Monitor, Smartphone, Tablet } from "lucide-react";
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

// ── Activity chart (custom recharts multi-line, Figma 26835:11656) ───────────
// Mid-luminance brand colors hold their brightness on both light and dark surfaces.
type ActivityPoint = { date: string; visits: number; submissions: number; partial: number };
const ACTIVITY_SERIES = [
  { key: "visits", label: "Visits", color: "#3b82f6" },
  { key: "submissions", label: "Submissions", color: "#22c55e" },
  { key: "partial", label: "Partial", color: "#eab308" },
] as const;

const ActivityLegend = () => (
  <div className="flex items-center gap-4">
    {ACTIVITY_SERIES.map((s) => (
      <div key={s.key} className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
        <span className="text-[13px] text-muted-foreground">{s.label}</span>
      </div>
    ))}
  </div>
);

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
  <ResponsiveContainer width="100%" height={180}>
    <LineChart data={data} margin={{ top: 8, right: 4, bottom: 4, left: 4 }}>
      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-border)" />
      <XAxis
        dataKey="date"
        tickFormatter={formatWeekday}
        tickLine={false}
        axisLine={false}
        tickMargin={12}
        minTickGap={8}
        tick={{ fill: "var(--color-muted-foreground)", fontSize: 13 }}
      />
      <YAxis hide domain={[0, "auto"]} />
      <Tooltip
        content={<ActivityTooltip />}
        cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
      />
      {ACTIVITY_SERIES.map((s) => (
        <Line
          key={s.key}
          type="monotone"
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

// Tab icons — exact Figma glyphs (26844:12431 / :12407 / :12419), currentColor so they follow the
// tab text color (active gray-900 / inactive gray-600) in both light + dark.
const iconProps = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none" as const };
const TabVisitsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M7.80303 5.92203H11.3485C13.089 5.92203 14.5 7.33301 14.5 9.07351V9.52985C14.5 12.6501 11.9705 15.1796 8.85028 15.1796C6.75269 15.1796 4.82773 14.0174 3.85078 12.1612L1.5 7.69472L2.09139 6.95545C2.63504 6.27592 3.62665 6.16574 4.30622 6.7094L5.04545 7.30078V2.17957C5.04545 1.41808 5.66276 0.800781 6.42424 0.800781C7.18573 0.800781 7.80303 1.41808 7.80303 2.17957V5.92203Z"
      fill="currentColor"
      fillOpacity="0.12"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
    />
  </svg>
);
const TabAnswersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15Z"
      fill="currentColor"
      fillOpacity="0.12"
    />
    <path
      d="M10.2703 6.10811L6.86487 10.2703L5.35135 8.75676M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const TabDropoffsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...iconProps} xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M2 5.2C2 4.0799 2 3.51984 2.21799 3.09202C2.40973 2.71569 2.71569 2.40973 3.09202 2.21799C3.51984 2 4.0799 2 5.2 2H10.8C11.9201 2 12.4802 2 12.908 2.21799C13.2843 2.40973 13.5903 2.71569 13.782 3.09202C14 3.51984 14 4.0799 14 5.2V10.8C14 11.9201 14 12.4802 13.782 12.908C13.5903 13.2843 13.2843 13.5903 12.908 13.782C12.4802 14 11.9201 14 10.8 14H5.2C4.0799 14 3.51984 14 3.09202 13.782C2.71569 13.5903 2.40973 13.2843 2.21799 12.908C2 12.4802 2 11.9201 2 10.8V5.2Z"
      fill="currentColor"
      fillOpacity="0.12"
    />
    <path
      d="M11.3333 10L7.71046 6.37712C7.57845 6.24512 7.51245 6.17912 7.43634 6.15439C7.36939 6.13263 7.29728 6.13263 7.23033 6.15439C7.15422 6.17912 7.08822 6.24512 6.95621 6.37712L5.71046 7.62288C5.57845 7.75488 5.51245 7.82088 5.43634 7.84561C5.36939 7.86737 5.29728 7.86737 5.23033 7.84561C5.15422 7.82088 5.08822 7.75488 4.95621 7.62288L2 4.66667M11.3333 7.33333V10H8.66667M5.2 14H10.8C11.9201 14 12.4802 14 12.908 13.782C13.2843 13.5903 13.5903 13.2843 13.782 12.908C14 12.4802 14 11.9201 14 10.8V5.2C14 4.0799 14 3.51984 13.782 3.09202C13.5903 2.71569 13.2843 2.40973 12.908 2.21799C12.4802 2 11.9201 2 10.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V10.8C2 11.9201 2 12.4802 2.21799 12.908C2.40973 13.2843 2.71569 13.5903 3.09202 13.782C3.51984 14 4.0799 14 5.2 14Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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

        {/* Tabs (Figma 26835:12159) — 24px gap, gray/200 baseline rule; active = gray-900 underline +
            text, inactive = gray-600. 16px Figma icons (currentColor). pt-0.5 pb-1.5 within h-8. */}
        <div className="mt-5 flex h-8 items-center gap-6 border-b border-[var(--color-gray-200)]">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px flex h-full items-center justify-center gap-2 border-b pt-0.5 pb-1.5 text-[14px] font-[420] tracking-[0.02em] transition-colors [&_svg]:size-4",
                  active
                    ? "border-foreground text-gray-950"
                    : "border-transparent text-gray-600 hover:text-gray-800",
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

            {/* Activity chart (Figma 26835:11656): title left, legend right, multi-line below. */}
            <div className={cn(cardClass, "mt-3 p-3.5")}>
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Form activity over time
                </h3>
                <ActivityLegend />
              </div>
              {chartData.length === 0 ? (
                <div className="flex h-[180px] items-center justify-center text-[14px] text-muted-foreground">
                  {isLoading ? "Loading…" : "No activity for this range"}
                </div>
              ) : (
                <div className="mt-3">
                  <FormActivityChart data={chartData} />
                </div>
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
