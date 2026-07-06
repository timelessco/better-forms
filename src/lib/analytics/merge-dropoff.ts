import type { formDropoffDaily, formQuestionProgress } from "@/db/schema";
import { completionRate, dropoffRate } from "@/lib/analytics/metrics";
import type { QuestionDropoffMetrics } from "@/types/analytics";

type DropoffDailyRow = typeof formDropoffDaily.$inferSelect;
type QuestionProgressRow = typeof formQuestionProgress.$inferSelect;

interface FilterByCutDateInput {
  dailyRows: readonly DropoffDailyRow[];
  todayProgressRows: readonly QuestionProgressRow[];
  cutTs: string;
}

interface FilterByCutDateOutput {
  dailyRows: DropoffDailyRow[];
  todayProgressRows: QuestionProgressRow[];
}

// Drops pre-cut rows from the funnel. Daily rows compare by `date` string
// (≥ cutTs[:10]); raw progress rows compare by `viewedAt` Date.
export const filterByCutDate = (input: FilterByCutDateInput): FilterByCutDateOutput => {
  const cutDateKey = input.cutTs.slice(0, 10);
  const cutDate = new Date(input.cutTs);
  return {
    dailyRows: input.dailyRows.filter((row) => row.date >= cutDateKey),
    todayProgressRows: input.todayProgressRows.filter((row) => row.viewedAt >= cutDate),
  };
};

interface MergeDropoffArgs {
  formId: string;
  startDate: string;
  endDate: string;
  dailyRows: DropoffDailyRow[];
  todayProgressRows: QuestionProgressRow[];
  /** Question id → label (from Form's Plate content). Sets `questionLabel` so
   * the funnel shows "Full Name" not the raw Plate Block id. */
  labelMap?: ReadonlyMap<string, string>;
}

interface QuestionAggregate {
  questionId: string;
  questionIndex: number;
  stepId: string | null;
  stepIndex: number | null;
  viewCount: number;
  startCount: number;
  completeCount: number;
  terminalDropoffCount: number;
}

const getOrCreateAggregate = (
  byQuestion: Map<string, QuestionAggregate>,
  questionId: string,
  questionIndex: number,
): QuestionAggregate => {
  const existing = byQuestion.get(questionId);
  if (existing) {
    return existing;
  }
  const created: QuestionAggregate = {
    questionId,
    questionIndex,
    stepId: null,
    stepIndex: null,
    viewCount: 0,
    startCount: 0,
    completeCount: 0,
    terminalDropoffCount: 0,
  };
  byQuestion.set(questionId, created);
  return created;
};

export const mergeDropoffMetrics = (args: MergeDropoffArgs): QuestionDropoffMetrics => {
  const { formId, startDate, endDate, dailyRows, todayProgressRows, labelMap } = args;

  const byQuestion = new Map<string, QuestionAggregate>();

  for (const row of dailyRows) {
    const agg = getOrCreateAggregate(byQuestion, row.questionId, row.questionIndex);
    agg.viewCount += row.viewCount;
    agg.startCount += row.startCount;
    agg.completeCount += row.completeCount;
    agg.terminalDropoffCount += row.terminalDropoffCount;
    if (agg.stepId === null && row.stepId !== null) {
      agg.stepId = row.stepId;
    }
    if (agg.stepIndex === null && row.stepIndex !== null) {
      agg.stepIndex = row.stepIndex;
    }
  }

  for (const row of todayProgressRows) {
    const agg = getOrCreateAggregate(byQuestion, row.questionId, row.questionIndex);
    agg.viewCount += 1;
    if (row.startedAt !== null) {
      agg.startCount += 1;
    }
    if (row.completedAt !== null) {
      agg.completeCount += 1;
    }
    if (agg.stepId === null && row.stepId !== null) {
      agg.stepId = row.stepId;
    }
    if (agg.stepIndex === null && row.stepIndex !== null) {
      agg.stepIndex = row.stepIndex;
    }
  }

  const sorted = Array.from(byQuestion.values()).toSorted(
    (a, b) => a.questionIndex - b.questionIndex,
  );

  // Step-to-step drop-off:
  // - First step: intra-step = (viewed − completed) / viewed (no prior step).
  // - Subsequent: cross-step = (prev.completed − this.viewed) / prev.completed.
  //   Catches "finished step N, never reached N+1" — intra-step math hides this
  //   at 0% since viewCount/completeCount drop in lockstep.
  // Clamp dropoffCount ≥ 0: viewCount can exceed prev.completeCount on re-entry/
  // out-of-order events.
  const questions = sorted.map((agg, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const cohort = prev ? prev.completeCount : agg.viewCount;
    const reached = prev ? agg.viewCount : agg.completeCount;
    const dropoffCount = Math.max(0, cohort - reached);
    const rowDropoffRate =
      dropoffRate(
        { viewCount: cohort, startCount: cohort, completeCount: reached },
        "single-page",
      ) ?? 0;
    const rowCompletionRate = completionRate(agg.completeCount, agg.viewCount, false);
    return {
      questionId: agg.questionId,
      questionIndex: agg.questionIndex,
      questionLabel: labelMap?.get(agg.questionId),
      stepId: agg.stepId,
      stepIndex: agg.stepIndex,
      viewCount: agg.viewCount,
      startCount: agg.startCount,
      completeCount: agg.completeCount,
      dropoffCount,
      terminalDropoffCount: agg.terminalDropoffCount,
      dropoffRate: rowDropoffRate,
      completionRate: rowCompletionRate,
    };
  });

  // Overall funnel:
  // - totalStarted = startCount of lowest-questionIndex question ("started form").
  // - totalCompleted = completeCount of last question. No `wasLastQuestion` in
  //   daily rollups, so v1 uses max questionIndex as the "last question" proxy.
  const totalStarted = questions.length > 0 ? questions[0].startCount : 0;
  const totalCompleted = questions.length > 0 ? questions[questions.length - 1].completeCount : 0;
  const overallCompletionRate = completionRate(totalCompleted, totalStarted, false);

  return {
    formId,
    startDate,
    endDate,
    questions,
    totalStarted,
    totalCompleted,
    overallCompletionRate,
    // Proxy default; getFormDropoffImpl overrides with the authoritative submissions-table count.
    completedSubmissions: totalCompleted,
    // Prior-period delta needs a second query; getFormDropoffImpl fills this in.
    totalDropoffsDeltaPct: null,
    // Per-question timing comes from raw progress rows; getFormDropoffImpl fills this in.
    timePerQuestion: [],
  };
};
