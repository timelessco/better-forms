import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import type { ComponentProps } from "react";

import { ChartContainer } from "@/components/evilcharts/ui/chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { ChartTooltip, ChartTooltipContent } from "@/components/evilcharts/ui/tooltip";
import { NumberPopIn } from "@/components/transitions/number-pop-in";
import { numberFormatter } from "@/lib/analytics/format";
import { rollupToSteps } from "@/lib/analytics/step-rollup";
import type { StepDropoffMetrics } from "@/lib/analytics/step-rollup";
import { cn } from "@/lib/utils";
import type { QuestionDropoffMetrics, QuestionDropoffRow } from "@/types/analytics";

interface DropoffSankeyProps {
  dropoff: QuestionDropoffMetrics;
}

interface FunnelSegment {
  id: string;
  label: string;
  count: number;
  // Retention vs. the first segment (0–1). Used for the small percent badge.
  retention: number;
  // Drop relative to previous segment (0–1). null for the first segment.
  stepDrop: number | null;
}

// One chart datum. `value` is the (floored) plotted height; `count` is the real
// figure surfaced in the tooltip.
interface FunnelDatum extends FunnelSegment {
  value: number;
}

const formatStepLabel = (step: StepDropoffMetrics): string =>
  step.stepLabel ?? `Step ${step.stepIndex + 1}`;

const formatQuestionLabel = (q: QuestionDropoffRow, fallbackIndex: number): string => {
  if (q.questionLabel) return q.questionLabel;
  return `Field ${fallbackIndex + 1}`;
};

const buildSegments = (dropoff: QuestionDropoffMetrics): FunnelSegment[] => {
  const steps = rollupToSteps(dropoff.questions);
  let raw: Array<{ id: string; label: string; count: number }> = [];

  if (steps.length > 1) {
    raw = steps.map((step) => ({
      id: step.stepId,
      label: formatStepLabel(step),
      count: step.viewCount,
    }));
  } else {
    const sorted = [...dropoff.questions].toSorted((a, b) => a.questionIndex - b.questionIndex);
    raw = sorted.map((q, i) => ({
      id: q.questionId,
      label: formatQuestionLabel(q, i),
      // Single-page Forms emit one View per visit, shared across all Questions.
      // Use startCount as the funnel value — it naturally decreases as
      // Respondents abandon partway through the page.
      count: q.startCount,
    }));
  }

  const firstCount = raw[0]?.count ?? 0;
  return raw.map((seg, i) => {
    const prevCount = i === 0 ? null : raw[i - 1].count;
    const retention = firstCount > 0 ? seg.count / firstCount : 0;
    const stepDrop =
      prevCount === null || prevCount === 0 ? null : Math.max(0, 1 - seg.count / prevCount);
    return { ...seg, retention, stepDrop };
  });
};

const CHART_HEIGHT = 220;
const TOP_PADDING = 16;
// Floor every bar to this fraction of the tallest so a near-zero segment still
// reads as a sliver (matches the old hand-drawn funnel).
const MIN_BAR_RATIO = 0.12;
const CORNER_RADIUS = 28;
// Below this per-segment width the chart scrolls horizontally instead of
// squeezing labels to nothing.
const MIN_SEGMENT_WIDTH = 120;

const FUNNEL_COLOR = "oklch(0.62 0.18 270)";

// ---------------------------------------------------------------------------
// Custom d3 curve: a stepped funnel top whose drops sit on the band dividers
// (the midpoint between adjacent points) with rounded corners, extended to the
// plot edges so the area fills full width. Used as `<Area type={...} />` so the
// shape is a first-class Recharts element (tooltip, gradient, animation all
// native). Mirrors the geometry of the previous hand-drawn SVG path.
// ---------------------------------------------------------------------------
interface CurveContext {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  closePath(): void;
}

const createRoundedStepCurve = (context: CurveContext) => {
  let points: Array<[number, number]> = [];
  // d3 area convention: areaStart sets line=0 (top), lineEnd toggles to 1
  // (baseline). A bare line() leaves line=NaN.
  let line = Number.NaN;

  const emit = (): void => {
    const n = points.length;
    if (n === 0) return;
    const moveFirst = !line; // line falsy (0 or NaN) → start a new subpath
    if (n === 1) {
      // A single segment owns the whole plot; its band is centred at x, so the
      // plot spans [0, 2x]. Draw a full-width flat top (and baseline, right→left)
      // so the bar is visible instead of collapsing to a zero-width line.
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

    // Extend each end outward (away from its neighbour) by half the band so the
    // first/last plateau reaches the plot edge.
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

const FunnelStatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono font-medium text-foreground tabular-nums">{value}</span>
  </div>
);

// Renders Count / Retention / Drop from a hovered segment's payload. Slotted
// into ChartTooltipContent's `formatter`, so the surrounding card (header,
// border, shadow, fade) is the shared EvilCharts tooltip.
const renderFunnelTooltip = (
  _value: unknown,
  _name: unknown,
  _item: unknown,
  _index: unknown,
  payload: unknown,
): React.ReactNode => {
  const segment = payload as FunnelDatum | undefined;
  if (!segment) return null;
  return (
    <div className="grid flex-1 gap-1.5">
      <FunnelStatRow label="Count" value={numberFormatter.format(segment.count)} />
      <FunnelStatRow label="Retention" value={`${Math.round(segment.retention * 100)}%`} />
      {segment.stepDrop !== null && (
        <FunnelStatRow
          label="Drop vs. previous"
          value={`−${Math.round(segment.stepDrop * 100)}%`}
        />
      )}
    </div>
  );
};

interface FunnelChartProps {
  segments: FunnelSegment[];
}

const FunnelChart = ({ segments }: FunnelChartProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // One-shot left-to-right reveal on first mount; clip is dropped afterwards so
  // it never clips the (overflowing) hover tooltip.
  const [revealed, setRevealed] = useState(false);

  const { data, maxCount } = useMemo(() => {
    const max = Math.max(1, ...segments.map((s) => s.count));
    const rows: FunnelDatum[] = segments.map((s) => ({
      ...s,
      // Floor the plotted height; the tooltip still shows the real count.
      value: Math.max(s.count, max * MIN_BAR_RATIO),
    }));
    return { data: rows, maxCount: max };
  }, [segments]);

  const chartConfig = {
    value: {
      label: "Responses",
      colors: { light: [FUNNEL_COLOR], dark: [FUNNEL_COLOR] },
    },
  } satisfies ChartConfig;

  const naturalWidth = segments.length * MIN_SEGMENT_WIDTH;

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: naturalWidth }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
        >
          {segments.map((seg, i) => (
            <div
              key={seg.id}
              className={cn(
                "flex flex-col gap-1 px-3 py-2 transition-opacity",
                i > 0 && "border-l border-border/60",
                activeIndex !== null && activeIndex !== i && "opacity-50",
              )}
            >
              <div className="truncate text-[13px] text-muted-foreground" title={seg.label}>
                {seg.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground">
                  <NumberPopIn value={numberFormatter.format(seg.count)} className="tabular-nums" />
                </span>
                {seg.stepDrop !== null && seg.stepDrop > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    −{Math.round(seg.stepDrop * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <motion.div
          className="relative isolate"
          style={{ height: CHART_HEIGHT, ...(revealed ? { clipPath: "none" } : {}) }}
          initial={revealed ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={revealed ? undefined : { clipPath: "inset(0 0 0 0)" }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
          onAnimationComplete={() => setRevealed(true)}
        >
          {/* Full-height column dividers, behind the chart so the curve's
              stroke (and fill) paint over them at the transitions. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 grid"
            style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
          >
            {segments.map((seg, i) => (
              <div
                key={seg.id}
                className={cn(
                  "transition-opacity",
                  i > 0 && "border-l border-border/60",
                  activeIndex !== null && activeIndex !== i && "opacity-40",
                )}
              />
            ))}
          </div>
          <ChartContainer config={chartConfig} footer className="aspect-auto h-full">
            <AreaChart
              data={data}
              margin={{ top: TOP_PADDING, right: 0, bottom: 0, left: 0 }}
              onMouseMove={(state) => {
                const raw = state?.activeTooltipIndex;
                const idx = raw == null ? Number.NaN : Number(raw);
                setActiveIndex(Number.isNaN(idx) ? null : idx);
              }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <defs>
                {/* Vertical fade: tinted at the top edge → near-transparent at
                    the baseline, matching the EvilCharts gradient area fill. */}
                <linearGradient id="dropoff-funnel-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={FUNNEL_COLOR} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={FUNNEL_COLOR} stopOpacity={0.04} />
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
              <ChartTooltip
                wrapperStyle={{ zIndex: 50 }}
                cursor={false}
                content={<ChartTooltipContent hideIndicator formatter={renderFunnelTooltip} />}
              />
              <Area
                dataKey="value"
                type={createRoundedStepCurve as unknown as ComponentProps<typeof Area>["type"]}
                stroke={FUNNEL_COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
                fill="url(#dropoff-funnel-gradient)"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </motion.div>
      </div>
    </div>
  );
};

export const DropoffSankey = ({ dropoff }: DropoffSankeyProps) => {
  const segments = useMemo(() => buildSegments(dropoff), [dropoff]);

  const isEmpty = segments.length === 0 || segments.every((s) => s.count === 0);

  if (isEmpty) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        Not enough data to render the flow view yet.
      </div>
    );
  }

  const firstCount = segments[0].count;
  const lastCount = segments[segments.length - 1].count;
  const overallRetention = firstCount > 0 ? lastCount / firstCount : 0;

  return (
    <div className="space-y-4">
      <FunnelChart segments={segments} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat label="Entered" value={numberFormatter.format(firstCount)} />
        <SummaryStat label="Reached end" value={numberFormatter.format(lastCount)} />
        <SummaryStat label="Overall retention" value={`${Math.round(overallRetention * 100)}%`} />
      </div>
    </div>
  );
};

interface SummaryStatProps {
  label: string;
  value: string;
}

const SummaryStat = ({ label, value }: SummaryStatProps) => (
  <div className="flex flex-col gap-1 px-3 py-2">
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {label}
    </span>
    <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
  </div>
);
