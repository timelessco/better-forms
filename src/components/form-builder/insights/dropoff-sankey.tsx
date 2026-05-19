import { useEffect, useMemo, useRef, useState } from "react";

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

const STEP_ID_RE = /^step_(\d+)$/;

const formatStepLabel = (step: StepDropoffMetrics): string => {
  if (step.stepLabel) return step.stepLabel;
  const firstLabel = step.questions[0]?.questionLabel;
  if (firstLabel) return firstLabel;
  const match = step.stepId.match(STEP_ID_RE);
  if (match) return `Step ${Number(match[1]) + 1}`;
  return `Step ${step.stepIndex + 1}`;
};

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
const DEFAULT_CONTAINER_WIDTH = 800;

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

const FunnelChart = ({ segments }: FunnelChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(DEFAULT_CONTAINER_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) {
        setContainerWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { pathD, topD, segmentWidth, viewBoxWidth } = useMemo(() => {
    const segCount = segments.length;
    const viewBoxW = containerWidth;
    const segW = viewBoxW / Math.max(1, segCount);
    const maxCount = Math.max(1, ...segments.map((s) => s.count));
    const usableHeight = CHART_HEIGHT - TOP_PADDING;
    const heights = segments.map((s) => Math.max(MIN_BAR_RATIO, s.count / maxCount));
    const tops = heights.map((h) => CHART_HEIGHT - h * usableHeight);

    const stepCommands = buildSteppedTopCommands(tops, segW, viewBoxW);

    const top = segCount === 0 ? "" : [`M 0 ${tops[0]}`, ...stepCommands].join(" ");
    const fill =
      segCount === 0
        ? ""
        : [
            `M 0 ${CHART_HEIGHT}`,
            `L 0 ${tops[0]}`,
            ...stepCommands,
            `L ${viewBoxW} ${CHART_HEIGHT}`,
            "Z",
          ].join(" ");

    return {
      pathD: fill,
      topD: top,
      segmentWidth: segW,
      viewBoxWidth: viewBoxW,
    };
  }, [segments, containerWidth]);

  const gradientStops = useMemo(() => {
    if (segments.length === 0) return [];
    const stops: Array<{ offset: string; opacity: number; key: string }> = [];
    segments.forEach((_, i) => {
      const startPct = (i / segments.length) * 100;
      const endPct = ((i + 1) / segments.length) * 100;
      const opacity = 0.12 + (i / Math.max(1, segments.length - 1)) * 0.55;
      stops.push({ key: `${i}-a`, offset: `${startPct}%`, opacity });
      stops.push({ key: `${i}-b`, offset: `${endPct}%`, opacity });
    });
    return stops;
  }, [segments]);

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
      >
        {segments.map((seg, i) => (
          <div
            key={seg.id}
            className={cn("flex flex-col gap-1 px-3 py-2", i > 0 && "border-l border-border/60")}
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
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: CHART_HEIGHT }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dropoff-funnel-gradient" x1="0" y1="0" x2="1" y2="0">
            {gradientStops.map((stop) => (
              <stop
                key={stop.key}
                offset={stop.offset}
                stopColor="oklch(0.62 0.18 270)"
                stopOpacity={stop.opacity}
              />
            ))}
          </linearGradient>
        </defs>
        {segments.slice(0, -1).map((seg, i) => {
          const x = (i + 1) * segmentWidth;
          return (
            <line
              key={seg.id}
              x1={x}
              y1={0}
              x2={x}
              y2={CHART_HEIGHT}
              stroke="oklch(0.92 0.01 270)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <path d={pathD} fill="url(#dropoff-funnel-gradient)" />
        <path
          d={topD}
          fill="none"
          stroke="oklch(0.62 0.18 270)"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
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
      <div className="overflow-hidden rounded-xl border border-border bg-background">
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
  <div className="flex flex-col gap-1 rounded-xl border border-border px-3 py-2">
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {label}
    </span>
    <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
  </div>
);
