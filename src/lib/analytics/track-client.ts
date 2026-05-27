import {
  recordFormVisit,
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
  // CWV, sent on unload beacon. Null when a metric never finalizes (e.g. no interaction → no INP).
  lcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
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

/** Unload-time visit update via `navigator.sendBeacon` → `/api/track/visit-end`,
 * surviving beforeunload/pagehide fetch-loop teardown. Can't use the serverFn:
 * its SEROVAL payload forces application/json → CORS preflight that sendBeacon
 * refuses; a text/plain blob stays CORS-safelisted (route parses JSON itself).
 * Falls back to fireUpdateVisit if sendBeacon is unavailable/refuses (queue full, body too large). */
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
        lcpMs: args.lcpMs,
        inpMs: args.inpMs,
        cls: args.cls,
      }),
    ],
    { type: "text/plain" },
  );
  const queued = navigator.sendBeacon("/api/track/visit-end", blob);
  if (!queued) {
    fireUpdateVisit(args);
  }
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
  // Collapse intra-batch dups: latest per (visitId, questionId, event).
  // Handles StrictMode double-fire / stacked focus events.
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

// NOTE: flushes via serverFn recordQuestionProgressBatch, NOT unload-safe (fetch loop
// may tear down first). usePublicFormTracking calls this from beforeunload/pagehide as
// best-effort drain; beacon-friendly route could be added if data loss proves material. ADR-0002.
/** Drain the question-progress buffer now. Call before Step submit or unload. */
export const flushQuestionProgressBuffer = flushQuestionProgressNow;
