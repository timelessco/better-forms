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
 * We can't use `navigator.sendBeacon` here: TanStack Start's server-function
 * endpoint expects a SEROVAL-encoded payload (a tree of `{t: <type>, ...}`
 * nodes), and a raw `JSON.stringify({ data })` blob crashes the server's
 * `parsePayload` with `Cannot read properties of undefined (reading 't')`.
 * The RPC client knows how to encode args correctly, so we route through it
 * and accept the regular trade-off (the request rides on the unloading
 * document's fetch loop and may be cancelled for very long uploads). For
 * the small JSON payload here in practice this is fine. */
export const fireUpdateVisitBeacon = (args: UpdateVisitArgs): void => {
  fireUpdateVisit(args);
};

/** Fire-and-forget question-progress event. */
export const fireQuestionProgress = (args: QuestionProgressArgs): void => {
  void recordQuestionProgress({ data: args }).catch((err) => {
    logDevError("recordQuestionProgress", err);
  });
};
