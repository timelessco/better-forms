import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { authMiddleware } from "@/lib/auth/middleware";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import {
  aggregateAnalyticsDailyImpl,
  getFormAnswersImpl,
  getFormDropoffImpl,
  getFormInsightsImpl,
  getFormVitalsImpl,
  getInsightsAvailabilityImpl,
  recordFormVisitImpl,
  recordQuestionProgressBatchImpl,
  recordQuestionProgressImpl,
  updateFormVisitImpl,
} from "@/lib/server-fn/analytics.server";
import type {
  InsightsAvailability,
  RecordQuestionProgressBatchInput,
} from "@/lib/server-fn/analytics.server";
import type {
  FormAnswerMetrics,
  FormInsightsMetrics,
  FormVitalsMetrics,
  QuestionDropoffMetrics,
} from "@/types/analytics";

// DB logic lives in analytics.server.ts (server-only via the .server suffix). Imported
// statically here but used only inside handlers, so Start prunes it from the client bundle —
// @/db + postgres driver never reach the browser via this file.

const recordVisitInputSchema = v.object({
  formId: v.pipe(v.string(), v.uuid()),
  visitorHash: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  sessionId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  referrer: v.nullish(v.string()),
  utmSource: v.nullish(v.string()),
  utmMedium: v.nullish(v.string()),
  utmCampaign: v.nullish(v.string()),
});

export const recordFormVisit = createServerFn({ method: "POST" })
  .validator(recordVisitInputSchema)
  .handler(async ({ data }): Promise<{ visitId: string | null }> => recordFormVisitImpl(data));

const MAX_VITAL_MS = 3_600_000; // 1h — generous spam guard for client-reported vitals
const MAX_CLS = 100;

const updateVisitInputSchema = v.object({
  visitId: v.pipe(v.string(), v.uuid()),
  didStartForm: v.optional(v.boolean()),
  didSubmit: v.optional(v.boolean()),
  submissionId: v.nullish(v.pipe(v.string(), v.uuid())),
  visitEndedAt: v.nullish(v.pipe(v.string(), v.isoTimestamp())),
  lcpMs: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_VITAL_MS))),
  inpMs: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_VITAL_MS))),
  cls: v.nullish(v.pipe(v.number(), v.minValue(0), v.maxValue(MAX_CLS))),
});

export const updateFormVisit = createServerFn({ method: "POST" })
  .validator(updateVisitInputSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => updateFormVisitImpl(data));

const questionProgressInputSchema = v.object({
  visitId: v.pipe(v.string(), v.uuid()),
  formId: v.pipe(v.string(), v.uuid()),
  visitorHash: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  questionId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  questionType: v.nullish(v.pipe(v.string(), v.maxLength(64))),
  questionIndex: v.pipe(v.number(), v.integer(), v.minValue(0)),
  stepId: v.nullish(v.pipe(v.string(), v.maxLength(256))),
  stepIndex: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(0))),
  event: v.picklist(["view", "start", "complete"]),
  wasLastQuestion: v.optional(v.boolean()),
});

export const recordQuestionProgress = createServerFn({ method: "POST" })
  .validator(questionProgressInputSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => recordQuestionProgressImpl(data));

const MAX_QUESTION_PROGRESS_BATCH = 20;

const questionProgressBatchInputSchema = v.object({
  items: v.pipe(
    v.array(questionProgressInputSchema),
    v.minLength(1),
    v.maxLength(MAX_QUESTION_PROGRESS_BATCH),
  ),
});

export const recordQuestionProgressBatch = createServerFn({ method: "POST" })
  .validator(questionProgressBatchInputSchema)
  .handler(
    async ({
      data,
    }: {
      data: RecordQuestionProgressBatchInput;
    }): Promise<{
      ok: true;
      processed: number;
    }> => recordQuestionProgressBatchImpl(data),
  );

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const insightsFilterInputSchema = v.object({
  formId: v.pipe(v.string(), v.uuid()),
  filter: v.picklist([
    "today",
    "yesterday",
    "last_24_hours",
    "last_7_days",
    "last_30_days",
    "last_90_days",
    "last_year",
    "all_time",
    "custom",
  ]),
  startDate: v.optional(v.pipe(v.string(), v.regex(DATE_KEY_PATTERN))),
  endDate: v.optional(v.pipe(v.string(), v.regex(DATE_KEY_PATTERN))),
});

export const getFormInsights = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(insightsFilterInputSchema)
  .handler(
    async ({ data, context }): Promise<FormInsightsMetrics> =>
      getFormInsightsImpl(data, context, getActiveOrgId(context.session)),
  );

export const getFormDropoff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(insightsFilterInputSchema)
  .handler(
    async ({ data, context }): Promise<QuestionDropoffMetrics> =>
      getFormDropoffImpl(data, context, getActiveOrgId(context.session)),
  );

export const getFormAnswers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(insightsFilterInputSchema)
  .handler(
    async ({ data, context }): Promise<FormAnswerMetrics> =>
      getFormAnswersImpl(data, context, getActiveOrgId(context.session)),
  );

export const getFormVitals = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(insightsFilterInputSchema)
  .handler(
    async ({ data, context }): Promise<FormVitalsMetrics> =>
      getFormVitalsImpl(data, context, getActiveOrgId(context.session)),
  );

export const getInsightsAvailability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(v.object({ formId: v.pipe(v.string(), v.uuid()) }))
  .handler(
    async ({ data, context }): Promise<InsightsAvailability> =>
      getInsightsAvailabilityImpl(data, context, getActiveOrgId(context.session)),
  );

const aggregateInputSchema = v.object({
  date: v.pipe(v.string(), v.regex(DATE_KEY_PATTERN)),
});

export const aggregateAnalyticsDaily = createServerFn({ method: "POST" })
  .validator(aggregateInputSchema)
  .handler(async ({ data }) => aggregateAnalyticsDailyImpl(data));
