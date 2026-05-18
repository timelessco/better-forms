/**
 * Pins the contract that `recordQuestionProgressImpl` writes via a single
 * `INSERT … ON CONFLICT (visit_id, question_id) DO UPDATE` against the
 * unique index installed in Task 1.2 — closing the SELECT→INSERT|UPDATE
 * race the old implementation had — and that the new batch impl iterates
 * the same upsert.
 *
 * Tests are DB-free: `@/db` is mocked with a fluent spy that records the
 * insert/values/onConflictDoUpdate call shape so we can assert WHAT was
 * sent to Postgres without touching it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ChainCall = {
  values: Record<string, unknown>;
  conflict: {
    target: unknown;
    set: Record<string, unknown>;
  } | null;
};

const calls: ChainCall[] = [];

const makeInsertChain = () => {
  const state: ChainCall = { values: {}, conflict: null };
  const chain = {
    values(v: Record<string, unknown>) {
      state.values = v;
      return chain;
    },
    onConflictDoUpdate(args: { target: unknown; set: Record<string, unknown> }) {
      state.conflict = { target: args.target, set: args.set };
      calls.push(state);
      return Promise.resolve();
    },
  };
  return chain;
};

vi.mock<typeof import("@/db")>(import("@/db"), () => ({
  db: {
    insert: () => makeInsertChain(),
  } as unknown as (typeof import("@/db"))["db"],
}));

const { recordQuestionProgressImpl, recordQuestionProgressBatchImpl } =
  await import("@/lib/server-fn/analytics.server");
const { formQuestionProgress } = await import("@/db/schema");

const baseInput = {
  visitId: "visit-1",
  formId: "form-1",
  visitorHash: "hash-1",
  questionId: "q-1",
  questionType: "Input",
  questionIndex: 0,
  stepId: "step-1",
  stepIndex: 2,
} as const;

describe("recordQuestionProgressImpl upsert", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => {
    calls.length = 0;
  });

  it("first view inserts viewedAt set, startedAt/completedAt null, and targets the unique constraint", async () => {
    await recordQuestionProgressImpl({ ...baseInput, event: "view" });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error("expected upsert call");

    expect(call.values.viewedAt).toBeInstanceOf(Date);
    expect(call.values.startedAt).toBeNull();
    expect(call.values.completedAt).toBeNull();
    expect(call.values.stepId).toBe("step-1");
    expect(call.values.stepIndex).toBe(2);
    expect(call.values.questionIndex).toBe(0);
    expect(call.values.wasLastQuestion).toBe(false);

    expect(call.conflict).not.toBeNull();
    expect(call.conflict?.target).toEqual([
      formQuestionProgress.visitId,
      formQuestionProgress.questionId,
    ]);
    expect(call.conflict?.set).toHaveProperty("startedAt");
    expect(call.conflict?.set).toHaveProperty("completedAt");
  });

  it("start event sets startedAt via coalesce so an earlier viewedAt-only row keeps its startedAt", async () => {
    await recordQuestionProgressImpl({ ...baseInput, event: "start" });

    const call = calls[0];
    if (!call) throw new Error("expected upsert call");

    expect(call.values.startedAt).toBeInstanceOf(Date);
    expect(call.values.completedAt).toBeNull();

    const setStartedAt = call.conflict?.set.startedAt;
    // sql`coalesce(...)` produces a Drizzle SQL chunk, not a Date or column ref.
    expect(setStartedAt).not.toBeInstanceOf(Date);
    expect(setStartedAt).toBeDefined();
    // completedAt must NOT be overwritten on a start event — should reference
    // the existing column so the SET clause leaves it alone.
    expect(call.conflict?.set.completedAt).toBe(formQuestionProgress.completedAt);
  });

  it("complete event sets completedAt to now on the UPDATE side", async () => {
    await recordQuestionProgressImpl({ ...baseInput, event: "complete" });

    const call = calls[0];
    if (!call) throw new Error("expected upsert call");

    expect(call.values.completedAt).toBeInstanceOf(Date);
    expect(call.values.startedAt).toBeInstanceOf(Date);

    expect(call.conflict?.set.completedAt).toBeInstanceOf(Date);
  });
});

describe("recordQuestionProgressBatchImpl", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("processes items sequentially and reports the count", async () => {
    const result = await recordQuestionProgressBatchImpl({
      items: [
        { ...baseInput, event: "view" },
        { ...baseInput, event: "start" },
        { ...baseInput, event: "complete" },
      ],
    });

    expect(result).toEqual({ ok: true, processed: 3 });
    expect(calls).toHaveLength(3);
  });
});
