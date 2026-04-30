import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  formAnalyticsDaily,
  formDropoffDaily,
  formQuestionProgress,
  forms,
  formVisits,
  organization,
  workspaces,
} from "@/db/schema";
import { buildDailyAnalyticsRows, buildDailyDropoffRows } from "@/lib/analytics/aggregate-utils";
import { isBotUserAgent } from "@/lib/analytics/bot-filter";
import { mergeDropoffMetrics } from "@/lib/analytics/merge-dropoff";
import { mergeInsightsMetrics } from "@/lib/analytics/merge-metrics";
import { parseUserAgent } from "@/lib/analytics/parse-user-agent";
import { resolveTimeRange, splitTodayVsPast, toDateKey } from "@/lib/analytics/time-range";
import { planUnlocks } from "@/lib/config/plan-gates";
import { authForm } from "@/lib/server-fn/auth-helpers.server";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import type { FormInsightsMetrics, QuestionDropoffMetrics } from "@/types/analytics";

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
};

export type RecordQuestionProgressInput = {
  visitId: string;
  formId: string;
  visitorHash: string;
  questionId: string;
  questionType?: string | null;
  questionIndex: number;
  event: "view" | "start" | "complete";
  wasLastQuestion?: boolean;
};

export type InsightsFilterInput = {
  formId: string;
  filter: "last_24_hours" | "last_7_days" | "last_30_days" | "last_90_days" | "custom";
  startDate?: string;
  endDate?: string;
};

// Defense in depth — direct callers can bypass the client hook, and the
// org-plan check covers the window where a Polar downgrade webhook hasn't
// yet flipped `forms.analytics`.
export const isAnalyticsEnabled = async (formId: string): Promise<boolean> => {
  const [row] = await db
    .select({ settings: forms.settings, plan: organization.plan })
    .from(forms)
    .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
    .innerJoin(organization, eq(organization.id, workspaces.organizationId))
    .where(eq(forms.id, formId));
  if (row?.settings?.analytics !== true) return false;
  return isServerPlan(row.plan) && planUnlocks(row.plan, "analytics");
};

export const recordFormVisitImpl = async (
  data: RecordFormVisitInput,
): Promise<{ visitId: string | null }> => {
  if (!(await isAnalyticsEnabled(data.formId))) {
    return { visitId: null };
  }

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
    countryName: null,
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

  await db.update(formVisits).set(updates).where(eq(formVisits.id, data.visitId));
  return { ok: true };
};

export const recordQuestionProgressImpl = async (
  data: RecordQuestionProgressInput,
): Promise<{ ok: true }> => {
  if (!(await isAnalyticsEnabled(data.formId))) {
    return { ok: true };
  }
  // NOTE: race-prone if a single visitor fires multiple events simultaneously.
  // V1 acceptable: duplicates inflate progress rows but aggregation in Task 12
  // dedupes by max(viewedAt) per (visitorHash, questionId). A unique constraint
  // on (visitId, questionId) would be the right v2 fix.
  const [existing] = await db
    .select()
    .from(formQuestionProgress)
    .where(
      and(
        eq(formQuestionProgress.visitId, data.visitId),
        eq(formQuestionProgress.questionId, data.questionId),
      ),
    )
    .limit(1);

  const now = new Date();

  if (!existing) {
    const isStartOrComplete = data.event === "start" || data.event === "complete";
    await db.insert(formQuestionProgress).values({
      id: crypto.randomUUID(),
      visitId: data.visitId,
      formId: data.formId,
      visitorHash: data.visitorHash,
      questionId: data.questionId,
      questionType: data.questionType ?? null,
      questionIndex: data.questionIndex,
      viewedAt: now,
      startedAt: isStartOrComplete ? now : null,
      completedAt: data.event === "complete" ? now : null,
      wasLastQuestion: data.wasLastQuestion ?? false,
    });
    return { ok: true };
  }

  const updates: Partial<typeof formQuestionProgress.$inferInsert> = {};
  if (data.event === "start" && !existing.startedAt) {
    updates.startedAt = now;
  }
  if (data.event === "complete") {
    updates.completedAt = now;
    if (!existing.startedAt) {
      updates.startedAt = now;
    }
  }
  if (data.wasLastQuestion !== undefined) {
    updates.wasLastQuestion = data.wasLastQuestion;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(formQuestionProgress)
      .set(updates)
      .where(eq(formQuestionProgress.id, existing.id));
  }
  return { ok: true };
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
  const dailyRows =
    enabled && split.pastDays.length > 0
      ? await db
          .select()
          .from(formDropoffDaily)
          .where(
            and(
              eq(formDropoffDaily.formId, data.formId),
              inArray(formDropoffDaily.date, split.pastDays),
            ),
          )
      : [];

  const todayProgressRows =
    enabled && split.rawStart
      ? await db
          .select()
          .from(formQuestionProgress)
          .where(
            and(
              eq(formQuestionProgress.formId, data.formId),
              gte(formQuestionProgress.viewedAt, split.rawStart),
              lte(formQuestionProgress.viewedAt, range.end),
            ),
          )
      : [];

  return mergeDropoffMetrics({
    formId: data.formId,
    startDate: data.startDate ?? toDateKey(range.start),
    endDate: data.endDate ?? toDateKey(range.end),
    dailyRows,
    todayProgressRows,
  });
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
    const dropoffRows = buildDailyDropoffRows(progress, date, now);

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
