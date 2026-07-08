import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { StepDropoffMetrics } from "@/types/analytics";
import {
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

// Solid red bands per column, darkening left→right. Separate ramps per theme so the
// dark variant uses saturated maroon→bright-red (Figma 27015:12148) instead of a pale
// wash that glows on the #1c1c1c card; light uses pale-pink→deep-red (Figma 26989:10813).
const FILL_LIGHT = ["#fff2f2", "#ffe6e6", "#ffc8c9", "#fca7a8", "#f67375", "#f20206", "#d60004"];
const FILL_DARK = ["#480d11", "#681014", "#8a1217", "#b2141a", "#d4141a", "#f30a11", "#ff0d14"];

const lerpColor = (a: string, b: string, t: number): string => {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${mix.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
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

export interface MultiPageDropoffFunnelChartProps {
  data: StepDropoffMetrics[];
}

export const MultiPageDropoffFunnelChart = ({ data }: MultiPageDropoffFunnelChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const isDark = useResolvedTheme() === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 210 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      setSize({
        width: entries[0].contentRect.width,
        height: Math.max(180, entries[0].contentRect.height),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Keep form order (server returns stepIndex-ascending); sorting by viewCount would misalign
  // labels (stepIndex-based) and drop-off badges (adjacent-pair) when a later page has more views.
  const orderedSteps = useMemo(() => [...data].sort((a, b) => a.stepIndex - b.stepIndex), [data]);

  // Extremes from actual counts, not first/last step — view counts aren't guaranteed monotonic.
  const maxVal = orderedSteps.length ? Math.max(...orderedSteps.map((s) => s.viewCount)) : 1;
  const minVal = orderedSteps.length ? Math.min(...orderedSteps.map((s) => s.viewCount)) : 0;

  const MIN_SEGMENT_WIDTH = 120;
  const naturalWidth = orderedSteps.length * MIN_SEGMENT_WIDTH;
  const columns = `repeat(${orderedSteps.length}, minmax(0, 1fr))`;

  // progressive color bands from darkest red to lightest pink/red
  const bandColors = useMemo(() => {
    const ramp = isDark ? [...FILL_DARK].reverse() : [...FILL_LIGHT].reverse();
    return Array.from({ length: orderedSteps.length }, (_, i) => {
      const t = orderedSteps.length <= 1 ? 1 : i / (orderedSteps.length - 1);
      const seg = t * (ramp.length - 1);
      const lo = Math.floor(seg);
      return lo >= ramp.length - 1
        ? ramp[ramp.length - 1]
        : lerpColor(ramp[lo], ramp[lo + 1], seg - lo);
    });
  }, [isDark, orderedSteps.length]);

  const pillBg = isDark ? "#1c1c1c" : "#ffffff";
  const pillStroke = isDark ? "rgba(239, 68, 68, 0.3)" : "rgba(229, 231, 235, 1)";
  const pillText = isDark ? "#dc2626" : "#dc2626";

  const chartHeight = 240; // Lock chart height to exactly 240px to scale funnel heights precisely

  // Heights at column centers: blend strict proportional height with uniform linear slope height (50/50 blend)
  // This creates a beautiful slight bend reflecting the actual step weights while keeping the curve extremely smooth and elegant
  const centerHeights = useMemo(
    () =>
      orderedSteps.map((step, i) => {
        // 1. Symmetrical linear height at column center (goes from near 240px on left to near 80px on right)
        const u_i = 240 - ((i + 0.5) / orderedSteps.length) * (240 - 80);

        // 2. Strict proportional height based on viewCount
        let p_i = 240;
        if (maxVal !== minVal) {
          const count = step.viewCount;
          const ratio = (count - minVal) / (maxVal - minVal);
          p_i = 80 + ratio * (240 - 80);
        }

        // 3. 50% proportional + 50% linear slope blend
        const blend = 0.5;
        return blend * p_i + (1 - blend) * u_i;
      }),
    [orderedSteps, maxVal, minVal],
  );

  // Symmetrically interpolate step boundary heights from exactly 240px to 80px
  // Boundary i is the average of adjacent column center heights to distribute slopes organically
  const getBoundaryHeight = useMemo(
    () =>
      (i: number): number => {
        if (i === 0) return 240;
        if (i === orderedSteps.length) return 80;
        return (centerHeights[i - 1] + centerHeights[i]) / 2;
      },
    [orderedSteps.length, centerHeights],
  );

  // 1. Symmetrical top y-coordinates for all boundaries 0 to N
  const boundariesY = useMemo(
    () =>
      Array.from({ length: orderedSteps.length + 1 }, (_, i) => {
        const h = getBoundaryHeight(i);
        return (chartHeight - h) / 2;
      }),
    [orderedSteps.length, getBoundaryHeight],
  );

  return (
    <div className="h-full w-full overflow-x-auto select-none" ref={containerRef}>
      <div
        style={{ minWidth: naturalWidth }}
        className="relative flex h-full flex-col justify-between"
        onMouseMove={(e) => {
          if (!containerRef.current) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const colWidth = rect.width / orderedSteps.length;
          const idx = Math.floor(x / colWidth);
          if (idx >= 0 && idx < orderedSteps.length) {
            setActiveIndex(idx);
            setTooltipPos({ x, y });
          } else {
            setActiveIndex(null);
          }
        }}
        onMouseLeave={() => setActiveIndex(null)}
      >
        {/* Top Labels */}
        <div
          className="grid border-b border-border/40 pb-2"
          style={{ gridTemplateColumns: columns }}
        >
          {orderedSteps.map((step, i) => {
            const pageNum = step.stepIndex + 1;
            const label = step.stepLabel ?? `Page ${pageNum}`;
            return (
              <div
                key={step.stepId}
                className={cn(
                  "flex flex-col gap-1 px-3 transition-opacity duration-200",
                  activeIndex !== null && activeIndex !== i && "opacity-50",
                )}
              >
                <span className="truncate text-[13px] font-medium tracking-[0.26px] text-gray-600 dark:text-gray-400">
                  {label}
                </span>
                <span className="text-[14px] font-semibold tracking-[0.28px] text-gray-800 tabular-nums dark:text-gray-200">
                  {numberFormatter.format(step.viewCount)}
                </span>
              </div>
            );
          })}
        </div>

        {/* SVG Drawing Area */}
        <div className="relative mt-2 flex-1">
          {/* Vertical Grid Lines (Figma gray/100) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid"
            style={{ gridTemplateColumns: columns }}
          >
            {orderedSteps.map((step, i) => (
              <div
                key={step.stepId}
                className={cn(i > 0 && "border-l border-[var(--color-gray-100)]")}
              />
            ))}
          </div>

          <svg width="100%" height={chartHeight} className="overflow-visible">
            {/* Centerline vertical scaling group on mount */}
            <motion.g
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ originY: 0.5 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Draw vertical band trapezoids with straight edges (piecewise linear segments that overall form a curved funnel) */}
              {orderedSteps.map((step, i) => {
                const colWidth = size.width / orderedSteps.length;
                const x_left = i * colWidth;
                const x_right = (i + 1) * colWidth;

                const y_top_left = boundariesY[i];
                const y_top_right = boundariesY[i + 1];

                const y_bottom_left = chartHeight - y_top_left;
                const y_bottom_right = chartHeight - y_top_right;

                // Straight horizontal trapezoid segment - connects boundaries as straight lines
                // which overall creates the perfectly faceted curved funnel layout from Figma
                const pathD = `M ${x_left} ${y_top_left} L ${x_right} ${y_top_right} L ${x_right} ${y_bottom_right} L ${x_left} ${y_bottom_left} Z`;
                const bandColor = bandColors[i];
                const isDimmed = activeIndex !== null && activeIndex !== i;

                return (
                  <g
                    key={`band-${step.stepId}`}
                    className="transition-opacity duration-200"
                    style={{ opacity: isDimmed ? 0.4 : 1 }}
                  >
                    <path
                      d={pathD}
                      fill={bandColor}
                      stroke={isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.01)"}
                      strokeWidth={1}
                    />

                    {/* Vertical grid line separator */}
                    {i < orderedSteps.length - 1 && (
                      <line
                        x1={x_right}
                        y1={y_top_right}
                        x2={x_right}
                        y2={y_bottom_right}
                        stroke={isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.4)"}
                        strokeWidth={1.5}
                      />
                    )}
                  </g>
                );
              })}
            </motion.g>

            {/* Draw Pill Badges centered on grid separator lines */}
            {orderedSteps.map((step, i) => {
              if (i === orderedSteps.length - 1) return null;
              const nextStep = orderedSteps[i + 1];

              const colWidth = size.width / orderedSteps.length;
              const badge_x = (i + 1) * colWidth;
              const badge_y = chartHeight / 2;

              const dropPct =
                step.viewCount > 0
                  ? Math.round(((step.viewCount - nextStep.viewCount) / step.viewCount) * 100)
                  : 0;
              const isDimmed = activeIndex !== null && activeIndex !== i && activeIndex !== i + 1;

              return (
                <g
                  key={`badge-group-${i}`}
                  className="transition-opacity duration-200"
                  style={{ opacity: isDimmed ? 0.35 : 1 }}
                >
                  {/* Badge pill */}
                  {step.viewCount > 0 && (
                    <motion.g
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        delay: 0.3 + 0.05 * i,
                        type: "spring",
                        stiffness: 200,
                        damping: 15,
                      }}
                    >
                      <rect
                        x={badge_x - 27}
                        y={badge_y - 11}
                        width={54}
                        height={22}
                        rx={11}
                        ry={11}
                        fill={pillBg}
                        stroke={pillStroke}
                        strokeWidth={1}
                        className="shadow-sm"
                      />
                      <text
                        x={badge_x}
                        y={badge_y + 4}
                        fill={pillText}
                        fontSize={11}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        ↓ {dropPct}%
                      </text>
                    </motion.g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Custom absolute tooltip inside the relative viewport */}
          <AnimatePresence>
            {activeIndex !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute z-50 min-w-[170px] rounded-[10px] border border-border bg-popover/95 px-3 py-2 text-[13px] text-popover-foreground shadow-lg backdrop-blur-sm"
                style={{
                  left: Math.min(size.width - 180, Math.max(10, tooltipPos.x - 85)),
                  top: Math.max(0, tooltipPos.y - 130),
                }}
              >
                <div className="mb-1.5 truncate text-[14px] font-semibold text-foreground">
                  {orderedSteps[activeIndex].stepLabel ??
                    `Page ${orderedSteps[activeIndex].stepIndex + 1}`}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Viewed</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {numberFormatter.format(orderedSteps[activeIndex].viewCount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {numberFormatter.format(orderedSteps[activeIndex].startCount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {numberFormatter.format(orderedSteps[activeIndex].completeCount)}
                    </span>
                  </div>
                  {orderedSteps[activeIndex].dropoffRate !== null && (
                    <div className="mt-1 flex justify-between gap-4 border-t border-border/40 pt-1">
                      <span className="text-muted-foreground">Drop-off Rate</span>
                      <span className="font-semibold text-red-500 tabular-nums">
                        {orderedSteps[activeIndex].dropoffRate}%
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
