import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComponentProps } from "react";

import { useResolvedTheme } from "@/components/theme-provider";
import { numberFormatter } from "@/lib/analytics/format";
import { cn } from "@/lib/utils";

// ── Shared date formatting ───────────────────────────────────────────────────
// ≤7 points → weekday (Mon, Tue); longer ranges → month/day (Jun 30) so labels don't
// collapse into an overlapping smear.
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const makeDateFormatter =
  (count: number) =>
  (value: string): string => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return (count <= 7 ? weekdayFmt : monthDayFmt).format(parsed);
  };

// ── Activity chart (Visits tab, Figma 26835:11656) — multi-line over the range ──
// Mid-luminance brand colors hold their brightness on both light and dark surfaces.
export type ActivityPoint = { date: string; visits: number; submissions: number; partial: number };
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

export const FormActivityChart = ({ data }: { data: ActivityPoint[] }) => {
  // ≤7 days: weekday labels, show every tick. Longer ranges: month/day labels, thinned
  // to ~8 evenly-spaced ticks (+ start/end) so they never overlap.
  const tickFormatter = makeDateFormatter(data.length);
  const interval = data.length <= 8 ? 0 : Math.floor(data.length / 8);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        accessibilityLayer={false}
        data={data}
        margin={{ top: 4, right: 16, bottom: 0, left: 16 }}
      >
        {/* Faint dashed horizontal gridlines (Figma gray/100). */}
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--color-gray-100)" />
        <XAxis
          dataKey="date"
          tickFormatter={tickFormatter}
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          interval={interval}
          minTickGap={16}
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
};

// ── Dropoff funnel chart (Dropoffs tab, Figma 26989:10813 / dark 27015:12148) ──
// Funnel across questions: each column = one question, height = respondents still
// answering, descending = drop-off. Rounded step top + per-column red bands that
// darken left→right. Mechanism (rounded-step d3 curve, horizontal scroll, hover)
// ported from the proven insights `dropoff-sankey.tsx`; restyled to the new Figma.
export type FunnelPoint = {
  label: string; // short column label (Q1, Q2, …)
  title: string; // full question label (tooltip)
  count: number;
  retention: number; // vs first column (0–1)
  stepDrop: number | null; // vs previous column (0–1); null for first
};
type FunnelDatum = FunnelPoint & { value: number };

// Solid red bands per column, darkening left→right. Separate ramps per theme so the
// dark variant uses saturated maroon→bright-red (Figma 27015:12148) instead of a pale
// wash that glows on the #1c1c1c card; light uses pale-pink→deep-red (Figma 26989:10813).
const FILL_LIGHT = ["#fff2f2", "#ffe6e6", "#ffc8c9", "#fca7a8", "#f67375", "#f20206", "#d60004"];
const FILL_DARK = ["#480d11", "#681014", "#8a1217", "#b2141a", "#d4141a", "#f30a11", "#ff0d14"];
const STROKE_LIGHT = ["#fca5a5", "#f87171", "#f43f5e", "#ef4444", "#e11d48", "#dc2626", "#b91c1c"];
const STROKE_DARK = ["#7a1418", "#9c1519", "#c2141a", "#e2141b", "#fb1118", "#ff3034", "#ff5a5e"];
const MIN_SEGMENT_WIDTH = 95; // Figma column width; below this the chart scrolls horizontally
const CHART_HEIGHT = 210;
const TOP_PADDING = 10;
const MIN_BAR_RATIO = 0.12; // floor tiny columns to a readable sliver
const CORNER_RADIUS = 14; // rounded step corners (Figma)

const lerpColor = (a: string, b: string, t: number): string => {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${mix.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

// Sample `n` evenly-spaced colors across a ramp, then emit hard-stop gradient stops
// (one flat band per column).
const colorBands = (ramp: string[], n: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = n <= 1 ? 1 : i / (n - 1);
    const seg = t * (ramp.length - 1);
    const lo = Math.floor(seg);
    const color =
      lo >= ramp.length - 1 ? ramp[ramp.length - 1] : lerpColor(ramp[lo], ramp[lo + 1], seg - lo);
    return { lo: i / n, hi: (i + 1) / n, color };
  });

// Custom d3 curve for <Area type>: stepped funnel top dropping on band dividers with
// rounded corners, extended to plot edges for full-width fill. Ported from dropoff-sankey.tsx.
interface CurveContext {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
}

const createRoundedStepCurve = (context: CurveContext) => {
  let points: Array<[number, number]> = [];
  let line = Number.NaN;

  const emit = (): void => {
    const n = points.length;
    if (n === 0) return;
    const moveFirst = !line;
    if (n === 1) {
      const [x, y] = points[0];
      const right = 2 * x;
      if (line) {
        context.lineTo(right, y);
        context.lineTo(0, y);
      } else {
        context.moveTo(0, y);
        context.lineTo(right, y);
      }
      return;
    }

    const startExt = Math.abs(points[1][0] - points[0][0]) / 2;
    const endExt = Math.abs(points[n - 1][0] - points[n - 2][0]) / 2;
    const startX = points[0][0] + Math.sign(points[0][0] - points[1][0]) * startExt;
    const endX = points[n - 1][0] + Math.sign(points[n - 1][0] - points[n - 2][0]) * endExt;

    if (moveFirst) context.moveTo(startX, points[0][1]);
    else context.lineTo(startX, points[0][1]);

    for (let i = 0; i < n - 1; i++) {
      const y0 = points[i][1];
      const y1 = points[i + 1][1];
      const boundary = (points[i][0] + points[i + 1][0]) / 2;
      const drop = y1 - y0;
      const direction = Math.sign(drop);

      if (direction === 0) {
        context.lineTo(boundary, y0);
        continue;
      }

      const horizontalRoom = Math.min(Math.abs(points[i + 1][0] - points[i][0]) / 2, CORNER_RADIUS);
      const verticalRoom = Math.min(Math.abs(drop) / 2, CORNER_RADIUS);
      const r = Math.min(horizontalRoom, verticalRoom);

      context.lineTo(boundary - r, y0);
      context.quadraticCurveTo(boundary, y0, boundary, y0 + r * direction);
      context.lineTo(boundary, y1 - r * direction);
      context.quadraticCurveTo(boundary, y1, boundary + r, y1);
    }

    context.lineTo(endX, points[n - 1][1]);
  };

  return {
    areaStart() {
      line = 0;
    },
    areaEnd() {
      line = Number.NaN;
    },
    lineStart() {
      points = [];
    },
    lineEnd() {
      emit();
      if (line === 1) context.closePath();
      if (line >= 0) line = 1 - line;
    },
    point(x: number, y: number) {
      points.push([+x, +y]);
    },
  };
};

const TooltipRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-0.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground tabular-nums">{value}</span>
  </div>
);

const FunnelTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: FunnelDatum }[];
}) => {
  const seg = payload?.[0]?.payload;
  if (!active || !seg) return null;
  return (
    <div className="min-w-[160px] rounded-[10px] border border-border bg-popover px-2.5 py-2 text-[13px] shadow-md">
      <div className="mb-1 truncate font-medium text-foreground">{seg.title}</div>
      <TooltipRow label="Count" value={numberFormatter.format(seg.count)} />
      <TooltipRow label="Retention" value={`${Math.round(seg.retention * 100)}%`} />
      {seg.stepDrop !== null && (
        <TooltipRow label="Drop vs. previous" value={`−${Math.round(seg.stepDrop * 100)}%`} />
      )}
    </div>
  );
};

export const DropoffFunnelChart = ({ data }: { data: FunnelPoint[] }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isDark = useResolvedTheme() === "dark";

  const { rows, maxCount } = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.count));
    return {
      rows: data.map((d) => ({ ...d, value: Math.max(d.count, max * MIN_BAR_RATIO) })),
      maxCount: max,
    };
  }, [data]);

  // Memoized: onMouseMove re-renders on every pointer move during hover.
  const fillBands = useMemo(
    () => colorBands(isDark ? FILL_DARK : FILL_LIGHT, data.length),
    [isDark, data.length],
  );
  const strokeBands = useMemo(
    () => colorBands(isDark ? STROKE_DARK : STROKE_LIGHT, data.length),
    [isDark, data.length],
  );
  const naturalWidth = data.length * MIN_SEGMENT_WIDTH;
  const columns = `repeat(${data.length}, minmax(0, 1fr))`;

  return (
    <div className="h-full w-full overflow-x-auto">
      <div style={{ minWidth: naturalWidth }}>
        {/* Per-column header: short label + reached count (Figma top labels). */}
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          {data.map((d, i) => (
            <div
              key={d.label}
              className={cn(
                "flex flex-col gap-1.5 px-3 pt-1 transition-opacity",
                activeIndex !== null && activeIndex !== i && "opacity-50",
              )}
            >
              <span className="truncate text-[13px] tracking-[0.26px] text-gray-600">
                {d.label}
              </span>
              <span className="text-[14px] font-medium tracking-[0.28px] text-gray-800 tabular-nums">
                {numberFormatter.format(d.count)}
              </span>
            </div>
          ))}
        </div>
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          {/* Full-height column dividers behind the curve (Figma gray/100). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: columns }}
          >
            {data.map((d, i) => (
              <div
                key={d.label}
                className={cn(i > 0 && "border-l border-[var(--color-gray-100)]")}
              />
            ))}
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              accessibilityLayer={false}
              data={rows}
              margin={{ top: TOP_PADDING, right: 0, bottom: 0, left: 0 }}
              onMouseMove={(state: { activeTooltipIndex?: number | string | null }) => {
                const raw = state?.activeTooltipIndex;
                const idx = raw == null ? Number.NaN : Number(raw);
                setActiveIndex(Number.isNaN(idx) ? null : idx);
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id="dfunnel-fill" x1="0" y1="0" x2="1" y2="0">
                  {fillBands.flatMap((b, i) => [
                    <stop key={`${i}a`} offset={b.lo} stopColor={b.color} />,
                    <stop key={`${i}b`} offset={b.hi} stopColor={b.color} />,
                  ])}
                </linearGradient>
                <linearGradient id="dfunnel-stroke" x1="0" y1="0" x2="1" y2="0">
                  {strokeBands.flatMap((b, i) => [
                    <stop key={`${i}a`} offset={b.lo} stopColor={b.color} />,
                    <stop key={`${i}b`} offset={b.hi} stopColor={b.color} />,
                  ])}
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                type="category"
                scale="band"
                padding={{ left: 0, right: 0 }}
                hide
                height={0}
              />
              <YAxis type="number" domain={[0, maxCount]} hide width={0} />
              <Tooltip wrapperStyle={{ zIndex: 50 }} cursor={false} content={<FunnelTooltip />} />
              <Area
                dataKey="value"
                type={createRoundedStepCurve as unknown as ComponentProps<typeof Area>["type"]}
                stroke="url(#dfunnel-stroke)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                fill="url(#dfunnel-fill)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ── Answer donut (Answers tab, Figma 26844:15323) ────────────────────────────
// Half-donut gauge per choice/rating question: flat Figma slice colors, animated
// sweep (recharts Pie, EvilPieChart-style), center "N answers", colored-dot legend.
const DONUT_PALETTE = ["#1293fc", "#b268fc", "#02ba52", "#f2c603", "#fc7242", "#06b6d4"];
const DONUT_OTHERS = "#c7c7c7";

export type DonutDatum = { label: string; value: number };

export const AnswerDonut = ({
  data,
  total,
  unit,
  palette = DONUT_PALETTE,
}: {
  data: DonutDatum[];
  total: number;
  unit: string;
  palette?: string[];
}) => {
  const sum = data.reduce((acc, d) => acc + d.value, 0);
  if (sum === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-[13px] text-muted-foreground">
        No answers yet
      </div>
    );
  }
  const slices = data.map((d, i) => ({
    ...d,
    fill: d.label === "Others" ? DONUT_OTHERS : palette[i % palette.length],
    pct: Math.round((d.value / sum) * 100),
  }));
  return (
    <div className="flex flex-col items-center gap-[14px]">
      {/* Half-gauge (Figma 26844:15378): outer Ø ~164, thin 14px ring (inner/outer ≈ 0.83). The
          6px gap (box 88 − outer 82) keeps the arc top off the card title. recharts makes its
          wrapper/surface focusable — kill the tab focus ring (decorative chart, not interactive). */}
      <div className="relative h-[88px] w-[166px] [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          {/* accessibilityLayer off: decorative gauge, not keyboard-interactive — otherwise recharts
              gives the <svg> tabIndex=0 and tabbing draws a focus box around the chart. */}
          <PieChart accessibilityLayer={false}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              // recharts defaults the <g.recharts-pie> to tabIndex 0 (separate from accessibilityLayer),
              // so the gauge group itself is tab-focusable and draws a ring — opt out.
              rootTabIndex={-1}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={68}
              outerRadius={82}
              paddingAngle={2}
              cornerRadius={3}
              strokeWidth={0}
              isAnimationActive
              animationDuration={650}
            />
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-x-0 bottom-1.5 text-center text-[13px] tracking-[0.13px] text-gray-700">
          {numberFormatter.format(total)} {unit}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {slices.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: s.fill }} />
            <span className="text-[12px] tracking-[0.12px] text-gray-700">
              {s.label} ({s.pct}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
