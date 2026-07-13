import { cappedDurationMs } from "@/lib/analytics/duration";
import type {
  FormAnswerMetrics,
  FormInsightsMetrics,
  QuestionAnswerSummary,
  QuestionDropoffMetrics,
} from "@/types/analytics";

export type DropoffMode = "multi-step" | "single-page";

export interface DropoffMetricRow {
  viewCount: number;
  startCount: number;
  completeCount: number;
}

export type DropoffRowKind = "step" | "question";

export const modeForStepCount = (stepCount: number): DropoffMode =>
  stepCount > 1 ? "multi-step" : "single-page";

export const completionRate = (completed: number, visits: number, capAt100 = true): number => {
  if (visits <= 0) {
    return 0;
  }
  const rate = Math.round((completed / visits) * 100);
  return capAt100 ? Math.min(100, rate) : rate;
};

export const dropoffRate = (
  row: DropoffMetricRow,
  mode: DropoffMode,
  kind: DropoffRowKind = "step",
): number | null => {
  const useViewDenominator = mode === "multi-step" && kind === "step";
  const denominator = useViewDenominator ? row.viewCount : row.startCount;
  if (denominator <= 0) {
    return null;
  }
  const numerator = useViewDenominator
    ? row.viewCount - row.completeCount
    : row.startCount - row.completeCount;
  return Math.round((Math.max(0, numerator) / denominator) * 100);
};

// Median of a number list (null for empty). Outlier-resistant central value; even-length lists
// average the two middle samples (rounded). Shared by the daily rollup and the merge reader.
export const median = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1] ?? 0;
    const hi = sorted[mid] ?? 0;
    return Math.round((lo + hi) / 2);
  }
  return sorted[mid] ?? null;
};

// Blend per-day completion-time medians into one figure, weighted by each day's duration SAMPLE
// count (its submitted visits), NOT total visits — durations come from submitters only, so a
// high-traffic/low-conversion day must not outweigh a low-traffic/high-conversion one.
export const weightedMedianDuration = (
  rows: readonly { medianDurationMs: number | null; sampleCount: number }[],
): number | null => {
  let weightedSum = 0;
  let samples = 0;
  for (const row of rows) {
    if (row.medianDurationMs !== null && row.sampleCount > 0) {
      weightedSum += cappedDurationMs(row.medianDurationMs) * row.sampleCount;
      samples += row.sampleCount;
    }
  }
  return samples > 0 ? Math.round(weightedSum / samples) : null;
};

export interface AnalyticsFunnelPoint {
  label: string;
  title: string;
  count: number;
  retention: number;
  stepDrop: number | null;
}

export interface AnalyticsDropoffRow {
  label: string;
  qLabel: string;
  rate: number;
}

export interface MostSkippedQuestion {
  qLabel: string;
  skip: number;
}

export const analyticsCompletionRate = (metrics: FormInsightsMetrics | undefined): number =>
  metrics ? completionRate(metrics.completedSubmissions, metrics.totalVisits) : 0;

export const analyticsChartData = (metrics: FormInsightsMetrics | undefined) =>
  (metrics?.dailyData ?? []).map((day) => ({
    date: day.date,
    visits: day.visits,
    submissions: day.submissions,
    partial: Math.max(0, day.visits - day.submissions),
  }));

export const analyticsBreakdowns = (metrics: FormInsightsMetrics | undefined) => ({
  sources: metrics?.sources ?? {},
  devices: metrics?.devices ?? {},
  browsers: metrics?.browsers ?? {},
  operatingSystems: metrics?.operatingSystems ?? {},
  countries: metrics?.countries ?? {},
  cities: metrics?.cities ?? {},
});

export const questionDropoffLabel = (question: QuestionDropoffMetrics["questions"][number]) =>
  question.questionLabel?.trim() || `Q${question.questionIndex + 1}`;

export const analyticsFunnelData = (
  dropoff: QuestionDropoffMetrics | undefined,
): AnalyticsFunnelPoint[] => {
  const sorted = [...(dropoff?.questions ?? [])].sort((a, b) => a.questionIndex - b.questionIndex);
  const first = sorted[0]?.startCount ?? 0;
  return sorted.map((question, index) => {
    const count = question.startCount;
    const prev = index === 0 ? null : sorted[index - 1].startCount;
    return {
      label: `Q${question.questionIndex + 1}`,
      title: questionDropoffLabel(question),
      count,
      retention: first > 0 ? count / first : 0,
      stepDrop: prev == null || prev === 0 ? null : Math.max(0, 1 - count / prev),
    };
  });
};

export const analyticsDropoffRows = (
  dropoff: QuestionDropoffMetrics | undefined,
): AnalyticsDropoffRow[] =>
  [...(dropoff?.questions ?? [])]
    .map((question) => ({
      label: questionDropoffLabel(question),
      qLabel: `Q${question.questionIndex + 1}`,
      rate: question.dropoffRate,
    }))
    .sort((a, b) => b.rate - a.rate);

export const analyticsTotalDropoffs = (dropoff: QuestionDropoffMetrics | undefined): number =>
  dropoff ? dropoff.totalStarted - dropoff.totalCompleted : 0;

export const analyticsBiggestDropoff = (
  rows: readonly AnalyticsDropoffRow[],
): AnalyticsDropoffRow | undefined => rows[0];

export const visibleAnswerQuestions = (
  answers: FormAnswerMetrics | undefined,
): QuestionAnswerSummary[] => {
  const visible = (answers?.questions ?? []).filter(
    (question) =>
      (question.analysis === "choice" ||
        question.fieldType === "Email" ||
        question.fieldType === "Matrix") &&
      question.answered > 0 &&
      question.distribution.length > 0,
  );
  const charts = visible.filter((question) => question.analysis === "choice");
  const lists = visible.filter((question) => question.analysis !== "choice");
  return [...charts, ...lists];
};

export const mostSkippedQuestion = (
  answers: FormAnswerMetrics | undefined,
): MostSkippedQuestion | null => {
  if (!answers || answers.submissions === 0 || answers.questions.length === 0) {
    return null;
  }
  const question = [...answers.questions].sort((a, b) => a.answered - b.answered)[0];
  return {
    qLabel: `Q${question.questionIndex + 1}`,
    skip: Math.round((1 - question.answered / answers.submissions) * 100),
  };
};

export const fillRate = (answered: number, totalQuestions: number): number | null =>
  totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : null;
