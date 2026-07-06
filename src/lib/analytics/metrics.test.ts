import { describe, expect, it } from "vitest";

import {
  analyticsBiggestDropoff,
  analyticsCompletionRate,
  analyticsDropoffRows,
  analyticsFunnelData,
  analyticsTotalDropoffs,
  completionRate,
  dropoffRate,
  fillRate,
  mostSkippedQuestion,
  weightedMedianDuration,
} from "@/lib/analytics/metrics";
import type {
  FormAnswerMetrics,
  FormInsightsMetrics,
  QuestionDropoffMetrics,
} from "@/types/analytics";

describe("analytics metrics", () => {
  it.each([
    { completed: 3, visits: 4, expected: 75 },
    { completed: 5, visits: 4, expected: 100 },
    { completed: 0, visits: 0, expected: 0 },
  ])("computes capped completion rate", ({ completed, visits, expected }) => {
    expect(completionRate(completed, visits)).toBe(expected);
  });

  it.each([
    {
      row: { viewCount: 10, startCount: 8, completeCount: 6 },
      mode: "multi-step" as const,
      kind: "step" as const,
      expected: 40,
    },
    {
      row: { viewCount: 10, startCount: 8, completeCount: 6 },
      mode: "multi-step" as const,
      kind: "question" as const,
      expected: 25,
    },
    {
      row: { viewCount: 10, startCount: 8, completeCount: 6 },
      mode: "single-page" as const,
      kind: "step" as const,
      expected: 25,
    },
    {
      row: { viewCount: 10, startCount: 0, completeCount: 0 },
      mode: "single-page" as const,
      kind: "step" as const,
      expected: null,
    },
  ])("computes mode-aware dropoff rate", ({ row, mode, kind, expected }) => {
    expect(dropoffRate(row, mode, kind)).toBe(expected);
  });

  it("computes sample-weighted duration from median duration rows", () => {
    // Weighted by sampleCount (submitters); the null-median row is ignored regardless of its weight.
    expect(
      weightedMedianDuration([
        { medianDurationMs: 1_000, sampleCount: 1 },
        { medianDurationMs: 3_000, sampleCount: 3 },
        { medianDurationMs: null, sampleCount: 10 },
      ]),
    ).toBe(2_500);
  });

  it("weights the median blend by sample count, so a high-sample slow day dominates a low-sample fast day", () => {
    // 1 sample @ 60s vs 9 samples @ 6s → (60000*1 + 6000*9) / 10 = 11400; not the midpoint 33000.
    expect(
      weightedMedianDuration([
        { medianDurationMs: 60_000, sampleCount: 1 },
        { medianDurationMs: 6_000, sampleCount: 9 },
      ]),
    ).toBe(11_400);
  });

  it("computes moved route dropoff derivations", () => {
    const dropoff = dropoffMetrics([
      question({ questionIndex: 1, questionLabel: "Email", startCount: 8, dropoffRate: 25 }),
      question({ questionIndex: 0, questionLabel: "Name", startCount: 10, dropoffRate: 10 }),
    ]);

    const funnel = analyticsFunnelData(dropoff);
    const rows = analyticsDropoffRows(dropoff);

    expect(funnel[0]).toEqual({
      label: "Q1",
      title: "Name",
      count: 10,
      retention: 1,
      stepDrop: null,
    });
    expect(funnel[1]).toMatchObject({ label: "Q2", title: "Email", count: 8, retention: 0.8 });
    expect(funnel[1].stepDrop).toBeCloseTo(0.2);
    expect(rows.map((row) => row.qLabel)).toEqual(["Q2", "Q1"]);
    expect(analyticsTotalDropoffs(dropoff)).toBe(4);
    expect(analyticsBiggestDropoff(rows)).toEqual(rows[0]);
  });

  it("computes moved route insight and answer derivations", () => {
    expect(
      analyticsCompletionRate(insightsMetrics({ completedSubmissions: 7, totalVisits: 10 })),
    ).toBe(70);
    expect(fillRate(2.4, 4)).toBe(60);
    expect(
      mostSkippedQuestion(
        answerMetrics([
          { questionIndex: 0, answered: 9 },
          { questionIndex: 1, answered: 4 },
        ]),
      ),
    ).toEqual({ qLabel: "Q2", skip: 60 });
  });
});

const question = (
  overrides: Partial<QuestionDropoffMetrics["questions"][number]>,
): QuestionDropoffMetrics["questions"][number] => ({
  questionId: `q${overrides.questionIndex ?? 0}`,
  questionIndex: overrides.questionIndex ?? 0,
  questionLabel: overrides.questionLabel,
  stepId: null,
  stepIndex: null,
  viewCount: 0,
  startCount: 0,
  completeCount: 0,
  dropoffCount: 0,
  terminalDropoffCount: 0,
  dropoffRate: 0,
  completionRate: 0,
  ...overrides,
});

const dropoffMetrics = (
  questions: QuestionDropoffMetrics["questions"],
): QuestionDropoffMetrics => ({
  formId: "form_1",
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  questions,
  totalStarted: 10,
  totalCompleted: 6,
  overallCompletionRate: 60,
  completedSubmissions: 6,
  totalDropoffsDeltaPct: null,
  timePerQuestion: [],
});

const insightsMetrics = (
  overrides: Pick<FormInsightsMetrics, "completedSubmissions" | "totalVisits">,
): FormInsightsMetrics => ({
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  totalVisits: overrides.totalVisits,
  uniqueVisitors: 0,
  totalSubmissions: 0,
  completedSubmissions: overrides.completedSubmissions,
  uniqueRespondents: 0,
  avgVisitDurationMs: 0,
  visitsDeltaPct: null,
  submissionsDeltaPct: null,
  completionRateDeltaPts: null,
  avgDurationDeltaMs: null,
  sources: {},
  devices: {},
  countries: {},
  cities: {},
  browsers: {},
  operatingSystems: {},
  dailyData: [],
});

const answerMetrics = (
  questions: { questionIndex: number; answered: number }[],
): FormAnswerMetrics => ({
  startDate: "2026-01-01",
  endDate: "2026-01-02",
  submissions: 10,
  totalQuestions: 2,
  avgAnswered: 1.3,
  questions: questions.map((question) => ({
    id: `q${question.questionIndex}`,
    questionIndex: question.questionIndex,
    label: `Q${question.questionIndex + 1}`,
    fieldType: "Text",
    analysis: "raw",
    answered: question.answered,
    distribution: [{ label: "Answer", value: question.answered }],
  })),
});
