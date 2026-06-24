import { useMemo } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRightIcon, InfoIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PER_QUESTION_ANALYTICS_CUT_TS } from "@/lib/analytics/cut-date";
import { computeDropoffRate, modeForStepCount } from "@/lib/analytics/dropoff-metric";
import type { DropoffMode } from "@/lib/analytics/dropoff-metric";
import { formatPercent, numberFormatter } from "@/lib/analytics/format";
import { rollupToSteps } from "@/lib/analytics/step-rollup";
import type { StepDropoffMetrics } from "@/lib/analytics/step-rollup";
import { cn } from "@/lib/utils";
import type { QuestionDropoffMetrics, QuestionDropoffRow } from "@/types/analytics";

interface DropoffFunnelProps {
  dropoff: QuestionDropoffMetrics;
}

const formatStepLabel = (step: StepDropoffMetrics): string =>
  step.stepLabel ?? `Step ${step.stepIndex + 1}`;

const formatQuestionLabel = (q: QuestionDropoffRow): string => {
  if (q.questionLabel) {
    return q.questionLabel;
  }
  return q.questionId;
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
    <span className="text-lg font-semibold text-foreground">{value}</span>
  </div>
);

interface CutDateBannerProps {
  startDate: string;
}

// Surfaces per-Question rework cut-date when selected range predates it; older data hidden from funnel — see ADR-0002.
const CutDateBanner = ({ startDate }: CutDateBannerProps) => {
  const cutDateKey = PER_QUESTION_ANALYTICS_CUT_TS.slice(0, 10);
  if (startDate >= cutDateKey) {
    return null;
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>Drop-off data available from {cutDateKey}.</span>
    </div>
  );
};

interface DropoffHeaderProps {
  mode: DropoffMode;
  singleStep: boolean;
}

const DropoffHeader = ({ mode, singleStep }: DropoffHeaderProps) => {
  const tooltipText =
    mode === "multi-step"
      ? "Drop-off = % who viewed but didn't complete"
      : "Drop-off = % who started but didn't complete";
  return (
    <div className="grid h-9 grid-cols-[24px_minmax(0,1fr)_80px_90px_90px_100px] items-center gap-3 border-b border-border px-2.5 text-[13px] font-normal text-secondary-foreground/80">
      <span aria-hidden="true" />
      <span>{singleStep ? "Question" : "Step / Question"}</span>
      <span className="text-right">Viewed</span>
      <span className="text-right">Started</span>
      <span className="text-right">Completed</span>
      <span className="flex items-center justify-end gap-1">
        <span>Drop-off %</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Drop-off metric explanation"
                className="inline-flex cursor-help text-muted-foreground hover:text-foreground"
              />
            }
          >
            <InfoIcon className="size-3" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </span>
    </div>
  );
};

interface QuestionRowProps {
  question: QuestionDropoffRow;
  index: number;
  mode: DropoffMode;
}

// Flat top-level row for single-step Forms: StepRow grid minus chevron/accordion, so Question is the primary row.
const QuestionRow = ({ question, index, mode }: QuestionRowProps) => {
  const dropoffRate = computeDropoffRate(question, mode, "question");
  const label = formatQuestionLabel(question);
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_80px_90px_90px_100px] items-center gap-3 border-b border-border px-2.5 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-muted/40">
      <span aria-hidden="true" />
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{index + 1}.</span>
        <span className="truncate font-medium text-foreground" title={label}>
          {label}
        </span>
      </span>
      <span className="text-right">{numberFormatter.format(question.viewCount)}</span>
      <span className="text-right">{numberFormatter.format(question.startCount)}</span>
      <span className="text-right">{numberFormatter.format(question.completeCount)}</span>
      <span className="text-right">{formatPercent(dropoffRate)}</span>
    </div>
  );
};

interface StepRowProps {
  step: StepDropoffMetrics;
  mode: DropoffMode;
}

const StepRow = ({ step, mode }: StepRowProps) => {
  const dropoffRate = computeDropoffRate(step, mode, "step");
  const stepLabel = formatStepLabel(step);
  const hasQuestions = step.questions.length > 0;

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "group/funnel-step grid w-full grid-cols-[24px_minmax(0,1fr)_80px_90px_90px_100px] items-center gap-3 border-b border-border px-2.5 py-2 text-left text-[13px] transition-colors last:border-b-0 hover:bg-muted/40",
          !hasQuestions && "pointer-events-none",
        )}
        disabled={!hasQuestions}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded/funnel-step:rotate-90",
            !hasQuestions && "opacity-0",
          )}
          aria-hidden="true"
        />
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">{step.stepIndex + 1}.</span>
          <span className="truncate font-medium text-foreground" title={stepLabel}>
            {stepLabel}
          </span>
        </span>
        <span className="text-right">{numberFormatter.format(step.viewCount)}</span>
        <span className="text-right">{numberFormatter.format(step.startCount)}</span>
        <span className="text-right">{numberFormatter.format(step.completeCount)}</span>
        <span className="text-right">{formatPercent(dropoffRate)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/30">
          {step.questions.map((q) => {
            const qDropoff = computeDropoffRate(q, mode, "question");
            return (
              <div
                key={q.questionId}
                className="grid grid-cols-[24px_minmax(0,1fr)_80px_90px_90px_100px] items-center gap-3 border-t border-border/60 px-2.5 py-2 text-[13px] transition-colors hover:bg-muted/50"
              >
                <span aria-hidden="true" />
                <span className="flex min-w-0 items-center gap-2 pl-4">
                  <span className="truncate text-muted-foreground" title={formatQuestionLabel(q)}>
                    {formatQuestionLabel(q)}
                  </span>
                </span>
                <span className="text-right">{numberFormatter.format(q.viewCount)}</span>
                <span className="text-right">{numberFormatter.format(q.startCount)}</span>
                <span className="text-right">{numberFormatter.format(q.completeCount)}</span>
                <span className="text-right">{formatPercent(qDropoff)}</span>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const DropoffFunnel = ({ dropoff }: DropoffFunnelProps) => {
  const steps = useMemo(() => rollupToSteps(dropoff.questions), [dropoff.questions]);
  const mode = modeForStepCount(steps.length);

  const isEmpty = steps.length === 0 || steps.every((s) => s.viewCount === 0);

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <CutDateBanner startDate={dropoff.startDate} />
        <div className="p-6 text-center text-sm text-muted-foreground">
          No drop-off data yet for this Form. Drop-off appears once Respondents start filling it
          out.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CutDateBanner startDate={dropoff.startDate} />
      <div className="overflow-x-auto">
        <DropoffHeader mode={mode} singleStep={steps.length <= 1} />
        <div>
          {steps.length === 1
            ? steps[0].questions.map((q, i) => (
                <QuestionRow key={q.questionId} question={q} index={i} mode={mode} />
              ))
            : steps.map((step) => <StepRow key={step.stepId} step={step} mode={mode} />)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat label="Total started" value={numberFormatter.format(dropoff.totalStarted)} />
        <SummaryStat
          label="Total completed"
          value={numberFormatter.format(dropoff.totalCompleted)}
        />
        <SummaryStat
          label="Overall completion"
          value={formatPercent(dropoff.overallCompletionRate)}
        />
      </div>
    </div>
  );
};
