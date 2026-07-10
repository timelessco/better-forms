import { and, count, eq, gte, lt, lte } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
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
import {
  buildAnswerDistribution,
  bump,
  emailDomain,
  lengthBucket,
  normalizeAnswer,
  resolveAnalysis,
  urlDomain,
} from "@/lib/analytics/answer-analysis";
import { PER_QUESTION_ANALYTICS_CUT_TS } from "@/lib/analytics/cut-date";
import { filterByCutDate, mergeDropoffMetrics } from "@/lib/analytics/merge-dropoff";
import { buildVitalsMetrics } from "@/lib/analytics/merge-vitals";
import { mergeInsightsMetrics } from "@/lib/analytics/merge-metrics";
import { completionRate, weightedMedianDuration } from "@/lib/analytics/metrics";
import { rollupToSteps } from "@/lib/analytics/step-rollup";
import { resolveTimeRange, splitTodayVsPast, toDateKey } from "@/lib/analytics/time-range";
import type { ResolvedRange } from "@/lib/analytics/time-range";
import {
  EDITABLE_FIELD_TYPES,
  getFieldsFromSegments,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import { planUnlocks } from "@/lib/config/plan-gates";
import { authForm } from "@/lib/server-fn/auth-helpers.server";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import type { Value } from "platejs";
import type {
  FormAnswerMetrics,
  FormInsightsMetrics,
  FormVitalsMetrics,
  QuestionAnswerSummary,
  QuestionDropoffMetrics,
  TimeRangeFilter,
} from "@/types/analytics";

export type InsightsFilterInput = {
  formId: string;
  filter: TimeRangeFilter;
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

// Contiguous, sorted YYYY-MM-DD keys → a gte/lte predicate on a sortable text date column. Matches
// the same rows as inArray without enumerating keys — all_time/last_year span thousands of days.
const dayKeyRange = (column: AnyColumn, dayKeys: string[]): SQL | undefined =>
  dayKeys.length > 0
    ? and(gte(column, dayKeys[0]), lte(column, dayKeys[dayKeys.length - 1]))
    : undefined;

// all_time's lower bound is the form's createdAt; epoch fallback keeps a missing form from inverting.
const getFormCreatedAt = async (formId: string): Promise<Date> => {
  const [row] = await db
    .select({ createdAt: forms.createdAt })
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1);
  return row?.createdAt ?? new Date(0);
};

// Single source of truth for the query window across all four insights readers. Fetches createdAt
// only for all_time (its start bound); every other filter resolves purely from the client input.
const resolveInsightsRange = async (
  data: InsightsFilterInput,
  now: Date,
): Promise<ResolvedRange> => {
  const formCreatedAt =
    data.filter === "all_time" ? await getFormCreatedAt(data.formId) : undefined;
  return resolveTimeRange(
    { filter: data.filter, startDate: data.startDate, endDate: data.endDate, formCreatedAt },
    now,
  );
};

// Prior equal-length window for "vs previous period" deltas. all_time has no prior (the form didn't
// exist), so return no keys → deltas resolve to null.
const priorDaysFor = (data: InsightsFilterInput, range: ResolvedRange): string[] =>
  data.filter === "all_time" ? [] : priorDayKeys(range.days);

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
          and(eq(formAnalyticsDaily.formId, formId), dayKeyRange(formAnalyticsDaily.date, dayKeys)),
        )
    : [];

export const getFormInsightsImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<FormInsightsMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = await resolveInsightsRange(data, now);
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
              dayKeyRange(formAnalyticsDaily.date, split.pastDays),
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
  const priorDays = priorDaysFor(data, range);
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
  const range = await resolveInsightsRange(data, now);
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
              dayKeyRange(formAnalyticsDaily.date, split.pastDays),
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

  const priorDays = priorDaysFor(data, range);
  const priorDailyRows =
    priorDays.length > 0
      ? await db
          .select(dailyVitalsColumns)
          .from(formAnalyticsDaily)
          .where(
            and(
              eq(formAnalyticsDaily.formId, data.formId),
              dayKeyRange(formAnalyticsDaily.date, priorDays),
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
  const range = await resolveInsightsRange(data, now);
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
              dayKeyRange(formDropoffDaily.date, split.pastDays),
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
  const priorDays = priorDaysFor(data, range);
  const priorDropoffDailyRows =
    enabled && priorDays.length > 0
      ? await db
          .select()
          .from(formDropoffDaily)
          .where(
            and(
              eq(formDropoffDaily.formId, data.formId),
              dayKeyRange(formDropoffDaily.date, priorDays),
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
    steps: rollupToSteps(metrics.questions),
  };
};

const ANSWER_SUBMISSION_CAP = 25_000;

export const getFormAnswersImpl = async (
  data: InsightsFilterInput,
  context: { session: { user: { id: string } } },
  orgId: string,
): Promise<FormAnswerMetrics> => {
  await authForm(data.formId, context.session.user.id, orgId);

  const now = new Date();
  const range = await resolveInsightsRange(data, now);

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
