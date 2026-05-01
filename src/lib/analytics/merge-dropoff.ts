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

  const questions = Array.from(byQuestion.values())
    .toSorted((a, b) => a.questionIndex - b.questionIndex)
    .map((agg) => {
      const dropoffCount = agg.viewCount - agg.completeCount;
      const dropoffRate = agg.viewCount > 0 ? Math.round((dropoffCount / agg.viewCount) * 100) : 0;
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
