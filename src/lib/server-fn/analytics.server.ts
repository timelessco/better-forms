// Barrel: analytics server logic is split along three seams so the pure answer-analysis can be
// unit-tested and the ingestion / read paths navigate separately. Kept here so existing callers
// (analytics.ts, track routes, tests) import from one path.
//  - ingestion (anonymous recorders + rate-limit/published guards) → analytics-ingestion.server.ts
//  - insights readers (insights/vitals/dropoff/answers/availability + nightly rollup) → analytics-insights.server.ts
//  - pure answer-distribution analysis (no db) → lib/analytics/answer-analysis.ts
export {
  checkAnalyticsRateLimit,
  recordFormVisitImpl,
  recordQuestionProgressBatchImpl,
  recordQuestionProgressImpl,
  updateFormVisitImpl,
} from "@/lib/server-fn/analytics-ingestion.server";
export type {
  RecordFormVisitInput,
  RecordQuestionProgressBatchInput,
  RecordQuestionProgressInput,
  UpdateFormVisitInput,
} from "@/lib/server-fn/analytics-ingestion.server";
export {
  aggregateAnalyticsDailyImpl,
  getAnalyticsState,
  getFormAnswersImpl,
  getFormDropoffImpl,
  getFormInsightsImpl,
  getFormVitalsImpl,
  getInsightsAvailabilityImpl,
  isAnalyticsEnabled,
} from "@/lib/server-fn/analytics-insights.server";
export type {
  AggregateResult,
  InsightsAvailability,
  InsightsFilterInput,
} from "@/lib/server-fn/analytics-insights.server";
