import type { QuestionDropoffRow } from "@/types/analytics";

export interface StepDropoffMetrics {
  stepId: string;
  stepIndex: number;
  stepLabel?: string;
  viewCount: number;
  startCount: number;
  completeCount: number;
  dropoffCount: number;
  terminalDropoffCount: number;
  dropoffRate: number | null;
  completionRate: number | null;
  questions: QuestionDropoffRow[];
}

interface StepAggregate {
  stepId: string;
  stepIndex: number;
  viewCount: number;
  startCount: number;
  completeCount: number;
  dropoffCount: number;
  terminalDropoffCount: number;
  questions: QuestionDropoffRow[];
}

// Per-Question → per-Step, skipping null-stepId rows (legacy pre-rework). Set-based,
// not additive: a visit touches every Question once, so summing would multiply by
// Question count. Exception: terminalDropoff — each visit terminates at one Question,
// so summing per-Question terminals counts visits that gave up in the Step.
export const rollupToSteps = (questions: readonly QuestionDropoffRow[]): StepDropoffMetrics[] => {
  const byStep = new Map<string, StepAggregate>();

  for (const q of questions) {
    if (q.stepId === null || q.stepIndex === null) {
      continue;
    }
    const existing = byStep.get(q.stepId);
    const agg: StepAggregate = existing ?? {
      stepId: q.stepId,
      stepIndex: q.stepIndex,
      viewCount: 0,
      startCount: 0,
      // Sentinel: first Math.min becomes the running min.
      completeCount: Number.POSITIVE_INFINITY,
      dropoffCount: 0,
      terminalDropoffCount: 0,
      questions: [],
    };
    if (!existing) {
      byStep.set(q.stepId, agg);
    }
    agg.viewCount = Math.max(agg.viewCount, q.viewCount);
    agg.startCount = Math.max(agg.startCount, q.startCount);
    agg.completeCount = Math.min(agg.completeCount, q.completeCount);
    agg.terminalDropoffCount += q.terminalDropoffCount;
    agg.questions.push(q);
  }

  const steps: StepDropoffMetrics[] = [];
  for (const agg of byStep.values()) {
    const dropoffCount = Math.max(0, agg.viewCount - agg.completeCount);
    const dropoffRate = agg.viewCount > 0 ? Math.round((dropoffCount / agg.viewCount) * 100) : null;
    const completionRate =
      agg.viewCount > 0 ? Math.round((agg.completeCount / agg.viewCount) * 100) : null;
    steps.push({
      stepId: agg.stepId,
      stepIndex: agg.stepIndex,
      stepLabel: undefined,
      viewCount: agg.viewCount,
      startCount: agg.startCount,
      completeCount: agg.completeCount,
      dropoffCount,
      terminalDropoffCount: agg.terminalDropoffCount,
      dropoffRate,
      completionRate,
      questions: agg.questions.toSorted((a, b) => a.questionIndex - b.questionIndex),
    });
  }

  return steps.toSorted((a, b) => a.stepIndex - b.stepIndex);
};
