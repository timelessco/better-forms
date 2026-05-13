import type { formDropoffDaily, formQuestionProgress } from "@/db/schema";
import type { QuestionDropoffMetrics } from "@/types/analytics";

type DropoffDailyRow = typeof formDropoffDaily.$inferSelect;
type QuestionProgressRow = typeof formQuestionProgress.$inferSelect;

interface MergeDropoffArgs {
  formId: string;
  startDate: string;
  endDate: string;
  dailyRows: DropoffDailyRow[];
  todayProgressRows: QuestionProgressRow[];
}

interface QuestionAggregate {
  questionId: string;
  questionIndex: number;
  viewCount: number;
  startCount: number;
  completeCount: number;
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
    viewCount: 0,
    startCount: 0,
    completeCount: 0,
  };
  byQuestion.set(questionId, created);
  return created;
};

export const mergeDropoffMetrics = (args: MergeDropoffArgs): QuestionDropoffMetrics => {
  const { formId, startDate, endDate, dailyRows, todayProgressRows } = args;

  const byQuestion = new Map<string, QuestionAggregate>();

  for (const row of dailyRows) {
    const agg = getOrCreateAggregate(byQuestion, row.questionId, row.questionIndex);
    agg.viewCount += row.viewCount;
    agg.startCount += row.startCount;
    agg.completeCount += row.completeCount;
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
  }

  const sorted = Array.from(byQuestion.values()).toSorted(
    (a, b) => a.questionIndex - b.questionIndex,
  );

  // Step-to-step drop-off semantics:
  //   - First step: intra-step drop = (viewed − completed) / viewed. There's
  //     no prior step, so this is the only meaningful "where did people fall
  //     off" measure for the first question.
  //   - Subsequent steps: cross-step drop = (prev.completed − this.viewed) /
  //     prev.completed. Captures the case where a visitor finishes step N
  //     but never even reaches step N+1 — which intra-step math (which only
  //     compares viewers vs. completers of the SAME step) silently hides at
  //     0% because viewCount and completeCount drop in lockstep.
  // Cohort: viewCount can technically exceed prev.completeCount in pathological
  // cases (re-entry, out-of-order events) — clamp dropoffCount to ≥ 0 so the
  // rate doesn't go negative.
  const questions = sorted.map((agg, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const cohort = prev ? prev.completeCount : agg.viewCount;
    const reached = prev ? agg.viewCount : agg.completeCount;
    const dropoffCount = Math.max(0, cohort - reached);
    const dropoffRate = cohort > 0 ? Math.round((dropoffCount / cohort) * 100) : 0;
    const completionRate =
      agg.viewCount > 0 ? Math.round((agg.completeCount / agg.viewCount) * 100) : 0;
    return {
      questionId: agg.questionId,
      questionIndex: agg.questionIndex,
      // questionLabel is not derivable from analytics tables alone in v1;
      // the UI hydrates it from the form schema separately.
      questionLabel: undefined,
      viewCount: agg.viewCount,
      startCount: agg.startCount,
      completeCount: agg.completeCount,
      dropoffCount,
      dropoffRate,
      completionRate,
    };
  });

  // Overall funnel:
  // - totalStarted = startCount of the question with the lowest questionIndex
  //   (the first question starting counts the visitor as "started form").
  // - totalCompleted = completeCount of the "last question". The schema does
  //   not preserve `wasLastQuestion` in daily rollups, so for v1 we use the
  //   max questionIndex present in the data as a proxy for "last question".
  const totalStarted = questions.length > 0 ? questions[0].startCount : 0;
  const totalCompleted = questions.length > 0 ? questions[questions.length - 1].completeCount : 0;
  const overallCompletionRate =
    totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  return {
    formId,
    startDate,
    endDate,
    questions,
    totalStarted,
    totalCompleted,
    overallCompletionRate,
  };
};
