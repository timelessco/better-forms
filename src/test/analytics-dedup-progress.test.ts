import { describe, expect, it } from "vitest";
import { dedupeQuestionProgressRows } from "@/lib/analytics/dedupe-progress";

type Row = {
  id: string;
  visitId: string;
  questionId: string;
  viewedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

describe("dedupeQuestionProgressRows", () => {
  it("keeps the row with the latest completedAt for each (visitId, questionId)", () => {
    const older: Row = {
      id: "row-1",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: new Date("2026-05-01T10:00:30Z"),
      completedAt: null,
    };
    const newer: Row = {
      id: "row-2",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: new Date("2026-05-01T10:00:30Z"),
      completedAt: new Date("2026-05-01T10:01:00Z"),
    };
    const unrelated: Row = {
      id: "row-3",
      visitId: "v2",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T11:00:00Z"),
      startedAt: null,
      completedAt: null,
    };
    const { keep, drop } = dedupeQuestionProgressRows([older, newer, unrelated]);
    expect(keep.map((r) => r.id).sort()).toEqual(["row-2", "row-3"]);
    expect(drop.map((r) => r.id)).toEqual(["row-1"]);
  });

  it("when completedAt is tied, prefers latest startedAt, then latest viewedAt", () => {
    const a: Row = {
      id: "a",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: new Date("2026-05-01T10:00:30Z"),
      completedAt: null,
    };
    const b: Row = {
      id: "b",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: new Date("2026-05-01T10:00:45Z"),
      completedAt: null,
    };
    const { keep } = dedupeQuestionProgressRows([a, b]);
    expect(keep.map((r) => r.id)).toEqual(["b"]);
  });

  it("returns empty keep and drop for empty input", () => {
    const { keep, drop } = dedupeQuestionProgressRows([]);
    expect(keep).toEqual([]);
    expect(drop).toEqual([]);
  });

  it("keeps a single row with no drops", () => {
    const only: Row = {
      id: "only",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: null,
      completedAt: null,
    };
    const { keep, drop } = dedupeQuestionProgressRows([only]);
    expect(keep.map((r) => r.id)).toEqual(["only"]);
    expect(drop).toEqual([]);
  });

  it("when all three ordering keys tie, the first-seen row wins", () => {
    const viewedAt = new Date("2026-05-01T10:00:00Z");
    const startedAt = new Date("2026-05-01T10:00:30Z");
    const completedAt = new Date("2026-05-01T10:01:00Z");
    const first: Row = {
      id: "first",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt,
      completedAt,
    };
    const second: Row = {
      id: "second",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt,
      completedAt,
    };
    const { keep, drop } = dedupeQuestionProgressRows([first, second]);
    expect(keep.map((r) => r.id)).toEqual(["first"]);
    expect(drop.map((r) => r.id)).toEqual(["second"]);
  });

  it("ranks a non-null completedAt above a null one when startedAt and viewedAt are equal", () => {
    const viewedAt = new Date("2026-05-01T10:00:00Z");
    const startedAt = new Date("2026-05-01T10:00:30Z");
    const nullCompleted: Row = {
      id: "null-completed",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt,
      completedAt: null,
    };
    const hasCompleted: Row = {
      id: "has-completed",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt,
      completedAt: new Date("2026-05-01T10:01:00Z"),
    };
    const { keep, drop } = dedupeQuestionProgressRows([nullCompleted, hasCompleted]);
    expect(keep.map((r) => r.id)).toEqual(["has-completed"]);
    expect(drop.map((r) => r.id)).toEqual(["null-completed"]);
  });

  it("ranks a non-null startedAt above a null one when completedAt is null on both", () => {
    const viewedAt = new Date("2026-05-01T10:00:00Z");
    const bothNull: Row = {
      id: "both-null",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt: null,
      completedAt: null,
    };
    const hasStarted: Row = {
      id: "has-started",
      visitId: "v1",
      questionId: "q1",
      viewedAt,
      startedAt: new Date("2026-05-01T10:00:30Z"),
      completedAt: null,
    };
    const { keep, drop } = dedupeQuestionProgressRows([bothNull, hasStarted]);
    expect(keep.map((r) => r.id)).toEqual(["has-started"]);
    expect(drop.map((r) => r.id)).toEqual(["both-null"]);
  });

  it("does not collapse rows across distinct (visitId, questionId) partitions interleaved in input", () => {
    const v1q1a: Row = {
      id: "v1q1a",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: null,
      completedAt: null,
    };
    const v1q2: Row = {
      id: "v1q2",
      visitId: "v1",
      questionId: "q2",
      viewedAt: new Date("2026-05-01T10:00:05Z"),
      startedAt: null,
      completedAt: null,
    };
    const v2q1: Row = {
      id: "v2q1",
      visitId: "v2",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:10Z"),
      startedAt: null,
      completedAt: null,
    };
    const v1q1b: Row = {
      id: "v1q1b",
      visitId: "v1",
      questionId: "q1",
      viewedAt: new Date("2026-05-01T10:00:00Z"),
      startedAt: new Date("2026-05-01T10:00:30Z"),
      completedAt: null,
    };
    const { keep, drop } = dedupeQuestionProgressRows([v1q1a, v1q2, v2q1, v1q1b]);
    expect(keep.map((r) => r.id).sort()).toEqual(["v1q1b", "v1q2", "v2q1"]);
    expect(drop.map((r) => r.id)).toEqual(["v1q1a"]);
  });
});
