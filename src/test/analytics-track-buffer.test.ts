import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordQuestionProgressBatch = vi.fn();
const recordFormVisit = vi.fn();
const recordQuestionProgress = vi.fn();
const updateFormVisit = vi.fn();

vi.mock("@/lib/server-fn/analytics", () => ({
  recordFormVisit,
  recordQuestionProgress,
  recordQuestionProgressBatch,
  updateFormVisit,
}));

const { enqueueQuestionProgress, flushQuestionProgressBuffer } =
  await import("@/lib/analytics/track-client");

type EnqueueArgs = Parameters<typeof enqueueQuestionProgress>[0];

const makeArgs = (overrides: Partial<EnqueueArgs> = {}): EnqueueArgs => ({
  visitId: "00000000-0000-0000-0000-000000000001",
  formId: "00000000-0000-0000-0000-0000000000aa",
  visitorHash: "hash",
  questionId: "q1",
  questionType: "shortText",
  questionIndex: 0,
  event: "view",
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
  recordQuestionProgressBatch.mockReset();
  recordQuestionProgressBatch.mockResolvedValue({ ok: true, processed: 0 });
});

afterEach(() => {
  // Drain any pending state so module-level singleton can't leak across tests.
  flushQuestionProgressBuffer();
  vi.useRealTimers();
});

describe("question-progress client buffer", () => {
  it("flushes after 500ms even with a single event", () => {
    enqueueQuestionProgress(makeArgs());
    expect(recordQuestionProgressBatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(recordQuestionProgressBatch).toHaveBeenCalledTimes(1);
    const [arg] = recordQuestionProgressBatch.mock.calls[0] as [{ data: { items: EnqueueArgs[] } }];
    expect(arg.data.items).toHaveLength(1);
    expect(arg.data.items[0]?.questionId).toBe("q1");
  });

  it("flushes immediately once 5 distinct events are buffered", () => {
    for (let index = 0; index < 5; index++) {
      enqueueQuestionProgress(
        makeArgs({
          questionId: `q-${index}`,
          questionIndex: index,
        }),
      );
    }
    expect(recordQuestionProgressBatch).toHaveBeenCalledTimes(1);
    const [arg] = recordQuestionProgressBatch.mock.calls[0] as [{ data: { items: EnqueueArgs[] } }];
    expect(arg.data.items).toHaveLength(5);
  });

  it("flushes synchronously when flushQuestionProgressBuffer() is called", () => {
    enqueueQuestionProgress(makeArgs());
    flushQuestionProgressBuffer();
    expect(recordQuestionProgressBatch).toHaveBeenCalledTimes(1);
    const [arg] = recordQuestionProgressBatch.mock.calls[0] as [{ data: { items: EnqueueArgs[] } }];
    expect(arg.data.items).toHaveLength(1);
  });

  it("collapses duplicates with the same (visitId, questionId, event) in a single batch", () => {
    enqueueQuestionProgress(makeArgs({ event: "view" }));
    enqueueQuestionProgress(makeArgs({ event: "view" }));
    enqueueQuestionProgress(makeArgs({ event: "view" }));
    flushQuestionProgressBuffer();
    expect(recordQuestionProgressBatch).toHaveBeenCalledTimes(1);
    const [arg] = recordQuestionProgressBatch.mock.calls[0] as [{ data: { items: EnqueueArgs[] } }];
    expect(arg.data.items).toHaveLength(1);
  });
});
