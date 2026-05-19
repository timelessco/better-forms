import { describe, expect, it } from "vitest";
import type { formDropoffDaily, formQuestionProgress } from "@/db/schema";
import { PER_QUESTION_ANALYTICS_CUT_TS } from "@/lib/analytics/cut-date";
import { filterByCutDate } from "@/lib/analytics/merge-dropoff";

type DropoffDailyRow = typeof formDropoffDaily.$inferSelect;
type QuestionProgressRow = typeof formQuestionProgress.$inferSelect;

const baseTimestamp = new Date("2026-05-18T00:00:00Z");

const makeDaily = (date: string): DropoffDailyRow => ({
  id: `daily-${date}`,
  formId: "form-1",
  date,
  questionId: "q1",
  questionIndex: 0,
  stepId: null,
  stepIndex: null,
  viewCount: 1,
  startCount: 0,
  completeCount: 0,
  dropoffCount: 0,
  terminalDropoffCount: 0,
  dropoffRate: null,
  completionRate: null,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
});

const makeProgress = (id: string, viewedAt: Date): QuestionProgressRow => ({
  id,
  formId: "form-1",
  visitId: `visit-${id}`,
  visitorHash: `hash-${id}`,
  questionId: "q1",
  questionType: null,
  questionIndex: 0,
  stepId: null,
  stepIndex: null,
  viewedAt,
  startedAt: null,
  completedAt: null,
  wasLastQuestion: false,
  createdAt: baseTimestamp,
});

describe("filterByCutDate", () => {
  it("excludes pre-cut formQuestionProgress rows", () => {
    const preCut = makeProgress("pre", new Date("2026-05-17T12:00:00Z"));
    const postCut = makeProgress("post", new Date("2026-05-19T12:00:00Z"));

    const result = filterByCutDate({
      dailyRows: [],
      todayProgressRows: [preCut, postCut],
      cutTs: PER_QUESTION_ANALYTICS_CUT_TS,
    });

    expect(result.todayProgressRows).toHaveLength(1);
    expect(result.todayProgressRows[0].id).toBe("post");
  });

  it("includes post-cut formQuestionProgress rows", () => {
    const exactlyAtCut = makeProgress("at-cut", new Date(PER_QUESTION_ANALYTICS_CUT_TS));
    const wellAfterCut = makeProgress("after", new Date("2026-06-01T00:00:00Z"));

    const result = filterByCutDate({
      dailyRows: [],
      todayProgressRows: [exactlyAtCut, wellAfterCut],
      cutTs: PER_QUESTION_ANALYTICS_CUT_TS,
    });

    expect(result.todayProgressRows).toHaveLength(2);
    expect(result.todayProgressRows.map((r) => r.id).toSorted()).toEqual(["after", "at-cut"]);
  });

  it("excludes pre-cut formDropoffDaily rows by date string", () => {
    const preCut = makeDaily("2026-05-17");
    const postCut = makeDaily("2026-05-19");

    const result = filterByCutDate({
      dailyRows: [preCut, postCut],
      todayProgressRows: [],
      cutTs: PER_QUESTION_ANALYTICS_CUT_TS,
    });

    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0].date).toBe("2026-05-19");
  });

  it("includes the cut-date day itself in formDropoffDaily", () => {
    const onCutDay = makeDaily("2026-05-18");

    const result = filterByCutDate({
      dailyRows: [onCutDay],
      todayProgressRows: [],
      cutTs: PER_QUESTION_ANALYTICS_CUT_TS,
    });

    expect(result.dailyRows).toHaveLength(1);
    expect(result.dailyRows[0].date).toBe("2026-05-18");
  });
});
