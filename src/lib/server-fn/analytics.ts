import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import type { FormInsightsMetrics, QuestionDropoffMetrics } from "@/types/analytics";

// All DB-touching logic lives in `analytics.server.ts`. Each handler below
// dynamically imports it inside the handler body, which TanStack Start
// strips from the client bundle — so `@/db` (and the postgres driver) never
// reach the browser via the route tree's reference to this file.

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

const updateVisitInputSchema = z.object({
  visitId: z.uuid(),
  didStartForm: z.boolean().optional(),
  didSubmit: z.boolean().optional(),
  submissionId: z.uuid().nullish(),
  visitEndedAt: z.iso.datetime().nullish(),
  durationMs: z.number().int().nonnegative().max(MAX_DURATION_MS).nullish(),
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
  event: z.enum(["view", "start", "complete"]),
  wasLastQuestion: z.boolean().optional(),
});

export const recordQuestionProgress = createServerFn({ method: "POST" })
  .inputValidator(questionProgressInputSchema)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { recordQuestionProgressImpl } = await import("./analytics.server");
    return recordQuestionProgressImpl(data);
  });

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

const aggregateInputSchema = z.object({
  date: z.string().regex(DATE_KEY_PATTERN),
});

export const aggregateAnalyticsDaily = createServerFn({ method: "POST" })
  .inputValidator(aggregateInputSchema)
  .handler(async ({ data }) => {
    const { aggregateAnalyticsDailyImpl } = await import("./analytics.server");
    return aggregateAnalyticsDailyImpl(data);
  });
