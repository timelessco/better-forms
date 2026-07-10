import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { toast } from "sonner";

import {
  AnswerDonut,
  FormActivityChart,
  MultiPageDropoffFunnelChart,
} from "@/components/form-builder/analytics/charts";
import type { DonutDatum } from "@/components/form-builder/analytics/charts";
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
  CheckIcon,
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
import { ExportMenu, ToolbarPill } from "@/components/ui/route-toolbar";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFormAnswers, getFormDropoff, getFormInsights } from "@/lib/server-fn/analytics";
import { numberFormatter } from "@/lib/analytics/format";
import {
  analyticsBiggestDropoff,
  analyticsBreakdowns,
  analyticsChartData,
  analyticsCompletionRate,
  analyticsDropoffRows,
  analyticsTotalDropoffs,
  fillRate,
  mostSkippedQuestion,
  visibleAnswerQuestions,
} from "@/lib/analytics/metrics";
import type {
  CountBreakdown,
  FormAnswerMetrics,
  FormInsightsMetrics,
  QuestionAnswerSummary,
  QuestionDropoffMetrics,
} from "@/types/analytics";
import { cn } from "@/lib/utils";

// ── Range options (Figma "Last 7 days" dropdown) ───────────────────────────
type RangeValue = "today" | "yesterday" | "last_7_days" | "last_30_days" | "last_year" | "all_time";

const PRESET_OPTIONS: { value: RangeValue; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_year", label: "Last year" },
  { value: "all_time", label: "All time" },
];

// Menu-item label: Figma 13px/450/0.13px/gray-800 (text-sm = 13px on this scale). font-case is on
// the popup. Overrides the design-system item only where it measurably differs from the spec.
const RANGE_ITEM_CLS = "justify-between font-[450] tracking-[0.13px] text-gray-800";

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
  // No submissions in range → no completion time (a real completion is never 0s).
  if (!ms || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// ── Card chrome (rounded-12 border, light/dark via tokens) ──────────────────
// Card surface (Figma light + dark): white in light; in dark a slightly-elevated #1c1c1c over the
// #131313 page (not bg-card #292929 = too light, not gray-0 #131313 = full black) + gray/100 border.
const cardClass =
  "rounded-[12px] border border-[var(--color-gray-100)] bg-gray-0 dark:bg-[#1c1c1c]";

// Bottom fade that dissolves the last scrollable row into the card surface (Figma 27015:12198).
const ScrollFade = () => (
  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent backdrop-blur-[0.5px] dark:from-[#1c1c1c]" />
);

// Proportional-bar list row (Figma Rectangle 41927) — gray/100 bar behind a label/value pair, with an
// optional leading icon. `widthPct` is pre-clamped by the caller (min-width floor differs per card).
const ProportionalBarRow = ({
  label,
  value,
  widthPct,
  icon,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  widthPct: number;
  icon?: React.ReactNode;
}) => (
  <li className="relative flex h-7 shrink-0 items-center rounded-lg">
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 rounded-lg bg-[var(--color-gray-100)]"
      style={{ width: `${widthPct}%` }}
    />
    <div className="relative flex w-full items-center gap-2 px-2">
      {icon != null && (
        <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[14px] tracking-[0.02em] text-gray-600">
        {label}
      </span>
      <span className="shrink-0 text-[14px] tracking-[0.02em] text-gray-800 tabular-nums">
        {value}
      </span>
    </div>
  </li>
);

// `hint` is a muted note (e.g. "49% skip rate"); `trend` is a colored vs-prior delta (Figma:
// green = good, red = bad). Only one is shown — trend takes precedence when present.
type Trend = { text: string; tone: "good" | "bad" };
const MetricCard = ({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: Trend;
}) => (
  <div className={cn(cardClass, "flex h-21 flex-1 flex-col justify-between p-3")}>
    <span className="text-[13px] text-muted-foreground">{label}</span>
    <span className="flex items-baseline gap-2">
      {/* Figma value style (uniform across cards): Inter 18px / wght 540 / lh1.15 / +0.36px /
          gray-900. font-sans rebinds the weight axis so font-[540] actually renders. */}
      <span className="font-sans text-[18px] leading-[1.15] font-[540] tracking-[0.36px] text-gray-900 tabular-nums">
        {value}
      </span>
      {trend ? (
        <span
          className={cn(
            "text-[13px] tabular-nums",
            trend.tone === "good" ? "text-emerald-600" : "text-red-500",
          )}
        >
          {trend.text}
        </span>
      ) : hint ? (
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      ) : null}
    </span>
  </div>
);

// Build a signed "+4.2%" / "−3%" trend. `goodWhenUp` flips the color semantics (more submissions =
// good/green; more dropoffs = bad/red). null delta → no hint.
const pctTrend = (delta: number | null, goodWhenUp: boolean): Trend | undefined => {
  if (delta == null) return undefined;
  const up = delta > 0;
  return { text: `${up ? "+" : ""}${delta}%`, tone: up === goodWhenUp ? "good" : "bad" };
};

// Avg-time delta (ms): negative = faster = good (Figma "18s faster"). 0 / null → no hint.
const durationTrend = (deltaMs: number | null): Trend | undefined => {
  if (deltaMs == null || deltaMs === 0) return undefined;
  const seconds = Math.round(Math.abs(deltaMs) / 1000);
  if (seconds === 0) return undefined;
  const faster = deltaMs < 0;
  return { text: `${seconds}s ${faster ? "faster" : "slower"}`, tone: faster ? "good" : "bad" };
};

// ── Per-question bar panels (Figma 26992:11281) ─────────────────────────────
// Proportional-bar rows (no leading icon), bar width = value / max. Used by both "Dropoff per
// question" (% value) and "Time per question" (seconds). Capped height + bottom fade for overflow.
type QuestionBarRow = { label: string; value: number };
const QuestionBarListCard = ({
  title,
  rows,
  format,
  className,
}: {
  title: string;
  rows: QuestionBarRow[];
  format: (value: number) => string;
  className?: string;
}) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div
      className={cn(
        cardClass,
        "relative flex h-[210px] flex-col gap-[14px] overflow-hidden px-1.5 pt-[14px] pb-2",
        className,
      )}
    >
      <h3 className="px-2 text-[15px] font-medium tracking-[0.02em] text-gray-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-2 pb-3 text-[13px] text-muted-foreground">No data yet</p>
      ) : (
        <ul className="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-[3px] overflow-y-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {rows.map((row, i) => (
            <ProportionalBarRow
              key={i}
              label={row.label}
              value={format(row.value)}
              widthPct={Math.max(12, (row.value / max) * 100)}
            />
          ))}
        </ul>
      )}
      {rows.length > 0 && <ScrollFade />}
    </div>
  );
};

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
        cardClass,
        "relative flex flex-col gap-[14px] overflow-hidden px-1.5 pt-[14px] pb-2",
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
            <ProportionalBarRow
              key={row.key}
              icon={resolveIcon(kind, row.key)}
              label={labelFor(kind, row.key)}
              value={numberFormatter.format(row.value)}
              widthPct={row.pct}
            />
          ))}
        </ul>
      )}
      {/* Bottom fade/blur (Figma 26835:11928) — hints at scrollable overflow below. */}
      {scrollable && rows.length > 0 && <ScrollFade />}
    </div>
  );
};

// ── Answer cards (Answers tab, Figma 26844:15323) ───────────────────────────
const answerCardClass = cn(cardClass, "p-[14px]");
// Render shape comes from the server's `analysis` discriminator: `choice` → donut, everything
// else (domain/length/presence/raw) → bar list. Rating/scale donuts use the gold palette.
const RATING_TYPES = new Set(["Rating", "LinearScale"]);
const GOLD_PALETTE = ["#fcca3f", "#f2b202", "#d99800", "#b18202", "#8a6500"];

const AnswerDonutCard = ({ q }: { q: QuestionAnswerSummary }) => (
  <div className={cn(answerCardClass, "flex flex-col items-center gap-[14px]")}>
    <h3 className="w-full truncate text-[14px] font-medium tracking-[0.14px] text-gray-900">
      {q.label}
    </h3>
    <AnswerDonut
      data={q.distribution as DonutDatum[]}
      total={q.answered}
      unit="answers"
      palette={RATING_TYPES.has(q.fieldType) ? GOLD_PALETTE : undefined}
    />
  </div>
);

const AnswerBarCard = ({ q, unit }: { q: QuestionAnswerSummary; unit: string }) => {
  const sum = q.distribution.reduce((acc, d) => acc + d.value, 0) || 1;
  return (
    <div className={cn(answerCardClass, "relative flex flex-col gap-3 overflow-hidden")}>
      <div className="flex flex-col gap-1">
        <h3 className="truncate text-[14px] font-medium tracking-[0.14px] text-gray-900">
          {q.label}
        </h3>
        <p className="text-[13px] text-gray-500">
          {numberFormatter.format(q.answered)} {unit}
        </p>
      </div>
      <ul className="flex max-h-[120px] [scrollbar-width:none] flex-col gap-[3px] overflow-y-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {q.distribution.map((d, i) => {
          const pct = Math.round((d.value / sum) * 100);
          return (
            <ProportionalBarRow
              key={i}
              label={d.label}
              value={`${pct}%`}
              widthPct={Math.max(8, pct)}
            />
          );
        })}
      </ul>
      {q.distribution.length > 4 && <ScrollFade />}
    </div>
  );
};

type AnalyticsTab = "visits" | "answers" | "dropoffs";
const TABS: { id: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
  { id: "visits", label: "Visits", icon: <TabVisitsIcon className="size-4" /> },
  { id: "answers", label: "Answers", icon: <TabAnswersIcon className="size-4" /> },
  { id: "dropoffs", label: "Dropoffs", icon: <TabDropoffsIcon className="size-4" /> },
];

// Range submenu — pick a start + end on a range calendar (future dates disabled; the calendar's
// range mode guarantees end ≥ start). Apply commits YYYY-MM-DD strings and closes the whole menu.
// Uses an inline panel pattern (like block-menu.tsx) instead of a nested submenu popup, so the
// calendar inherits CSS variables correctly in dark mode.
// Section label + range dropdown + export menu — shared by the Visits & Dropoffs tabs.
const SectionToolbar = ({
  label,
  range,
  rangeLabel,
  onSelectRange,
  onExport,
  // viewMode,
  // onSelectViewMode,
}: {
  label: string;
  range: RangeValue;
  rangeLabel: string;
  onSelectRange: (value: RangeValue) => void;
  onExport: (format: "csv" | "pdf" | "excel") => void;
  viewMode?: "list" | "chart";
  onSelectViewMode?: (mode: "list" | "chart") => void;
}) => (
  <div className="mt-6 flex items-center justify-between gap-3">
    <span className="text-[15px] font-semibold text-foreground">{label}</span>
    <div className="flex items-center gap-2">
      {/* {viewMode && onSelectViewMode && (
        <Tabs
          value={viewMode}
          onValueChange={(val) => onSelectViewMode(val as "list" | "chart")}
          className="mr-1 flex-row!"
        >
          <TabsList
            variant="default"
            size="sm"
            className="h-7! flex-row! rounded-lg bg-secondary! p-[2px]!"
          >
            <TabsTrigger
              value="list"
              className="h-6! px-3 font-case text-[12px] font-[450] tracking-[0.13px] text-gray-600 data-active:text-gray-950"
            >
              List
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              className="h-6! px-3 font-case text-[12px] font-[450] tracking-[0.13px] text-gray-600 data-active:text-gray-950"
            >
              Chart
            </TabsTrigger>
            <TabsIndicator className="bg-surface! shadow-6xs!" />
          </TabsList>
        </Tabs>
      )} */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <ToolbarPill
              className="pr-2 pl-2.5"
              suffix={<ChevronDown className="size-4 shrink-0" />}
            />
          }
        >
          {rangeLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {PRESET_OPTIONS.map((r) => (
            <DropdownMenuItem
              key={r.value}
              className={RANGE_ITEM_CLS}
              onClick={() => onSelectRange(r.value)}
            >
              {r.label}
              {range === r.value && <CheckIcon className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ExportMenu
        onExport={onExport}
        trigger={
          <Button
            size="sm"
            suffix={<ChevronDown className="size-4 shrink-0" />}
            className="h-7 rounded-lg font-case text-base tracking-[0.14px]"
          />
        }
      >
        Export
      </ExportMenu>
    </div>
  </div>
);

const AnalyticsPage = () => {
  const { formId } = Route.useParams();
  const [range, setRange] = useState<RangeValue>("last_7_days");
  const [tab, setTab] = useState<AnalyticsTab>("visits");

  // Server-fn range args + a stable query-key fragment.
  const rangeArgs = { filter: range };

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", formId, rangeArgs],
    queryFn: () => getFormInsights({ data: { formId, ...rangeArgs } }),
    staleTime: 30_000,
  });

  const metrics: FormInsightsMetrics | undefined = data;

  const chartData = useMemo(() => analyticsChartData(metrics), [metrics]);
  const completionRate = analyticsCompletionRate(metrics);
  const breakdowns = useMemo(() => analyticsBreakdowns(metrics), [metrics]);

  // Dropoff data (Dropoffs tab) — fetched only when that tab is active.
  const { data: dropoffData, isLoading: dropoffLoading } = useQuery({
    queryKey: ["analytics-dropoff", formId, rangeArgs],
    queryFn: () => getFormDropoff({ data: { formId, ...rangeArgs } }),
    staleTime: 30_000,
    enabled: tab === "dropoffs",
  });
  const dropoff: QuestionDropoffMetrics | undefined = dropoffData;
  const [viewModeOverride, setViewModeOverride] = useState<"list" | "chart" | null>(null);
  const hasPages = dropoff?.steps && dropoff.steps.length > 1;
  const viewMode = viewModeOverride ?? (hasPages ? "chart" : "list");

  const dropoffRows = useMemo(() => analyticsDropoffRows(dropoff), [dropoff]);
  const totalDropoffs = analyticsTotalDropoffs(dropoff);
  const biggestDropoff = analyticsBiggestDropoff(dropoffRows);

  // Answers data (Answers tab) — fetched only when that tab is active.
  const { data: answersData, isLoading: answersLoading } = useQuery({
    queryKey: ["analytics-answers", formId, rangeArgs],
    queryFn: () => getFormAnswers({ data: { formId, ...rangeArgs } }),
    staleTime: 30_000,
    enabled: tab === "answers",
  });
  const answers: FormAnswerMetrics | undefined = answersData;
  const answerQuestions = useMemo(() => visibleAnswerQuestions(answers), [answers]);
  const mostSkipped = useMemo(() => mostSkippedQuestion(answers), [answers]);
  const avgAnsweredFillRate = fillRate(answers?.avgAnswered ?? 0, answers?.totalQuestions ?? 0);

  const rangeLabel = PRESET_OPTIONS.find((r) => r.value === range)?.label ?? "Last 7 days";

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
      ["Completion time", formatDuration(metrics.avgVisitDurationMs)],
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
      <div className="mx-auto w-full max-w-[748px] px-6 py-6">
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

        {tab === "visits" && (
          <>
            <SectionToolbar
              label="Visits"
              range={range}
              rangeLabel={rangeLabel}
              onSelectRange={setRange}
              onExport={handleExport}
            />

            {/* Metric cards — values + "vs previous period" trends. */}
            <div className="mt-5 flex gap-3">
              <MetricCard
                label="Visits"
                value={numberFormatter.format(metrics?.totalVisits ?? 0)}
                trend={pctTrend(metrics?.visitsDeltaPct ?? null, true)}
              />
              <MetricCard
                label="Submissions"
                value={numberFormatter.format(metrics?.completedSubmissions ?? 0)}
                trend={pctTrend(metrics?.submissionsDeltaPct ?? null, true)}
              />
              <MetricCard
                label="Completion rate"
                value={`${completionRate}%`}
                trend={pctTrend(metrics?.completionRateDeltaPts ?? null, true)}
              />
              <MetricCard
                label="Completion time"
                value={formatDuration(metrics?.avgVisitDurationMs ?? 0)}
                trend={durationTrend(metrics?.avgDurationDeltaMs ?? null)}
              />
            </div>

            {/* Activity chart (Figma 26835:11656) — fixed 200px card, gray/100 border. Title 15px
                medium; the series legend lives only in the hover tooltip (no header legend). */}
            <div className={cn(cardClass, "mt-3 flex h-[200px] flex-col overflow-hidden")}>
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

        {tab === "dropoffs" && (
          <>
            <SectionToolbar
              label="Dropoffs"
              range={range}
              rangeLabel={rangeLabel}
              onSelectRange={setRange}
              onExport={handleExport}
              viewMode={viewMode}
              onSelectViewMode={setViewModeOverride}
            />

            {/* Stat cards (Figma 26889:17288) — values + "vs previous period" trends. */}
            <div className="mt-5 flex gap-3">
              <MetricCard
                label="Total dropoffs"
                value={numberFormatter.format(totalDropoffs)}
                trend={pctTrend(dropoff?.totalDropoffsDeltaPct ?? null, false)}
              />
              <MetricCard
                label="Biggest drop-off"
                value={biggestDropoff?.qLabel ?? "—"}
                // Skip rate is a loss metric (Figma shows it red). Red once there's an actual rate;
                // 0% stays muted (no dropoffs to flag).
                hint={biggestDropoff && biggestDropoff.rate <= 0 ? "0% skip rate" : undefined}
                trend={
                  biggestDropoff && biggestDropoff.rate > 0
                    ? { text: `${Math.round(biggestDropoff.rate)}% skip rate`, tone: "bad" }
                    : undefined
                }
              />
              <MetricCard
                label="Submissions"
                value={numberFormatter.format(dropoff?.completedSubmissions ?? 0)}
                trend={pctTrend(metrics?.submissionsDeltaPct ?? null, true)}
              />
              <MetricCard
                label="Completion time"
                value={formatDuration(metrics?.avgVisitDurationMs ?? 0)}
                trend={durationTrend(metrics?.avgDurationDeltaMs ?? null)}
              />
            </div>

            {/* Symmetrical toggle between funnel chart (page forms) and full-width drop-off list (page-less forms) */}
            {dropoffLoading ? (
              <div
                className={cn(
                  cardClass,
                  "mt-3 flex h-[383px] items-center justify-center text-[14px] text-muted-foreground",
                )}
              >
                Loading…
              </div>
            ) : dropoff?.steps && dropoff.steps.length > 1 ? (
              /* Funnel chart (Figma 26989:10813) — fixed 383px card; smoothly tapered descending area. */
              <div className={cn(cardClass, "mt-3 flex h-[383px] flex-col overflow-hidden")}>
                <h3 className="px-[13px] pt-[13px] text-[15px] font-medium tracking-[0.02em] text-gray-900">
                  Dropoff funnel over time
                </h3>
                <div className="min-h-0 flex-1 p-4">
                  <MultiPageDropoffFunnelChart data={dropoff.steps} />
                </div>
              </div>
            ) : dropoffRows.length > 0 ? (
              /* Single-page: Hide funnel entirely and show Dropoff per question card in high-fidelity full-width 424px layout */
              <div className="mt-3">
                <QuestionBarListCard
                  title="Dropoff per question"
                  rows={dropoffRows.map((r) => {
                    const displayLabel = r.label.startsWith(r.qLabel)
                      ? r.label
                      : `${r.qLabel}. ${r.label}`;
                    return { label: displayLabel, value: r.rate };
                  })}
                  format={(v) => `${Math.round(v)}%`}
                  className="h-[424px]"
                />
              </div>
            ) : (
              <div
                className={cn(
                  cardClass,
                  "mt-3 flex h-[300px] items-center justify-center text-[14px] text-muted-foreground",
                )}
              >
                No drop-off data for this range
              </div>
            )}
          </>
        )}

        {tab === "answers" && (
          <>
            <SectionToolbar
              label="Answers"
              range={range}
              rangeLabel={rangeLabel}
              onSelectRange={setRange}
              onExport={handleExport}
            />

            {/* Stat cards (Figma 26844:15300) — values + "vs previous period" trends. */}
            <div className="mt-5 flex gap-3">
              <MetricCard
                label="Submissions"
                value={numberFormatter.format(answers?.submissions ?? 0)}
                trend={pctTrend(metrics?.submissionsDeltaPct ?? null, true)}
              />
              <MetricCard
                label="Most skipped"
                value={mostSkipped?.qLabel ?? "—"}
                // Skip rate is a loss metric (Figma red); red once there's a rate, 0% stays muted.
                hint={mostSkipped && mostSkipped.skip <= 0 ? "0% skip rate" : undefined}
                trend={
                  mostSkipped && mostSkipped.skip > 0
                    ? { text: `${mostSkipped.skip}% skip rate`, tone: "bad" }
                    : undefined
                }
              />
              <MetricCard
                label="Avg. answered"
                value={String(Math.round(answers?.avgAnswered ?? 0))}
                trend={
                  avgAnsweredFillRate !== null
                    ? {
                        text: `${avgAnsweredFillRate}% fill rate`,
                        tone: avgAnsweredFillRate >= 50 ? "good" : "bad",
                      }
                    : undefined
                }
              />
              <MetricCard
                label="Completion time"
                value={formatDuration(metrics?.avgVisitDurationMs ?? 0)}
                trend={durationTrend(metrics?.avgDurationDeltaMs ?? null)}
              />
            </div>

            {/* Per-question answer cards — donut (choice/rating) or top-answers bar list. */}
            {answerQuestions.length === 0 ? (
              <div className="mt-5 flex h-40 items-center justify-center text-[14px] text-muted-foreground">
                {answersLoading ? "Loading…" : "No answers for this range"}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-5">
                {answerQuestions.map((q) =>
                  q.analysis === "choice" ? (
                    <AnswerDonutCard key={q.id} q={q} />
                  ) : (
                    <AnswerBarCard
                      key={q.id}
                      q={q}
                      unit={q.fieldType === "FileUpload" ? "uploads" : "responses"}
                    />
                  ),
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/analytics",
)({
  component: AnalyticsPage,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  ssr: "data-only",
});
