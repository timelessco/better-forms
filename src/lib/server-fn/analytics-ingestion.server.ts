import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsRateLimits, formQuestionProgress, formVisits, forms } from "@/db/schema";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";
import { getClientIp, slidingWindowRateLimit } from "@/lib/server-fn/rate-limit.server";

export type RecordFormVisitInput = {
  formId: string;
  visitorHash: string;
  sessionId: string;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export type UpdateFormVisitInput = {
  visitId: string;
  didStartForm?: boolean;
  didSubmit?: boolean;
  submissionId?: string | null;
  visitEndedAt?: string | null;
  lcpMs?: number | null;
  inpMs?: number | null;
  cls?: number | null;
};

export type RecordQuestionProgressInput = {
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

export type RecordQuestionProgressBatchInput = {
  items: RecordQuestionProgressInput[];
};

// ── Ingestion guards (anonymous endpoints): reject writes for missing/non-published forms and
// rate-limit per IP, mirroring the public-file-upload hardening. Analytics is best-effort, so a
// blocked write returns the no-op shape and never throws — a real respondent on a shared IP must
// not see the form break. ──

const ANALYTICS_WINDOW_MINUTES = 1;
// Visits + per-question progress are chatty; 120/min/IP clears a long multi-step respondent.
const ANALYTICS_MAX_PER_WINDOW = 120;
const ANALYTICS_CLEANUP_PROBABILITY = 0.01;
// SQL literal: Postgres can't cast a parameterized int into an interval. Build-time constant, safe.
const ANALYTICS_WINDOW_INTERVAL_SQL = sql.raw(`interval '${ANALYTICS_WINDOW_MINUTES} minutes'`);

// Only published forms accept analytics — drops fabricated visits/progress for draft/archived/
// missing formIds (which would otherwise pollute a real customer's funnel + grow the tables).
const isFormPublished = async (formId: string): Promise<boolean> => {
  const [form] = await db
    .select({ status: forms.status })
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1);
  return form?.status === "published";
};

// Per-IP sliding-window limit. Returns false when the IP is over budget (caller no-ops). Atomic
// upsert + cleanup-on-write keeps the table small without a cron (see upload_rate_limits).
// Exported for direct testing (request context can't supply an IP in unit tests).
export const checkAnalyticsRateLimit = async (ip: string): Promise<boolean> => {
  const count = await slidingWindowRateLimit({
    table: analyticsRateLimits,
    keyColumn: analyticsRateLimits.ip,
    windowStartColumn: analyticsRateLimits.windowStart,
    countColumn: analyticsRateLimits.count,
    values: { ip, count: 1 },
    windowIntervalSql: ANALYTICS_WINDOW_INTERVAL_SQL,
    cleanupSql: sql`DELETE FROM analytics_rate_limits WHERE window_start < now() - interval '1 hour'`,
    cleanupProbability: ANALYTICS_CLEANUP_PROBABILITY,
  });
  return count <= ANALYTICS_MAX_PER_WINDOW;
};

export const recordFormVisitImpl = async (
  data: RecordFormVisitInput,
): Promise<{ visitId: string | null }> => {
  const headers = getRequestHeaders();
  const ua = headers.get("user-agent");

  if (isBotUserAgent(ua)) {
    return { visitId: null };
  }

  // Per-IP rate limit + published-form gate before any write (see ingestion guards above).
  const ip = getClientIp();
  if (ip && !(await checkAnalyticsRateLimit(ip))) {
    return { visitId: null };
  }
  if (!(await isFormPublished(data.formId))) {
    return { visitId: null };
  }

  const parsed = parseUserAgent(ua);
  const country = headers.get("x-vercel-ip-country");

  const id = crypto.randomUUID();
  await db.insert(formVisits).values({
    id,
    formId: data.formId,
    visitorHash: data.visitorHash,
    sessionId: data.sessionId,
    referrer: data.referrer ?? null,
    utmSource: data.utmSource ?? null,
    utmMedium: data.utmMedium ?? null,
    utmCampaign: data.utmCampaign ?? null,
    deviceType: parsed.deviceType,
    browser: parsed.browser,
    browserVersion: parsed.browserVersion,
    os: parsed.os,
    osVersion: parsed.osVersion,
    country,
    city: null,
    region: null,
  });

  return { visitId: id };
};

export const updateFormVisitImpl = async (data: UpdateFormVisitInput): Promise<{ ok: true }> => {
  const updates: Partial<typeof formVisits.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.didStartForm !== undefined) {
    updates.didStartForm = data.didStartForm;
  }
  if (data.didSubmit !== undefined) {
    updates.didSubmit = data.didSubmit;
  }
  if (data.submissionId !== undefined) {
    updates.submissionId = data.submissionId;
  }
  if (data.visitEndedAt !== undefined) {
    updates.visitEndedAt = data.visitEndedAt ? new Date(data.visitEndedAt) : null;
  }
  if (data.lcpMs !== undefined) {
    updates.lcpMs = data.lcpMs;
  }
  if (data.inpMs !== undefined) {
    updates.inpMs = data.inpMs;
  }
  if (data.cls !== undefined) {
    updates.cls = data.cls;
  }

  await db.update(formVisits).set(updates).where(eq(formVisits.id, data.visitId));
  return { ok: true };
};

export const recordQuestionProgressImpl = async (
  data: RecordQuestionProgressInput,
): Promise<{ ok: true }> => {
  // Per-IP rate limit + published-form gate before any write (best-effort: no-op, never throw).
  const ip = getClientIp();
  if (ip && !(await checkAnalyticsRateLimit(ip))) {
    return { ok: true };
  }
  if (!(await isFormPublished(data.formId))) {
    return { ok: true };
  }

  const now = new Date();
  const isStart = data.event === "start" || data.event === "complete";
  const isComplete = data.event === "complete";

  await db
    .insert(formQuestionProgress)
    .values({
      id: crypto.randomUUID(),
      visitId: data.visitId,
      formId: data.formId,
      visitorHash: data.visitorHash,
      questionId: data.questionId,
      questionType: data.questionType ?? null,
      questionIndex: data.questionIndex,
      stepId: data.stepId ?? null,
      stepIndex: data.stepIndex ?? null,
      viewedAt: now,
      startedAt: isStart ? now : null,
      completedAt: isComplete ? now : null,
      wasLastQuestion: data.wasLastQuestion ?? false,
    })
    .onConflictDoUpdate({
      target: [formQuestionProgress.visitId, formQuestionProgress.questionId],
      // Use excluded.* not raw Date in sql templates: postgres-js binder refuses a JS Date
      // for a coalesce arg when the branch column type isn't explicit (analytics-option-b.test.ts).
      set: {
        startedAt: sql`coalesce(${formQuestionProgress.startedAt}, excluded."startedAt")`,
        completedAt: sql`coalesce(${formQuestionProgress.completedAt}, excluded."completedAt")`,
        wasLastQuestion: sql`${formQuestionProgress.wasLastQuestion} or excluded."wasLastQuestion"`,
        stepId: sql`coalesce(${formQuestionProgress.stepId}, excluded."stepId")`,
        stepIndex: sql`coalesce(${formQuestionProgress.stepIndex}, excluded."stepIndex")`,
      },
    });

  return { ok: true };
};

export const recordQuestionProgressBatchImpl = async (
  data: RecordQuestionProgressBatchInput,
): Promise<{ ok: true; processed: number }> => {
  // Rate-limit + published gate once per batch (not per item). A batch is one respondent's
  // session = one form, so the first item's formId is authoritative for the published check.
  const ip = getClientIp();
  if (ip && !(await checkAnalyticsRateLimit(ip))) {
    return { ok: true, processed: 0 };
  }
  const batchFormId = data.items[0]?.formId;
  if (batchFormId && !(await isFormPublished(batchFormId))) {
    return { ok: true, processed: 0 };
  }

  const now = new Date();
  // De-dup by (visitId, questionId): the conflict key. Postgres rejects a row hit twice in one
  // ON CONFLICT statement, so merge intra-batch dupes the way the upsert would (monotonic lifecycle).
  type Row = typeof formQuestionProgress.$inferInsert;
  const byKey = new Map<string, Row>();
  for (const item of data.items) {
    const key = `${item.visitId} ${item.questionId}`;
    const prev = byKey.get(key);
    const isStart = item.event === "start" || item.event === "complete";
    const isComplete = item.event === "complete";
    byKey.set(key, {
      id: prev?.id ?? crypto.randomUUID(),
      visitId: item.visitId,
      formId: item.formId,
      visitorHash: item.visitorHash,
      questionId: item.questionId,
      questionType: prev?.questionType ?? item.questionType ?? null,
      questionIndex: prev?.questionIndex ?? item.questionIndex,
      stepId: prev?.stepId ?? item.stepId ?? null,
      stepIndex: prev?.stepIndex ?? item.stepIndex ?? null,
      viewedAt: now,
      startedAt: prev?.startedAt ?? (isStart ? now : null),
      completedAt: prev?.completedAt ?? (isComplete ? now : null),
      wasLastQuestion: (prev?.wasLastQuestion ?? false) || (item.wasLastQuestion ?? false),
    });
  }

  const rows = [...byKey.values()];
  if (rows.length === 0) {
    return { ok: true, processed: 0 };
  }

  await db
    .insert(formQuestionProgress)
    .values(rows)
    .onConflictDoUpdate({
      target: [formQuestionProgress.visitId, formQuestionProgress.questionId],
      // Identical to recordQuestionProgressImpl: excluded.* not raw Date (postgres-js binder).
      set: {
        startedAt: sql`coalesce(${formQuestionProgress.startedAt}, excluded."startedAt")`,
        completedAt: sql`coalesce(${formQuestionProgress.completedAt}, excluded."completedAt")`,
        wasLastQuestion: sql`${formQuestionProgress.wasLastQuestion} or excluded."wasLastQuestion"`,
        stepId: sql`coalesce(${formQuestionProgress.stepId}, excluded."stepId")`,
        stepIndex: sql`coalesce(${formQuestionProgress.stepIndex}, excluded."stepIndex")`,
      },
    });

  return { ok: true, processed: data.items.length };
};
