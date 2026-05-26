import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
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
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import type { Value } from "platejs";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { PER_QUESTION_ANALYTICS_CUT_TS } from "@/lib/analytics/cut-date";
import { filterByCutDate, mergeDropoffMetrics } from "@/lib/analytics/merge-dropoff";
import { mergeInsightsMetrics } from "@/lib/analytics/merge-metrics";
import { buildVitalsMetrics } from "@/lib/analytics/merge-vitals";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";
import { resolveTimeRange, splitTodayVsPast, toDateKey } from "@/lib/analytics/time-range";
import { planUnlocks } from "@/lib/config/plan-gates";
import { authForm } from "@/lib/server-fn/auth-helpers.server";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import type {
  FormInsightsMetrics,
  FormVitalsMetrics,
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
  durationMs?: number | null;
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

// Display-only gate for insights/dropoff readers. Recorders write data
// unconditionally — the toggle controls what's *shown*, not what's *kept*,
// so enabling analytics later (or upgrading to Pro) surfaces historical
// data instead of starting from zero. The org-plan check covers the
// window where a Polar downgrade webhook hasn't yet flipped any cached
// state.
export const isAnalyticsEnabled = async (formId: string): Promise<boolean> => {
  const { display } = await getAnalyticsState(formId);
  return display;
};

/**
 * Returns the two booleans that drive every analytics-availability decision:
 *   - `toggle`: raw `formSettings.settings.analytics` (what the user can flip)
 *   - `display`: whether visits/dropoff should render — toggle AND plan unlock
 *
 * `display` consults the cached `organization.plan` column. UI surfaces that
 * need Polar-confirmed state should ignore `display` and re-derive it against
 * `getOrgPlanWithPolarSync` themselves; recorders are fine with the column.
 */
export const getAnalyticsState = async (
  formId: string,
): Promise<{ toggle: boolean; display: boolean }> => {
  // Read the LIVE settings (form_settings table), not the working draft —
  // analytics display should reflect what's published, not pending edits.
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

export const recordFormVisitImpl = async (
  data: RecordFormVisitInput,
): Promise<{ visitId: string | null }> => {
  const headers = getRequestHeaders();
  const ua = headers.get("user-agent");

  if (isBotUserAgent(ua)) {
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
  if (data.durationMs !== undefined) {
    updates.durationMs = data.durationMs;
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
      // Reference excluded.* (the would-be-inserted row) instead of interpolating
      // raw Date values into sql templates — postgres-js's parameter binder
      // refuses a JS Date for a coalesce arg when the column type isn't
      // explicit on its branch (issue triggered analytics-option-b.test.ts).
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
  for (const item of data.items) {
    await recordQuestionProgressImpl(item);
  }
  return { ok: true, processed: data.items.length };
};

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

  return mergeInsightsMetrics({
    dailyRows,
    todayRawRows,
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    days: range.days,
    todayKey: split.todayStart ? toDateKey(split.todayStart) : null,
  });
};

/**
 * Day keys for the period immediately preceding `rangeDays` (same length),
 * used to compute "vs prior period" deltas. The prior window is always fully
 * in the past, so it reads entirely from aggregated daily rows.
 */
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

  // Build a Question-id → label map from the Form's current draft content so
  // the funnel renders human-readable labels instead of raw Plate Block ids.
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

  return mergeDropoffMetrics({
    formId: data.formId,
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    dailyRows,
    todayProgressRows,
    labelMap,
  });
};

export interface InsightsAvailability {
  /** Form's lifecycle state — drives the "publish first" prompt. */
  formStatus: string;
  /** Total submissions for the form (lifetime, all-time). */
  submissionCount: number;
  /** Whether ANY raw visit has been recorded for this form. Recorders write
   *  unconditionally now, so this is true once anyone has loaded the public
   *  form even if the analytics toggle has never been flipped on. */
  hasAnyVisits: boolean;
  /** Raw `formSettings.settings.analytics` value — whether the per-form
   *  toggle is flipped on, regardless of whether the org plan allows it.
   *  Lets the empty state tell "off" apart from "on-but-plan-locked". */
  analyticsToggle: boolean;
  /** Live toggle AND plan-unlock both true — drives the actual dashboard
   *  render. False when the toggle is off OR the plan doesn't include
   *  analytics. */
  analyticsEnabled: boolean;
}

export const getInsightsAvailabilityImpl = async (
  data: { formId: string },
  context: { session: { user: { id: string; email?: string | null } } },
  orgId: string,
): Promise<InsightsAvailability> => {
  await authForm(data.formId, context.session.user.id, orgId);

  // Plan resolves via Polar-sync (the `organization.plan` column drifts if a
  // webhook missed) but the count queries don't depend on it — run them in
  // parallel with the Polar roundtrip rather than serializing.
  const [plan, [form], [{ value: submissionCount }], [{ value: visitCount }], analyticsState] =
    await Promise.all([
      getOrgPlanWithPolarSync(orgId, context.session.user.email ?? null),
      db.select({ status: forms.status }).from(forms).where(eq(forms.id, data.formId)).limit(1),
      db.select({ value: count() }).from(submissions).where(eq(submissions.formId, data.formId)),
      db.select({ value: count() }).from(formVisits).where(eq(formVisits.formId, data.formId)),
      getAnalyticsState(data.formId),
    ]);

  // `getAnalyticsState` ran without the override (so it could parallelize with
  // the Polar fetch); re-derive `display` against the Polar-confirmed plan.
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

/**
 * Idempotent nightly rollup.
 *
 * 1. Reads raw `formVisits` for the given UTC date and writes one
 *    `formAnalyticsDaily` row per `formId` (delete-then-insert for the date,
 *    so re-running for the same date never double-counts).
 * 2. Reads raw `formQuestionProgress` for the same UTC date and writes one
 *    `formDropoffDaily` row per (formId, questionId, questionIndex).
 * 3. Prunes raw rows older than 90 days from BOTH raw tables.
 *
 * Wrapped in a single DB transaction so partial failures don't leave half-
 * written aggregates.
 */
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
