import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { and, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  analyticsRateLimits,
  formAnalyticsDaily,
  formDropoffDaily,
  formQuestionProgress,
  forms,
  formSettings,
  formVisits,
  organization,
  submissions,
  workspaces,
} from "@/db/schema";
import { buildDailyAnalyticsRows, buildDailyDropoffRows } from "@/lib/analytics/aggregate-utils";
import {
  EDITABLE_FIELD_TYPES,
  getFieldsFromSegments,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import type { Value } from "platejs";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { PER_QUESTION_ANALYTICS_CUT_TS } from "@/lib/analytics/cut-date";
import { filterByCutDate, mergeDropoffMetrics } from "@/lib/analytics/merge-dropoff";
import { mergeInsightsMetrics } from "@/lib/analytics/merge-metrics";
import { buildVitalsMetrics } from "@/lib/analytics/merge-vitals";
import { completionRate, weightedMedianDuration } from "@/lib/analytics/metrics";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";
import { resolveTimeRange, splitTodayVsPast, toDateKey } from "@/lib/analytics/time-range";
import { planUnlocks } from "@/lib/config/plan-gates";
import { authForm } from "@/lib/server-fn/auth-helpers.server";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import type {
  AnswerAnalysis,
  AnswerDistributionItem,
  FormAnswerMetrics,
  FormInsightsMetrics,
  FormVitalsMetrics,
  QuestionAnswerSummary,
  QuestionDropoffMetrics,
} from "@/types/analytics";

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

export type InsightsFilterInput = {
  formId: string;
  filter: "last_24_hours" | "last_7_days" | "last_30_days" | "last_90_days" | "custom";
  startDate?: string;
  endDate?: string;
};

// Display-only gate for insights/dropoff readers. Recorders write unconditionally — toggle
// controls what's shown not what's kept, so enabling later (or upgrading) surfaces history.
// Org-plan check covers the window before a Polar downgrade webhook flips cached state.
export const isAnalyticsEnabled = async (formId: string): Promise<boolean> => {
  const { display } = await getAnalyticsState(formId);
  return display;
};

/** Two booleans driving analytics availability: toggle (raw formSettings.analytics) and
 * display (toggle AND plan unlock). display uses cached organization.plan; UI needing
 * Polar-confirmed state should re-derive via getOrgPlanWithPolarSync (recorders use the column). */
export const getAnalyticsState = async (
  formId: string,
): Promise<{ toggle: boolean; display: boolean }> => {
  // Read LIVE settings (form_settings), not draft: display reflects published, not pending edits.
  const [row] = await db
    .select({ settings: formSettings.settings, plan: organization.plan })
    .from(forms)
    .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
    .innerJoin(organization, eq(organization.id, workspaces.organizationId))
    .leftJoin(formSettings, eq(formSettings.formId, forms.id))
    .where(eq(forms.id, formId));
  const toggle = row?.settings?.analytics === true;
  const display = toggle && isServerPlan(row?.plan) && planUnlocks(row.plan, "analytics");
  return { toggle, display };
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

// null when there's no client IP — callers skip the rate limit then. getRequestIP throws off the
// server runtime ("No StartEvent in AsyncLocalStorage", e.g. unit tests), so guard it. Production
// traffic always carries x-forwarded-for (set by Vercel); this only fails open off-platform, where
// flooding isn't the concern (the published-form gate still applies).
const getClientIp = (): string | null => {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
};

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
  if (Math.random() < ANALYTICS_CLEANUP_PROBABILITY) {
    await db.execute(
      sql`DELETE FROM analytics_rate_limits WHERE window_start < now() - interval '1 hour'`,
    );
  }
  const result = await db
    .insert(analyticsRateLimits)
    .values({ ip, count: 1 })
    .onConflictDoUpdate({
      target: analyticsRateLimits.ip,
      set: {
        count: sql`CASE
          WHEN ${analyticsRateLimits.windowStart} < now() - ${ANALYTICS_WINDOW_INTERVAL_SQL}
            THEN 1
          ELSE ${analyticsRateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${analyticsRateLimits.windowStart} < now() - ${ANALYTICS_WINDOW_INTERVAL_SQL}
            THEN now()
          ELSE ${analyticsRateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: analyticsRateLimits.count });
  return (result[0]?.count ?? 0) <= ANALYTICS_MAX_PER_WINDOW;
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

// Authoritative completed-submission count for a range, straight from the `submissions` table —
// the same source the Answers/Submissions views use. Visits/Dropoffs show this so every tab agrees
// (their visit/progress event tables are best-effort proxies that under- or over-count).
const countCompletedSubmissions = async (
  formId: string,
  start: Date,
  end: Date,
): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.formId, formId),
        eq(submissions.isCompleted, true),
        gte(submissions.createdAt, start),
        lte(submissions.createdAt, end),
      ),
    );
  return row?.value ?? 0;
};

// % change vs the prior equal-length window; null when prior is empty (can't divide → no hint).
const pctChange = (current: number, prior: number): number | null =>
  prior > 0 ? Math.round(((current - prior) / prior) * 100) : null;

const durationRowsForDays = async (formId: string, dayKeys: string[]) =>
  dayKeys.length > 0
    ? await db
        .select({
          medianDurationMs: formAnalyticsDaily.medianDurationMs,
          totalVisits: formAnalyticsDaily.totalVisits,
          // Duration sample count for the median blend (submitters); totalVisits drives prior-visits delta.
          totalSubmissions: formAnalyticsDaily.totalSubmissions,
        })
        .from(formAnalyticsDaily)
        .where(
          and(eq(formAnalyticsDaily.formId, formId), inArray(formAnalyticsDaily.date, dayKeys)),
        )
    : [];

export const getFormInsightsImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<FormInsightsMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = resolveTimeRange(
    { filter: data.filter, startDate: data.startDate, endDate: data.endDate },
    now,
  );
  const split = splitTodayVsPast(range, now);

  const enabled = await isAnalyticsEnabled(data.formId);
  const dailyRows =
    enabled && split.pastDays.length > 0
      ? await db
          .select()
          .from(formAnalyticsDaily)
          .where(
            and(
              eq(formAnalyticsDaily.formId, data.formId),
              inArray(formAnalyticsDaily.date, split.pastDays),
            ),
          )
      : [];

  const todayRawRows =
    enabled && split.rawStart
      ? await db
          .select()
          .from(formVisits)
          .where(
            and(
              eq(formVisits.formId, data.formId),
              gte(formVisits.visitStartedAt, split.rawStart),
              lte(formVisits.visitStartedAt, range.end),
            ),
          )
      : [];

  const metrics = mergeInsightsMetrics({
    dailyRows,
    todayRawRows,
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    days: range.days,
    todayKey: split.todayStart ? toDateKey(split.todayStart) : null,
  });

  // "vs previous equal-length period" trends (shared by all tabs). Prior window is fully past →
  // reads daily rollups + submissions table only.
  const priorDays = priorDayKeys(range.days);
  const priorStart = priorDays[0] ? new Date(`${priorDays[0]}T00:00:00.000Z`) : range.start;
  const priorEnd = priorDays.at(-1) ? new Date(`${priorDays.at(-1)}T23:59:59.999Z`) : range.start;
  const [completedSubmissions, priorSubmissions, curDurRows, priorDurRows] = await Promise.all([
    countCompletedSubmissions(data.formId, range.start, range.end),
    countCompletedSubmissions(data.formId, priorStart, priorEnd),
    durationRowsForDays(data.formId, split.pastDays),
    durationRowsForDays(data.formId, priorDays),
  ]);
  const priorVisits = priorDurRows.reduce((sum, r) => sum + r.totalVisits, 0);
  // Weight the median blend by each day's submitter count (sample count), matching the live path.
  const toDurationSamples = (rows: typeof curDurRows) =>
    rows.map((r) => ({ medianDurationMs: r.medianDurationMs, sampleCount: r.totalSubmissions }));
  const curAvg = weightedMedianDuration(toDurationSamples(curDurRows));
  const priorAvg = weightedMedianDuration(toDurationSamples(priorDurRows));

  return {
    ...metrics,
    completedSubmissions,
    visitsDeltaPct: pctChange(metrics.totalVisits, priorVisits),
    submissionsDeltaPct: pctChange(completedSubmissions, priorSubmissions),
    completionRateDeltaPts:
      priorVisits > 0
        ? completionRate(completedSubmissions, metrics.totalVisits) -
          completionRate(priorSubmissions, priorVisits)
        : null,
    avgDurationDeltaMs: curAvg !== null && priorAvg !== null ? curAvg - priorAvg : null,
  };
};

/** Day keys for the period immediately before rangeDays (same length), for "vs prior" deltas.
 * Prior window is fully past, so reads entirely from aggregated daily rows. */
const priorDayKeys = (rangeDays: string[]): string[] => {
  const firstKey = rangeDays[0];
  if (!firstKey) {
    return [];
  }
  const firstDay = new Date(`${firstKey}T00:00:00.000Z`);
  const keys: string[] = [];
  for (let offset = rangeDays.length; offset >= 1; offset--) {
    keys.push(toDateKey(new Date(firstDay.getTime() - offset * MS_PER_DAY)));
  }
  return keys;
};

export const getFormVitalsImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<FormVitalsMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = resolveTimeRange(
    { filter: data.filter, startDate: data.startDate, endDate: data.endDate },
    now,
  );
  const split = splitTodayVsPast(range, now);
  const startDate = data.startDate ?? toDateKey(range.start);
  const endDate = data.endDate ?? toDateKey(range.end);

  const enabled = await isAnalyticsEnabled(data.formId);
  if (!enabled) {
    return buildVitalsMetrics({
      dailyRows: [],
      todayRawRows: [],
      priorDailyRows: [],
      days: range.days,
      todayKey: split.todayStart ? toDateKey(split.todayStart) : null,
      startDate,
      endDate,
    });
  }

  const dailyVitalsColumns = {
    date: formAnalyticsDaily.date,
    lcpHistogram: formAnalyticsDaily.lcpHistogram,
    inpHistogram: formAnalyticsDaily.inpHistogram,
    clsHistogram: formAnalyticsDaily.clsHistogram,
  };

  const dailyRows =
    split.pastDays.length > 0
      ? await db
          .select(dailyVitalsColumns)
          .from(formAnalyticsDaily)
          .where(
            and(
              eq(formAnalyticsDaily.formId, data.formId),
              inArray(formAnalyticsDaily.date, split.pastDays),
            ),
          )
      : [];

  const todayRawRows = split.rawStart
    ? await db
        .select({ lcpMs: formVisits.lcpMs, inpMs: formVisits.inpMs, cls: formVisits.cls })
        .from(formVisits)
        .where(
          and(
            eq(formVisits.formId, data.formId),
            gte(formVisits.visitStartedAt, split.rawStart),
            lte(formVisits.visitStartedAt, range.end),
          ),
        )
    : [];

  const priorDays = priorDayKeys(range.days);
  const priorDailyRows =
    priorDays.length > 0
      ? await db
          .select(dailyVitalsColumns)
          .from(formAnalyticsDaily)
          .where(
            and(
              eq(formAnalyticsDaily.formId, data.formId),
              inArray(formAnalyticsDaily.date, priorDays),
            ),
          )
      : [];

  return buildVitalsMetrics({
    dailyRows,
    todayRawRows,
    priorDailyRows,
    days: range.days,
    todayKey: split.todayStart ? toDateKey(split.todayStart) : null,
    startDate,
    endDate,
  });
};

export const getFormDropoffImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<QuestionDropoffMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = resolveTimeRange(
    { filter: data.filter, startDate: data.startDate, endDate: data.endDate },
    now,
  );
  const split = splitTodayVsPast(range, now);

  const enabled = await isAnalyticsEnabled(data.formId);
  const cutDateKey = PER_QUESTION_ANALYTICS_CUT_TS.slice(0, 10);
  const cutDate = new Date(PER_QUESTION_ANALYTICS_CUT_TS);
  const rawDailyRows =
    enabled && split.pastDays.length > 0
      ? await db
          .select()
          .from(formDropoffDaily)
          .where(
            and(
              eq(formDropoffDaily.formId, data.formId),
              inArray(formDropoffDaily.date, split.pastDays),
              gte(formDropoffDaily.date, cutDateKey),
            ),
          )
      : [];

  const rawTodayProgressRows =
    enabled && split.rawStart
      ? await db
          .select()
          .from(formQuestionProgress)
          .where(
            and(
              eq(formQuestionProgress.formId, data.formId),
              gte(formQuestionProgress.viewedAt, split.rawStart),
              lte(formQuestionProgress.viewedAt, range.end),
              gte(formQuestionProgress.viewedAt, cutDate),
            ),
          )
      : [];

  const { dailyRows, todayProgressRows } = filterByCutDate({
    dailyRows: rawDailyRows,
    todayProgressRows: rawTodayProgressRows,
    cutTs: PER_QUESTION_ANALYTICS_CUT_TS,
  });

  // Question-id → label map from draft content so funnel shows labels not raw Plate Block ids.
  const labelMap = new Map<string, string>();
  const [formRow] = await db
    .select({ content: forms.content })
    .from(forms)
    .where(eq(forms.id, data.formId));
  if (formRow?.content) {
    const { steps } = transformPlateForPreview(formRow.content as Value);
    for (const step of steps) {
      for (const seg of step) {
        if (seg.type === "field" && seg.field.fieldType !== "Button" && seg.field.label) {
          labelMap.set(seg.field.id, seg.field.label);
        }
      }
    }
  }

  const metrics = mergeDropoffMetrics({
    formId: data.formId,
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    dailyRows,
    todayProgressRows,
    labelMap,
  });

  // Total-dropoffs trend vs the prior equal-length window (submissions/avg-time deltas come from
  // insights). Prior window is fully past → reads daily rollups only.
  const priorDays = priorDayKeys(range.days);
  const priorDropoffDailyRows =
    enabled && priorDays.length > 0
      ? await db
          .select()
          .from(formDropoffDaily)
          .where(
            and(
              eq(formDropoffDaily.formId, data.formId),
              inArray(formDropoffDaily.date, priorDays),
              gte(formDropoffDaily.date, cutDateKey),
            ),
          )
      : [];
  const priorMetrics = mergeDropoffMetrics({
    formId: data.formId,
    startDate: priorDays[0] ?? "",
    endDate: priorDays.at(-1) ?? "",
    dailyRows: priorDropoffDailyRows,
    todayProgressRows: [],
    labelMap,
  });

  const totalDropoffs = metrics.totalStarted - metrics.totalCompleted;
  const priorDropoffs = priorMetrics.totalStarted - priorMetrics.totalCompleted;

  // Time per question = avg(completedAt − startedAt) over progress rows in range (timing isn't in
  // the daily rollups, so read raw — retained 90d = max range). Cut-date gated like the rest.
  const timingRows = enabled
    ? await db
        .select({
          questionId: formQuestionProgress.questionId,
          questionIndex: formQuestionProgress.questionIndex,
          startedAt: formQuestionProgress.startedAt,
          completedAt: formQuestionProgress.completedAt,
        })
        .from(formQuestionProgress)
        .where(
          and(
            eq(formQuestionProgress.formId, data.formId),
            gte(formQuestionProgress.viewedAt, range.start),
            lte(formQuestionProgress.viewedAt, range.end),
            gte(formQuestionProgress.viewedAt, cutDate),
          ),
        )
    : [];

  const timeAgg = new Map<string, { index: number; sum: number; n: number }>();
  for (const r of timingRows) {
    if (!r.startedAt || !r.completedAt) continue;
    const ms = r.completedAt.getTime() - r.startedAt.getTime();
    if (ms <= 0) continue; // guard clock skew / instant rows
    const prev = timeAgg.get(r.questionId) ?? { index: r.questionIndex, sum: 0, n: 0 };
    prev.sum += ms;
    prev.n += 1;
    timeAgg.set(r.questionId, prev);
  }
  const timePerQuestion = [...timeAgg.entries()]
    .map(([questionId, { index, sum, n }]) => ({
      questionIndex: index,
      label: labelMap.get(questionId) ?? `Q${index + 1}`,
      avgMs: Math.round(sum / n),
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  return {
    ...metrics,
    completedSubmissions: await countCompletedSubmissions(data.formId, range.start, range.end),
    totalDropoffsDeltaPct: pctChange(totalDropoffs, priorDropoffs),
    timePerQuestion,
  };
};

const ANSWER_SUBMISSION_CAP = 25_000;

// Categorical fields → donut (capped at 6 + an "Others" bucket). Fields carrying an explicit
// option set are also treated as choice regardless of fieldType (e.g. dropdowns, country pickers).
const ANSWER_CHOICE_TYPES = new Set([
  "MultiChoice",
  "Checkbox",
  "Ranking",
  "Rating",
  "LinearScale",
]);

// Free-text → domain extraction (gmail.com, behance.net): list, not chart.
const ANSWER_DOMAIN_TYPES = new Set(["Email", "Link"]);
// Free-text with no extractable structure → bucket by response length.
const ANSWER_LENGTH_TYPES = new Set(["Input", "Textarea"]);
// Provided-or-not → Yes/No.
const ANSWER_PRESENCE_TYPES = new Set(["FileUpload", "Signature"]);

// Pick how a field's raw answers collapse into a meaningful distribution. Listing every distinct
// free-text answer (8 unique emails, each count 1) is noise — so emails/URLs reduce to domains,
// prose buckets by length, uploads/signatures to Yes/No. Categorical stays a donut.
const resolveAnalysis = (fieldType: string, hasOptions: boolean): AnswerAnalysis => {
  if (hasOptions || ANSWER_CHOICE_TYPES.has(fieldType)) return "choice";
  if (ANSWER_DOMAIN_TYPES.has(fieldType)) return "domain";
  if (ANSWER_LENGTH_TYPES.has(fieldType)) return "length";
  if (ANSWER_PRESENCE_TYPES.has(fieldType)) return "presence";
  return "raw"; // Number, Date, Time, Phone, Matrix — low-cardinality top-N values
};

// Length buckets (char count of the trimmed answer), short→long, matching the Figma labels.
const LENGTH_BUCKETS: { label: string; max: number }[] = [
  { label: "Very short", max: 20 },
  { label: "Short", max: 60 },
  { label: "Medium", max: 160 },
  { label: "Detailed", max: Number.POSITIVE_INFINITY },
];
const lengthBucket = (len: number): string =>
  LENGTH_BUCKETS.find((b) => len <= b.max)?.label ?? "Detailed";

const emailDomain = (raw: string): string => {
  const at = raw.lastIndexOf("@");
  const domain =
    at >= 0
      ? raw
          .slice(at + 1)
          .trim()
          .toLowerCase()
      : "";
  return domain || "other";
};

const urlDomain = (raw: string): string => {
  const trimmed = raw.trim();
  try {
    const u = new URL(/^[a-z][\w+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return u.hostname.replace(/^www\./, "").toLowerCase() || "other";
  } catch {
    return trimmed.toLowerCase() || "other";
  }
};

// Cap a desc-sorted distribution at `cap`, rolling the tail into an "Others" bucket.
const capWithOthers = (sorted: AnswerDistributionItem[], cap: number): AnswerDistributionItem[] => {
  if (sorted.length <= cap) return sorted;
  const head = sorted.slice(0, cap);
  const others = sorted.slice(cap).reduce((sum, e) => sum + e.value, 0);
  if (others > 0) head.push({ label: "Others", value: others });
  return head;
};

const bump = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

// Shape the tallied counts into the final distribution per analysis kind:
// length → fixed buckets in short→long order; presence → Yes/No vs submissions;
// choice/domain → desc + "Others" tail; raw → top 8 distinct values.
const buildAnswerDistribution = ({
  analysis,
  counts,
  answered,
  submissionCount,
  optionLabel,
}: {
  analysis: AnswerAnalysis;
  counts: Map<string, number>;
  answered: number;
  submissionCount: number;
  optionLabel: (value: string) => string;
}): AnswerDistributionItem[] => {
  if (analysis === "length") {
    return LENGTH_BUCKETS.map((b) => ({ label: b.label, value: counts.get(b.label) ?? 0 })).filter(
      (e) => e.value > 0,
    );
  }
  if (analysis === "presence") {
    return [
      { label: "Yes", value: answered },
      { label: "No", value: Math.max(0, submissionCount - answered) },
    ].filter((e) => e.value > 0);
  }
  const sorted = [...counts.entries()]
    .map(([value, count]) => ({
      label: analysis === "choice" ? optionLabel(value) : value,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);
  return analysis === "raw" ? sorted.slice(0, 8) : capWithOthers(sorted, 6);
};

// Flatten a stored answer (string | number | string[] | matrix record) to present string values.
const normalizeAnswer = (raw: unknown): string[] => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((x) => String(x ?? "").trim() !== "").map(String);
  if (typeof raw === "object") {
    const out: string[] = [];
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out.push(...v.filter((x) => String(x ?? "").trim() !== "").map(String));
      else if (String(v ?? "").trim() !== "") out.push(String(v));
    }
    return out;
  }
  const s = String(raw).trim();
  return s === "" ? [] : [s];
};

export const getFormAnswersImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<FormAnswerMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = resolveTimeRange(
    { filter: data.filter, startDate: data.startDate, endDate: data.endDate },
    now,
  );

  const [formRow] = await db
    .select({ content: forms.content })
    .from(forms)
    .where(eq(forms.id, data.formId));

  // Canonical answerable fields (shared taxonomy), in order.
  const fields =
    formRow?.content != null
      ? getFieldsFromSegments(
          transformPlateForPreview(formRow.content as Value).steps.flat(),
        ).filter((f) => EDITABLE_FIELD_TYPES.has(f.fieldType))
      : [];

  // Aggregated in JS; cap as an OOM backstop (counts approximate past the cap on huge forms).
  const rows = await db
    .select({ data: submissions.data })
    .from(submissions)
    .where(
      and(
        eq(submissions.formId, data.formId),
        eq(submissions.isCompleted, true),
        gte(submissions.createdAt, range.start),
        lte(submissions.createdAt, range.end),
      ),
    )
    .limit(ANSWER_SUBMISSION_CAP);

  const datas = rows.map((r) => (r.data ?? {}) as Record<string, unknown>);
  const submissionCount = datas.length;

  const questions: QuestionAnswerSummary[] = fields.map((field, index) => {
    const options = "options" in field ? field.options : undefined;
    const optionLabel = (value: string): string =>
      options?.find((o) => o.value === value)?.label ?? value;
    const analysis = resolveAnalysis(field.fieldType, (options?.length ?? 0) > 0);

    // Tally each submission into the bucket(s) appropriate for this field's analysis kind.
    const counts = new Map<string, number>();
    let answered = 0;
    for (const d of datas) {
      const values = normalizeAnswer(d[field.name]);
      if (values.length === 0) continue;
      answered += 1;
      if (analysis === "length") {
        bump(counts, lengthBucket(values.join(" ").trim().length));
      } else if (analysis === "domain") {
        for (const v of values)
          bump(counts, field.fieldType === "Email" ? emailDomain(v) : urlDomain(v));
      } else if (analysis !== "presence") {
        for (const v of values) bump(counts, v); // choice / raw — count each value
      }
    }

    const distribution = buildAnswerDistribution({
      analysis,
      counts,
      answered,
      submissionCount,
      optionLabel,
    });

    return {
      id: field.id,
      questionIndex: index,
      label: ("label" in field ? field.label : undefined)?.trim() || field.name,
      fieldType: field.fieldType,
      analysis,
      answered,
      distribution,
    };
  });

  const totalAnswered = questions.reduce((sum, q) => sum + q.answered, 0);

  return {
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    submissions: submissionCount,
    totalQuestions: questions.length,
    avgAnswered: submissionCount > 0 ? totalAnswered / submissionCount : 0,
    questions,
  };
};

export interface InsightsAvailability {
  /** Form's lifecycle state — drives the "publish first" prompt. */
  formStatus: string;
  /** Total submissions for the form (lifetime, all-time). */
  submissionCount: number;
  /** Any raw visit recorded. Recorders write unconditionally, so true once anyone loads
   *  the public form even if the toggle was never flipped. */
  hasAnyVisits: boolean;
  /** Raw formSettings.analytics — per-form toggle on regardless of plan. Lets empty state
   *  tell "off" from "on-but-plan-locked". */
  analyticsToggle: boolean;
  /** toggle AND plan-unlock; drives dashboard render. False if toggle off OR plan lacks analytics. */
  analyticsEnabled: boolean;
}

export const getInsightsAvailabilityImpl = async (
  data: { formId: string },
  context: { session: { user: { id: string; email?: string | null } } },
  orgId: string,
): Promise<InsightsAvailability> => {
  await authForm(data.formId, context.session.user.id, orgId);

  // Plan via Polar-sync (organization.plan drifts on missed webhook); counts don't depend on it,
  // so run them in parallel with the Polar roundtrip.
  const [plan, [form], [{ value: submissionCount }], [{ value: visitCount }], analyticsState] =
    await Promise.all([
      getOrgPlanWithPolarSync(orgId, context.session.user.email ?? null),
      db.select({ status: forms.status }).from(forms).where(eq(forms.id, data.formId)).limit(1),
      db.select({ value: count() }).from(submissions).where(eq(submissions.formId, data.formId)),
      db.select({ value: count() }).from(formVisits).where(eq(formVisits.formId, data.formId)),
      getAnalyticsState(data.formId),
    ]);

  // getAnalyticsState ran without override (to parallelize with Polar); re-derive against Polar-confirmed plan.
  const analyticsEnabled = analyticsState.toggle && planUnlocks(plan, "analytics");

  return {
    formStatus: form?.status ?? "draft",
    submissionCount,
    hasAnyVisits: visitCount > 0,
    analyticsToggle: analyticsState.toggle,
    analyticsEnabled,
  };
};

const DAYS_TO_RETAIN = 90;
const MS_PER_DAY = 86_400_000;
const RETENTION_MS = DAYS_TO_RETAIN * MS_PER_DAY;

export interface AggregateResult {
  ok: true;
  date: string;
  analyticsRows: number;
  dropoffRows: number;
  pruned: { visits: number; progress: number };
}

/** Idempotent nightly rollup, single transaction (no half-written aggregates):
 * 1. formVisits → one formAnalyticsDaily row/formId (delete-then-insert per date, no double-count).
 * 2. formQuestionProgress → one formDropoffDaily row per (formId, questionId, questionIndex).
 * 3. Prune raw rows older than 90 days from both raw tables. */
export const aggregateAnalyticsDailyImpl = async (data: {
  date: string;
}): Promise<AggregateResult> => {
  const { date } = data;
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_MS);

  const result = await db.transaction(async (tx) => {
    const visits = await tx
      .select()
      .from(formVisits)
      .where(and(gte(formVisits.visitStartedAt, dayStart), lte(formVisits.visitStartedAt, dayEnd)));

    const progress = await tx
      .select()
      .from(formQuestionProgress)
      .where(
        and(
          gte(formQuestionProgress.viewedAt, dayStart),
          lte(formQuestionProgress.viewedAt, dayEnd),
        ),
      );

    const analyticsRows = buildDailyAnalyticsRows(visits, date, now);
    const dropoffRows = buildDailyDropoffRows({
      rows: progress,
      visits,
      dateKey: date,
      now,
    });

    await tx.delete(formAnalyticsDaily).where(eq(formAnalyticsDaily.date, date));
    if (analyticsRows.length > 0) {
      await tx.insert(formAnalyticsDaily).values(analyticsRows);
    }

    await tx.delete(formDropoffDaily).where(eq(formDropoffDaily.date, date));
    if (dropoffRows.length > 0) {
      await tx.insert(formDropoffDaily).values(dropoffRows);
    }

    await tx.delete(formVisits).where(lt(formVisits.visitStartedAt, cutoff));
    await tx.delete(formQuestionProgress).where(lt(formQuestionProgress.viewedAt, cutoff));

    return {
      analyticsRows: analyticsRows.length,
      dropoffRows: dropoffRows.length,
    };
  });

  return {
    ok: true,
    date,
    analyticsRows: result.analyticsRows,
    dropoffRows: result.dropoffRows,
    pruned: { visits: 0, progress: 0 },
  };
};
