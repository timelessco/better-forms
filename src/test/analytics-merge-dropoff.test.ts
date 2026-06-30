import { describe, expect, it } from "vitest";
import type { formDropoffDaily, formQuestionProgress } from "@/db/schema";
import { mergeDropoffMetrics } from "@/lib/analytics/merge-dropoff";

type DropoffDailyRow = typeof formDropoffDaily.$inferSelect;
type QuestionProgressRow = typeof formQuestionProgress.$inferSelect;

const baseTimestamp = new Date("2026-04-27T00:00:00Z");

const makeDaily = (
  overrides: Partial<DropoffDailyRow> & {
    questionId: string;
    questionIndex: number;
    date: string;
  },
): DropoffDailyRow => {
  const { questionId, questionIndex, date, ...rest } = overrides;
  return {
    id: `daily-${date}-${questionId}`,
    formId: "form-1",
    date,
    questionId,
    questionIndex,
    stepId: null,
    stepIndex: null,
    viewCount: 0,
    startCount: 0,
    completeCount: 0,
    dropoffCount: 0,
    terminalDropoffCount: 0,
    dropoffRate: null,
    completionRate: null,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    ...rest,
  };
};

const makeProgress = (
  overrides: Partial<QuestionProgressRow> & {
    id: string;
    questionId: string;
    questionIndex: number;
  },
): QuestionProgressRow => {
  const { id, questionId, questionIndex, ...rest } = overrides;
  return {
    id,
    formId: "form-1",
    visitId: `visit-${id}`,
    visitorHash: `hash-${id}`,
    questionId,
    questionType: null,
    questionIndex,
    stepId: null,
    stepIndex: null,
    viewedAt: baseTimestamp,
    startedAt: null,
    completedAt: null,
    wasLastQuestion: false,
    createdAt: baseTimestamp,
    ...rest,
  };
};

describe("mergeDropoffMetrics", () => {
  it("returns empty/zeroed metrics when there are no rows", () => {
    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-25",
      endDate: "2026-04-27",
      dailyRows: [],
      todayProgressRows: [],
    });

    expect(result).toStrictEqual({
      formId: "form-1",
      startDate: "2026-04-25",
      endDate: "2026-04-27",
      questions: [],
      totalStarted: 0,
      totalCompleted: 0,
      overallCompletionRate: 0,
      completedSubmissions: 0,
      totalDropoffsDeltaPct: null,
      timePerQuestion: [],
    });
  });

  it("sums daily rows for the same questionId", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-25",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 100,
        startCount: 80,
        completeCount: 70,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 50,
        startCount: 40,
        completeCount: 30,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-25",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    expect(result.questions).toHaveLength(1);
    const [q1] = result.questions;
    expect(q1).toMatchObject({
      viewCount: 150,
      startCount: 120,
      completeCount: 100,
      dropoffCount: 50,
      dropoffRate: 33,
      completionRate: 67,
    });
  });

  it("aggregates today raw progress rows by questionId, counting starts/completes by null-checks", () => {
    const todayProgressRows = [
      makeProgress({ id: "p1", questionId: "q1", questionIndex: 0 }),
      makeProgress({
        id: "p2",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
      }),
      makeProgress({
        id: "p3",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
      }),
      makeProgress({
        id: "p4",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
        completedAt: baseTimestamp,
      }),
      makeProgress({
        id: "p5",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
        completedAt: baseTimestamp,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      dailyRows: [],
      todayProgressRows,
    });

    expect(result.questions).toHaveLength(1);
    const [q1] = result.questions;
    expect(q1.viewCount).toBe(5);
    expect(q1.startCount).toBe(4);
    expect(q1.completeCount).toBe(2);
  });

  it("combines daily and today rows per question", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 10,
        startCount: 8,
        completeCount: 6,
      }),
    ];
    const todayProgressRows = [
      makeProgress({
        id: "p1",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
        completedAt: baseTimestamp,
      }),
      makeProgress({
        id: "p2",
        questionId: "q1",
        questionIndex: 0,
        startedAt: baseTimestamp,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-27",
      dailyRows,
      todayProgressRows,
    });

    expect(result.questions).toHaveLength(1);
    const [q1] = result.questions;
    expect(q1.viewCount).toBe(12);
    expect(q1.startCount).toBe(10);
    expect(q1.completeCount).toBe(7);
  });

  it("computes overall funnel using first-question startCount and last-question completeCount", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 100,
        startCount: 80,
        completeCount: 80,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q2",
        questionIndex: 1,
        viewCount: 80,
        startCount: 50,
        completeCount: 50,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q3",
        questionIndex: 2,
        viewCount: 50,
        startCount: 30,
        completeCount: 30,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    expect(result.totalStarted).toBe(80);
    expect(result.totalCompleted).toBe(30);
    // 30 / 80 = 0.375 → round → 38
    expect(result.overallCompletionRate).toBe(38);
  });

  it("reports cross-step drop-off when a visitor completes step N but never views step N+1", () => {
    // 3 visitors complete steps 1–3, only 2 reach 4–6. The one who bailed after step 3 must count as drop-off at step 4 (33%), not 0% from step 4's intact view→complete ratio.
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 3,
        startCount: 3,
        completeCount: 3,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q2",
        questionIndex: 1,
        viewCount: 3,
        startCount: 3,
        completeCount: 3,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q3",
        questionIndex: 2,
        viewCount: 3,
        startCount: 3,
        completeCount: 3,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q4",
        questionIndex: 3,
        viewCount: 2,
        startCount: 2,
        completeCount: 2,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    const [q1, q2, q3, q4] = result.questions;
    // Step 1 has no prior step — intra-step drop applies (and it's zero here).
    expect(q1.dropoffRate).toBe(0);
    expect(q1.dropoffCount).toBe(0);
    // Steps 2 and 3 retain the full cohort.
    expect(q2.dropoffRate).toBe(0);
    expect(q3.dropoffRate).toBe(0);
    // Step 4 is where the visitor dropped off — 1 of 3 = 33%.
    expect(q4.dropoffCount).toBe(1);
    expect(q4.dropoffRate).toBe(33);
  });

  it("computes dropoffRate and completionRate from view/complete counts", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 100,
        startCount: 100,
        completeCount: 70,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    const [q1] = result.questions;
    expect(q1.dropoffCount).toBe(30);
    expect(q1.dropoffRate).toBe(30);
    expect(q1.completionRate).toBe(70);
  });

  it("sorts questions by questionIndex ascending regardless of insertion order", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q3",
        questionIndex: 2,
        viewCount: 10,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 30,
      }),
      makeDaily({
        date: "2026-04-26",
        questionId: "q2",
        questionIndex: 1,
        viewCount: 20,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    expect(result.questions.map((q) => q.questionId)).toStrictEqual(["q1", "q2", "q3"]);
    expect(result.questions.map((q) => q.questionIndex)).toStrictEqual([0, 1, 2]);
  });

  it("guards against division by zero when viewCount is 0", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        questionId: "q1",
        questionIndex: 0,
        viewCount: 0,
        startCount: 0,
        completeCount: 0,
      }),
    ];

    const result = mergeDropoffMetrics({
      formId: "form-1",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
      dailyRows,
      todayProgressRows: [],
    });

    const [q1] = result.questions;
    expect(q1.dropoffRate).toBe(0);
    expect(q1.completionRate).toBe(0);
    expect(Number.isNaN(q1.dropoffRate)).toBeFalsy();
    expect(Number.isNaN(q1.completionRate)).toBeFalsy();
    expect(result.overallCompletionRate).toBe(0);
  });
});
