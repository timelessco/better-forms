import { describe, expect, it } from "vitest";
import type { formQuestionProgress, formVisits } from "@/db/schema";
import { buildDailyDropoffRows } from "@/lib/analytics/aggregate-utils";

type RawVisit = typeof formVisits.$inferSelect;
type RawProgress = typeof formQuestionProgress.$inferSelect;

const baseTimestamp = new Date("2026-04-27T12:00:00Z");
const now = new Date("2026-04-28T01:00:00Z");
const dateKey = "2026-04-27";

const makeVisit = (overrides: Partial<RawVisit> & { id: string }): RawVisit => {
  const { id, ...rest } = overrides;
  return {
    id,
    formId: "form-1",
    visitorHash: `hash-${id}`,
    sessionId: `sess-${id}`,
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    deviceType: null,
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
    country: null,
    city: null,
    region: null,
    visitStartedAt: baseTimestamp,
    visitEndedAt: null,
    durationMs: null,
    didStartForm: false,
    didSubmit: false,
    submissionId: null,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    ...rest,
  };
};

const makeProgress = (overrides: Partial<RawProgress> & { id: string }): RawProgress => {
  const { id, ...rest } = overrides;
  return {
    id,
    formId: "form-1",
    visitId: `visit-${id}`,
    visitorHash: `hash-${id}`,
    questionId: "q-1",
    questionType: "text",
    questionIndex: 0,
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

const t = (offsetMs: number) => new Date(baseTimestamp.getTime() + offsetMs);

describe("buildDailyDropoffRows — terminalDropoffCount", () => {
  it("attributes the terminal drop-off to the latest startedAt of an incomplete Visit", () => {
    const visits = [
      makeVisit({
        id: "v1",
        didSubmit: false,
        visitEndedAt: t(60_000),
      }),
      makeVisit({
        id: "v2",
        didSubmit: true,
        visitEndedAt: t(120_000),
      }),
    ];
    const progress = [
      // v1: started q1, completed q1, started q2, never completed
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        viewedAt: t(0),
        startedAt: t(1_000),
        completedAt: t(2_000),
      }),
      makeProgress({
        id: "p2",
        visitId: "v1",
        questionId: "q2",
        questionIndex: 1,
        viewedAt: t(3_000),
        startedAt: t(4_000),
        completedAt: null,
      }),
      // v2: completed both
      makeProgress({
        id: "p3",
        visitId: "v2",
        questionId: "q1",
        questionIndex: 0,
        viewedAt: t(0),
        startedAt: t(1_000),
        completedAt: t(2_000),
      }),
      makeProgress({
        id: "p4",
        visitId: "v2",
        questionId: "q2",
        questionIndex: 1,
        viewedAt: t(3_000),
        startedAt: t(4_000),
        completedAt: t(5_000),
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    const byQuestion = new Map(rows.map((r) => [r.questionId, r]));
    expect(byQuestion.get("q1")?.terminalDropoffCount).toBe(0);
    expect(byQuestion.get("q2")?.terminalDropoffCount).toBe(1);
  });

  it("carries stepId and stepIndex through to output rows", () => {
    const visits = [makeVisit({ id: "v1", didSubmit: true, visitEndedAt: t(10_000) })];
    const progress = [
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        stepId: "step_0",
        stepIndex: 0,
        startedAt: t(1_000),
        completedAt: t(2_000),
      }),
      makeProgress({
        id: "p2",
        visitId: "v1",
        questionId: "q2",
        questionIndex: 1,
        stepId: "step_0",
        stepIndex: 0,
        startedAt: t(3_000),
        completedAt: t(4_000),
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.stepId).toBe("step_0");
      expect(row.stepIndex).toBe(0);
    }
  });

  it("excludes Visits with visitEndedAt = null from terminal counting", () => {
    const visits = [
      makeVisit({
        id: "v1",
        didSubmit: false,
        visitEndedAt: null,
      }),
    ];
    const progress = [
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        startedAt: t(1_000),
        completedAt: null,
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    const q1 = rows.find((r) => r.questionId === "q1");
    expect(q1?.terminalDropoffCount).toBe(0);
  });

  it("excludes Visits with didSubmit = true from terminal counting", () => {
    const visits = [
      makeVisit({
        id: "v1",
        didSubmit: true,
        visitEndedAt: t(10_000),
      }),
    ];
    const progress = [
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        startedAt: t(1_000),
        completedAt: null,
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    const q1 = rows.find((r) => r.questionId === "q1");
    expect(q1?.terminalDropoffCount).toBe(0);
  });

  it("only counts the latest-started incomplete Question, not all incomplete Questions", () => {
    // Edge case: a Visit ended without submit, with multiple incomplete-started
    // Questions. Only the one with the latest startedAt is terminal.
    const visits = [
      makeVisit({
        id: "v1",
        didSubmit: false,
        visitEndedAt: t(10_000),
      }),
    ];
    const progress = [
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        startedAt: t(1_000),
        completedAt: null,
      }),
      makeProgress({
        id: "p2",
        visitId: "v1",
        questionId: "q2",
        questionIndex: 1,
        startedAt: t(5_000),
        completedAt: null,
      }),
      makeProgress({
        id: "p3",
        visitId: "v1",
        questionId: "q3",
        questionIndex: 2,
        startedAt: t(3_000),
        completedAt: null,
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    const byQuestion = new Map(rows.map((r) => [r.questionId, r]));
    expect(byQuestion.get("q1")?.terminalDropoffCount).toBe(0);
    expect(byQuestion.get("q2")?.terminalDropoffCount).toBe(1);
    expect(byQuestion.get("q3")?.terminalDropoffCount).toBe(0);
  });

  it("ignores completed Questions when finding the terminal Question", () => {
    // Visit completed q1 + q2, started but didn't complete q3, abandoned.
    // Terminal is q3, not q2 (even though q2 has a later startedAt than q1).
    const visits = [
      makeVisit({
        id: "v1",
        didSubmit: false,
        visitEndedAt: t(20_000),
      }),
    ];
    const progress = [
      makeProgress({
        id: "p1",
        visitId: "v1",
        questionId: "q1",
        questionIndex: 0,
        startedAt: t(1_000),
        completedAt: t(2_000),
      }),
      makeProgress({
        id: "p2",
        visitId: "v1",
        questionId: "q2",
        questionIndex: 1,
        startedAt: t(10_000),
        completedAt: t(11_000),
      }),
      makeProgress({
        id: "p3",
        visitId: "v1",
        questionId: "q3",
        questionIndex: 2,
        startedAt: t(12_000),
        completedAt: null,
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey,
      now,
    });

    const byQuestion = new Map(rows.map((r) => [r.questionId, r]));
    expect(byQuestion.get("q1")?.terminalDropoffCount).toBe(0);
    expect(byQuestion.get("q2")?.terminalDropoffCount).toBe(0);
    expect(byQuestion.get("q3")?.terminalDropoffCount).toBe(1);
  });
});
