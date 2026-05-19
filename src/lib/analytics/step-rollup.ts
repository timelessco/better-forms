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

// Rolls up per-Question metrics into per-Step metrics. Skips questions with
// a null stepId (legacy pre-rework rows). Step-level counts are summed from
// the underlying questions, and dropoff/completion rates are recomputed
// from the summed counts so the rolled-up percentage is well-defined.
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
      completeCount: 0,
      dropoffCount: 0,
      terminalDropoffCount: 0,
      questions: [],
    };
    if (!existing) {
      byStep.set(q.stepId, agg);
    }
    agg.viewCount += q.viewCount;
    agg.startCount += q.startCount;
    agg.completeCount += q.completeCount;
    agg.dropoffCount += q.dropoffCount;
    agg.terminalDropoffCount += q.terminalDropoffCount;
    agg.questions.push(q);
  }

  const steps: StepDropoffMetrics[] = [];
  for (const agg of byStep.values()) {
    const dropoffRate =
      agg.viewCount > 0 ? Math.round((agg.dropoffCount / agg.viewCount) * 100) : null;
    const completionRate =
      agg.viewCount > 0 ? Math.round((agg.completeCount / agg.viewCount) * 100) : null;
    steps.push({
      stepId: agg.stepId,
      stepIndex: agg.stepIndex,
      stepLabel: undefined,
      viewCount: agg.viewCount,
      startCount: agg.startCount,
      completeCount: agg.completeCount,
      dropoffCount: agg.dropoffCount,
      terminalDropoffCount: agg.terminalDropoffCount,
      dropoffRate,
      completionRate,
      questions: agg.questions.toSorted((a, b) => a.questionIndex - b.questionIndex),
    });
  }

  return steps.toSorted((a, b) => a.stepIndex - b.stepIndex);
};
