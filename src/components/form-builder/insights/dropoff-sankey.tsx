import { motion } from "motion/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposedChart, ResponsiveContainer, useChartHeight, useChartWidth } from "recharts";

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

const numberFormatter = new Intl.NumberFormat("en-US");

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

interface FunnelChartProps {
  segments: FunnelSegment[];
}

const CHART_HEIGHT = 220;
const TOP_PADDING = 16;
const MIN_BAR_RATIO = 0.12;
const CORNER_RADIUS = 28;
// Floor each segment to a width that fits a 2-digit count and ~5 characters of
// the label. Below this the chart becomes unreadable; above this the chart
// fills the container as usual. When N × MIN_SEGMENT_WIDTH exceeds the
// container, the chart scrolls horizontally.
const MIN_SEGMENT_WIDTH = 120;

// Builds the inner commands of the funnel top edge — everything between the
// first vertex and the last. Each transition between two segment heights is
// drawn as: flat top → rounded corner into a vertical drop hugging the column
// divider → rounded corner back out into the next flat top. Matches the
// reference funnel style where the curve clings to the boundary line rather
// than sweeping diagonally across both columns.
const buildSteppedTopCommands = (tops: number[], segW: number, viewBoxW: number): string[] => {
  const segCount = tops.length;
  if (segCount === 0) return [];

  const parts: string[] = [];

  for (let i = 0; i < segCount - 1; i++) {
    const boundary = (i + 1) * segW;
    const yCurrent = tops[i];
    const yNext = tops[i + 1];
    const drop = yNext - yCurrent;
    const direction = Math.sign(drop);

    if (direction === 0) {
      parts.push(`L ${boundary} ${yCurrent}`);
      continue;
    }

    const horizontalRoom = Math.min(segW / 2, CORNER_RADIUS);
    const verticalRoom = Math.min(Math.abs(drop) / 2, CORNER_RADIUS);
    const r = Math.min(horizontalRoom, verticalRoom);

    parts.push(`L ${boundary - r} ${yCurrent}`);
    parts.push(`Q ${boundary} ${yCurrent}, ${boundary} ${yCurrent + r * direction}`);
    parts.push(`L ${boundary} ${yNext - r * direction}`);
    parts.push(`Q ${boundary} ${yNext}, ${boundary + r} ${yNext}`);
  }

  parts.push(`L ${viewBoxW} ${tops[segCount - 1]}`);
  return parts;
};

interface HoverState {
  index: number;
  x: number;
  y: number;
  chartWidth: number;
  chartHeight: number;
}

const FUNNEL_COLOR = "oklch(0.62 0.18 270)";
const DIVIDER_COLOR = "oklch(0.92 0.01 270)";

const FunnelPaths = ({
  segments,
  onHoverChange,
}: {
  segments: FunnelSegment[];
  onHoverChange: (state: HoverState | null) => void;
}) => {
  const width = useChartWidth();
  const height = useChartHeight();

  const geometry = useMemo(() => {
    if (!width || !height || segments.length === 0) return null;
    const maxCount = Math.max(1, ...segments.map((s) => s.count));
    const usableHeight = height - TOP_PADDING;
    const heights = segments.map((s) => Math.max(MIN_BAR_RATIO, s.count / maxCount));
    const tops = heights.map((h) => height - h * usableHeight);
    const segW = width / segments.length;
    const stepCommands = buildSteppedTopCommands(tops, segW, width);
    const topD = [`M 0 ${tops[0]}`, ...stepCommands].join(" ");
    const fillD = [
      `M 0 ${height}`,
      `L 0 ${tops[0]}`,
      ...stepCommands,
      `L ${width} ${height}`,
      "Z",
    ].join(" ");
    return { segW, topD, fillD };
  }, [segments, width, height]);

  if (!geometry || !width || !height) return null;
  const { segW, topD, fillD } = geometry;

  return (
    <>
      <defs>
        <linearGradient id="dropoff-funnel-gradient" x1="0" y1="0" x2="1" y2="0">
          {segments.map((seg, i) => {
            const startPct = (i / segments.length) * 100;
            const endPct = ((i + 1) / segments.length) * 100;
            const opacity = 0.12 + (i / Math.max(1, segments.length - 1)) * 0.55;
            return (
              <Fragment key={seg.id}>
                <stop offset={`${startPct}%`} stopColor={FUNNEL_COLOR} stopOpacity={opacity} />
                <stop offset={`${endPct}%`} stopColor={FUNNEL_COLOR} stopOpacity={opacity} />
              </Fragment>
            );
          })}
        </linearGradient>
        <linearGradient id="dropoff-funnel-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.2" />
        </linearGradient>
        <mask id="dropoff-funnel-fade-mask">
          <rect x={0} y={0} width={width} height={height} fill="url(#dropoff-funnel-fade)" />
        </mask>
      </defs>
      {segments.slice(0, -1).map((seg, i) => {
        const x = (i + 1) * segW;
        return (
          <line
            key={seg.id}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={DIVIDER_COLOR}
            strokeWidth={1}
          />
        );
      })}
      <motion.path
        key={`fill-${segments.length}`}
        d={fillD}
        fill="url(#dropoff-funnel-gradient)"
        mask="url(#dropoff-funnel-fade-mask)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
      />
      <motion.path
        key={`stroke-${segments.length}`}
        d={topD}
        fill="none"
        stroke={FUNNEL_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
          const mouseX = Math.round(e.clientX - rect.left);
          const mouseY = Math.round(e.clientY - rect.top);
          const index = Math.min(segments.length - 1, Math.max(0, Math.floor(mouseX / segW)));
          onHoverChange({
            index,
            x: mouseX,
            y: mouseY,
            chartWidth: width,
            chartHeight: height,
          });
        }}
        onMouseLeave={() => onHoverChange(null)}
      />
    </>
  );
};

const FunnelChart = ({ segments }: FunnelChartProps) => {
  const [hover, setHover] = useState<HoverState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState(800);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWrapperWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // When the natural width (N × MIN_SEGMENT_WIDTH) exceeds the wrapper, the
  // inner content overflows and the wrapper scrolls horizontally.
  const chartWidth = Math.max(wrapperWidth, segments.length * MIN_SEGMENT_WIDTH);

  const handleHoverChange = useCallback((next: HoverState | null) => {
    setHover((prev) => {
      if (prev === null && next === null) return prev;
      if (prev && next && prev.index === next.index && prev.x === next.x && prev.y === next.y) {
        return prev;
      }
      return next;
    });
  }, []);

  const hovered = hover ? segments[hover.index] : null;

  return (
    <div ref={wrapperRef} className="w-full overflow-x-auto">
      <div style={{ width: chartWidth }}>
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
                hover && hover.index !== i && "opacity-50",
              )}
            >
              <div className="truncate text-[13px] text-muted-foreground" title={seg.label}>
                {seg.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {numberFormatter.format(seg.count)}
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
        <div className="relative [&_*:focus]:outline-none [&_svg]:outline-none">
          <ResponsiveContainer width={chartWidth} height={CHART_HEIGHT}>
            <ComposedChart data={[]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <FunnelPaths segments={segments} onHoverChange={handleHoverChange} />
            </ComposedChart>
          </ResponsiveContainer>
          {hover && hovered && (
            <FunnelHoverCard
              segment={hovered}
              index={hover.index}
              x={hover.x}
              y={hover.y}
              chartWidth={hover.chartWidth}
              chartHeight={hover.chartHeight}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface FunnelHoverCardProps {
  segment: FunnelSegment;
  index: number;
  x: number;
  y: number;
  chartWidth: number;
  chartHeight: number;
}

const CURSOR_OFFSET = 16;

const FunnelHoverCard = ({
  segment,
  index,
  x,
  y,
  chartWidth,
  chartHeight,
}: FunnelHoverCardProps) => {
  // Flip the card across the cursor when it would overflow the chart on the
  // right or bottom — keeps the tooltip inside the visible viewport on the
  // last column / bottom of the chart without measuring the card itself.
  const flipX = x > chartWidth / 2;
  const flipY = y > chartHeight / 2;
  const transform = [
    flipX ? `translateX(calc(-100% - ${CURSOR_OFFSET * 2}px))` : "translateX(0)",
    flipY ? `translateY(calc(-100% - ${CURSOR_OFFSET * 2}px))` : "translateY(0)",
  ].join(" ");

  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-border bg-popover px-3 py-2 elevation-sm"
      style={{
        left: x + CURSOR_OFFSET,
        top: y + CURSOR_OFFSET,
        transform,
      }}
    >
      <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Step {index + 1}
      </div>
      <div className="truncate text-[13px] font-medium text-foreground" title={segment.label}>
        {segment.label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-muted-foreground">Count</span>
        <span className="font-semibold text-foreground tabular-nums">
          {numberFormatter.format(segment.count)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-muted-foreground">Retention</span>
        <span className="font-semibold text-foreground tabular-nums">
          {Math.round(segment.retention * 100)}%
        </span>
      </div>
      {segment.stepDrop !== null && (
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-muted-foreground">Drop vs. previous</span>
          <span className="font-semibold text-foreground tabular-nums">
            −{Math.round(segment.stepDrop * 100)}%
          </span>
        </div>
      )}
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
      <div>
        <FunnelChart segments={segments} />
      </div>
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
