import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import type {
  InsightsAvailability,
  RecordQuestionProgressBatchInput,
} from "@/lib/server-fn/analytics.server";
import type {
  FormInsightsMetrics,
  FormVitalsMetrics,
  QuestionDropoffMetrics,
} from "@/types/analytics";

// DB logic lives in analytics.server.ts, dynamically imported in each handler so Start strips it
// from the client bundle — @/db + postgres driver never reach the browser via this file.

const recordVisitInputSchema = z.object({
  formId: z.uuid(),
  visitorHash: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  referrer: z.string().nullish(),
  utmSource: z.string().nullish(),
  utmMedium: z.string().nullish(),
  utmCampaign: z.string().nullish(),
});

export const recordFormVisit = createServerFn({ method: "POST" })
  .inputValidator(recordVisitInputSchema)
  .handler(async ({ data }): Promise<{ visitId: string | null }> => {
    const { recordFormVisitImpl } = await import("./analytics.server");
    return recordFormVisitImpl(data);
  });

const MAX_DURATION_MS = 86_400_000; // 24h cap as a spam guard for client-supplied values

const MAX_VITAL_MS = 3_600_000; // 1h — generous spam guard for client-reported vitals
const MAX_CLS = 100;

const updateVisitInputSchema = z.object({
  visitId: z.uuid(),
  didStartForm: z.boolean().optional(),
  didSubmit: z.boolean().optional(),
  submissionId: z.uuid().nullish(),
  visitEndedAt: z.iso.datetime().nullish(),
  durationMs: z.number().int().nonnegative().max(MAX_DURATION_MS).nullish(),
  lcpMs: z.number().int().nonnegative().max(MAX_VITAL_MS).nullish(),
  inpMs: z.number().int().nonnegative().max(MAX_VITAL_MS).nullish(),
  cls: z.number().nonnegative().max(MAX_CLS).nullish(),
});

export const updateFormVisit = createServerFn({ method: "POST" })
  .inputValidator(updateVisitInputSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { updateFormVisitImpl } = await import("./analytics.server");
    return updateFormVisitImpl(data);
  });

const questionProgressInputSchema = z.object({
  visitId: z.uuid(),
  formId: z.uuid(),
  visitorHash: z.string().min(1).max(128),
  questionId: z.string().min(1).max(256),
  questionType: z.string().max(64).nullish(),
  questionIndex: z.number().int().nonnegative(),
  stepId: z.string().max(256).nullish(),
  stepIndex: z.number().int().nonnegative().nullish(),
  event: z.enum(["view", "start", "complete"]),
  wasLastQuestion: z.boolean().optional(),
});

export const recordQuestionProgress = createServerFn({ method: "POST" })
  .inputValidator(questionProgressInputSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { recordQuestionProgressImpl } = await import("./analytics.server");
    return recordQuestionProgressImpl(data);
  });

const MAX_QUESTION_PROGRESS_BATCH = 20;

const questionProgressBatchInputSchema = z.object({
  items: z.array(questionProgressInputSchema).min(1).max(MAX_QUESTION_PROGRESS_BATCH),
});

export const recordQuestionProgressBatch = createServerFn({ method: "POST" })
  .inputValidator(questionProgressBatchInputSchema)
  .handler(
    async ({
      data,
    }: {
      data: RecordQuestionProgressBatchInput;
    }): Promise<{
      ok: true;
      processed: number;
    }> => {
      const { recordQuestionProgressBatchImpl } = await import("./analytics.server");
      return recordQuestionProgressBatchImpl(data);
    },
  );

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const insightsFilterInputSchema = z.object({
  formId: z.uuid(),
  filter: z.enum(["last_24_hours", "last_7_days", "last_30_days", "last_90_days", "custom"]),
  startDate: z.string().regex(DATE_KEY_PATTERN).optional(),
  endDate: z.string().regex(DATE_KEY_PATTERN).optional(),
});

export const getFormInsights = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(insightsFilterInputSchema)
  .handler(async ({ data, context }): Promise<FormInsightsMetrics> => {
    const { getFormInsightsImpl } = await import("./analytics.server");
    return getFormInsightsImpl(data, context, getActiveOrgId(context.session));
  });

export const getFormDropoff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(insightsFilterInputSchema)
  .handler(async ({ data, context }): Promise<QuestionDropoffMetrics> => {
    const { getFormDropoffImpl } = await import("./analytics.server");
    return getFormDropoffImpl(data, context, getActiveOrgId(context.session));
  });

export const getFormVitals = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(insightsFilterInputSchema)
  .handler(async ({ data, context }): Promise<FormVitalsMetrics> => {
    const { getFormVitalsImpl } = await import("./analytics.server");
    return getFormVitalsImpl(data, context, getActiveOrgId(context.session));
  });

export const getInsightsAvailability = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }): Promise<InsightsAvailability> => {
    const { getInsightsAvailabilityImpl } = await import("./analytics.server");
    return getInsightsAvailabilityImpl(data, context, getActiveOrgId(context.session));
  });

const aggregateInputSchema = z.object({
  date: z.string().regex(DATE_KEY_PATTERN),
});

export const aggregateAnalyticsDaily = createServerFn({ method: "POST" })
  .inputValidator(aggregateInputSchema)
  .handler(async ({ data }) => {
    const { aggregateAnalyticsDailyImpl } = await import("./analytics.server");
    return aggregateAnalyticsDailyImpl(data);
  });
