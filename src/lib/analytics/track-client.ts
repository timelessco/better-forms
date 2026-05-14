import {
  recordFormVisit,
  recordQuestionProgress,
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

/** Fire-and-forget question-progress event. */
export const fireQuestionProgress = (args: QuestionProgressArgs): void => {
  void recordQuestionProgress({ data: args }).catch((err) => {
    logDevError("recordQuestionProgress", err);
  });
};
