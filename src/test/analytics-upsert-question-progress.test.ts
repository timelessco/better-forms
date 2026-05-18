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
    // sql`coalesce(existing, excluded.startedAt)` produces a Drizzle SQL chunk.
    expect(setStartedAt).not.toBeInstanceOf(Date);
    expect(setStartedAt).toBeDefined();
    // completedAt SET branch is also a coalesce SQL chunk that preserves the
    // existing value when excluded.completedAt is null (event=start case).
    expect(call.conflict?.set.completedAt).not.toBeInstanceOf(Date);
    expect(call.conflict?.set.completedAt).toBeDefined();
  });

  it("complete event passes completedAt = now on the INSERT side", async () => {
    await recordQuestionProgressImpl({ ...baseInput, event: "complete" });

    const call = calls[0];
    if (!call) throw new Error("expected upsert call");

    expect(call.values.completedAt).toBeInstanceOf(Date);
    expect(call.values.startedAt).toBeInstanceOf(Date);

    // On the UPDATE side, completedAt is a coalesce SQL chunk that uses
    // excluded.completedAt as the fallback — same shape regardless of event.
    expect(call.conflict?.set.completedAt).not.toBeInstanceOf(Date);
    expect(call.conflict?.set.completedAt).toBeDefined();
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
