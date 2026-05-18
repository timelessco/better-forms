import {
  recordFormVisit,
  recordQuestionProgress,
  recordQuestionProgressBatch,
  updateFormVisit,
} from "@/lib/server-fn/analytics";

type RecordVisitArgs = {
  formId: string;
  visitorHash: string;
  sessionId: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

type UpdateVisitArgs = {
  visitId: string;
  didStartForm?: boolean;
  didSubmit?: boolean;
  submissionId?: string | null;
  visitEndedAt?: string | null;
  durationMs?: number | null;
};

type QuestionProgressArgs = {
  visitId: string;
  formId: string;
  visitorHash: string;
  questionId: string;
  questionType?: string | null;
  questionIndex: number;
  stepId?: string | null;
  stepIndex?: number | null;
  event: "view" | "start" | "complete";
  wasLastQuestion?: boolean;
};

const isDev = import.meta.env.DEV;

const logDevError = (label: string, err: unknown): void => {
  if (isDev) {
    // biome-ignore lint/suspicious/noConsole: dev-only diagnostic for analytics failures
    console.error(`[analytics] ${label} failed:`, err);
  }
};

/** Fires recordFormVisit and resolves with the visitId, or null on bot/error. */
export const fireRecordVisit = async (args: RecordVisitArgs): Promise<string | null> => {
  try {
    const result = await recordFormVisit({ data: args });
    return result.visitId;
  } catch (err) {
    logDevError("recordFormVisit", err);
    return null;
  }
};

/** Fire-and-forget visit update. Underlying fetch survives short async work; not unload-safe. */
export const fireUpdateVisit = (args: UpdateVisitArgs): void => {
  void updateFormVisit({ data: args }).catch((err) => {
    logDevError("updateFormVisit", err);
  });
};

/** Unload-time visit update.
 *
 * Uses `navigator.sendBeacon` against the dedicated REST endpoint at
 * `/api/track/visit-end` so the request survives `beforeunload` / `pagehide`
 * even when the browser tears down the tab's fetch loop. The serverFn
 * endpoint can't be used here — it expects a SEROVAL-encoded payload, which
 * would force `application/json` and trigger a CORS preflight that
 * sendBeacon refuses. Sending a `text/plain` blob keeps the request
 * CORS-safelisted; the server route parses the body as JSON itself.
 *
 * Falls back to the regular serverFn if `sendBeacon` is unavailable or
 * refuses the request (queue full, body too large). */
export const fireUpdateVisitBeacon = (args: UpdateVisitArgs): void => {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    fireUpdateVisit(args);
    return;
  }
  const blob = new Blob(
    [
      JSON.stringify({
        visitId: args.visitId,
        visitEndedAt: args.visitEndedAt,
        durationMs: args.durationMs,
      }),
    ],
    { type: "text/plain" },
  );
  const queued = navigator.sendBeacon("/api/track/visit-end", blob);
  if (!queued) {
    fireUpdateVisit(args);
  }
};

/**
 * @deprecated Use `enqueueQuestionProgress` instead — it batches via the
 * `recordQuestionProgressBatch` serverFn. This singular path remains only
 * for any unmigrated call sites; remove once Task 3.3 lands.
 */
export const fireQuestionProgress = (args: QuestionProgressArgs): void => {
  void recordQuestionProgress({ data: args }).catch((err) => {
    logDevError("recordQuestionProgress", err);
  });
};

const QUESTION_PROGRESS_BUFFER: QuestionProgressArgs[] = [];
const QUESTION_PROGRESS_MAX_BATCH = 5;
const QUESTION_PROGRESS_FLUSH_MS = 500;
let questionProgressFlushTimer: ReturnType<typeof setTimeout> | null = null;

const flushQuestionProgressNow = (): void => {
  if (QUESTION_PROGRESS_BUFFER.length === 0) {
    if (questionProgressFlushTimer) {
      clearTimeout(questionProgressFlushTimer);
      questionProgressFlushTimer = null;
    }
    return;
  }
  // Collapse intra-batch duplicates: keep only the latest entry per
  // (visitId, questionId, event). Useful when StrictMode double-fires in
  // dev or when redundant focus events stack up.
  const dedup = new Map<string, QuestionProgressArgs>();
  for (const item of QUESTION_PROGRESS_BUFFER) {
    dedup.set(`${item.visitId}::${item.questionId}::${item.event}`, item);
  }
  const items = [...dedup.values()];
  QUESTION_PROGRESS_BUFFER.length = 0;
  if (questionProgressFlushTimer) {
    clearTimeout(questionProgressFlushTimer);
    questionProgressFlushTimer = null;
  }
  void recordQuestionProgressBatch({ data: { items } }).catch((err) => {
    logDevError("recordQuestionProgressBatch", err);
  });
};

const scheduleQuestionProgressFlush = (): void => {
  if (questionProgressFlushTimer) return;
  questionProgressFlushTimer = setTimeout(flushQuestionProgressNow, QUESTION_PROGRESS_FLUSH_MS);
};

/** Enqueue a question-progress event. Auto-flushes at 5 events or 500ms. */
export const enqueueQuestionProgress = (args: QuestionProgressArgs): void => {
  QUESTION_PROGRESS_BUFFER.push(args);
  if (QUESTION_PROGRESS_BUFFER.length >= QUESTION_PROGRESS_MAX_BATCH) {
    flushQuestionProgressNow();
  } else {
    scheduleQuestionProgressFlush();
  }
};

// NOTE: The question-progress buffer flushes via the regular serverFn
// (`recordQuestionProgressBatch`), which is NOT unload-safe — the browser
// may tear down the fetch loop before the request lands. The
// `usePublicFormTracking` hook (`use-public-form-tracking.ts`) calls this
// manual flush from its `beforeunload`/`pagehide` handlers as a best-effort
// drain; a dedicated beacon-friendly REST route can be added later if
// real-world data loss proves material. See ADR-0002.
/** Drain the question-progress buffer immediately. Call before Step submit
 * or page unload so dropoff data isn't lost. */
export const flushQuestionProgressBuffer = flushQuestionProgressNow;
