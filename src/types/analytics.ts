import type { VitalRating } from "@/lib/analytics/vitals";

export type DeviceType = "desktop" | "tablet" | "mobile";

export type BrowserType = "Chrome" | "Firefox" | "Safari" | "Edge" | "Opera" | "Other";

export type OSType = "Windows" | "macOS" | "iOS" | "Android" | "Linux" | "Other";

export interface FormVisit {
  id: string;
  formId: string;

  visitorHash: string;
  sessionId: string;

  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;

  deviceType: DeviceType | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;

  country: string | null;
  city: string | null;
  region: string | null;

  visitStartedAt: Date;
  visitEndedAt: Date | null;
  durationMs: number | null;

  didStartForm: boolean;
  didSubmit: boolean;
  submissionId: string | null;

  // Core Web Vitals for this session (RUM, nullable — finalize on page-hide).
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface FormQuestionProgress {
  id: string;
  formId: string;
  visitId: string;
  visitorHash: string;

  questionId: string;
  questionType: string | null;
  questionIndex: number;

  viewedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  wasLastQuestion: boolean;

  createdAt: Date;
}

export interface FormAnalyticsDaily {
  id: string;
  formId: string;
  date: string; // 'YYYY-MM-DD'

  totalVisits: number;
  uniqueVisitors: number;
  totalSubmissions: number;
  uniqueSubmitters: number;
  avgDurationMs: number | null;
  medianDurationMs: number | null;

  deviceBreakdown: CountBreakdown;
  browserBreakdown: CountBreakdown;
  osBreakdown: CountBreakdown;
  countryBreakdown: CountBreakdown;
  cityBreakdown: CountBreakdown;
  sourceBreakdown: CountBreakdown;

  // Per-day Core Web Vitals distributions (bucket label -> sample count).
  lcpHistogram: CountBreakdown;
  inpHistogram: CountBreakdown;
  clsHistogram: CountBreakdown;

  createdAt: Date;
  updatedAt: Date;
}

export interface FormDropoffDaily {
  id: string;
  formId: string;
  date: string; // 'YYYY-MM-DD'
  questionId: string;
  questionIndex: number;

  viewCount: number;
  startCount: number;
  completeCount: number;
  dropoffCount: number;
  dropoffRate: number | null; // Percentage * 100
  completionRate: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface CountBreakdown {
  [key: string]: number;
}

export interface FormInsightsMetrics {
  startDate: string;
  endDate: string;

  totalVisits: number;
  uniqueVisitors: number;
  totalSubmissions: number;
  uniqueRespondents: number;
  avgVisitDurationMs: number;

  sources: CountBreakdown;
  devices: CountBreakdown;
  countries: CountBreakdown;
  cities: CountBreakdown;
  browsers: CountBreakdown;
  operatingSystems: CountBreakdown;

  dailyData: {
    date: string;
    visits: number;
    uniqueVisitors: number;
    submissions: number;
  }[];
}

export interface QuestionDropoffRow {
  questionId: string;
  questionIndex: number;
  questionLabel?: string;
  stepId: string | null;
  stepIndex: number | null;
  viewCount: number;
  startCount: number;
  completeCount: number;
  dropoffCount: number;
  terminalDropoffCount: number;
  dropoffRate: number; // 0-100
  completionRate: number; // 0-100
}

export interface QuestionDropoffMetrics {
  formId: string;
  startDate: string;
  endDate: string;

  questions: QuestionDropoffRow[];

  totalStarted: number;
  totalCompleted: number;
  overallCompletionRate: number;
}

/** One bucket in a question's answer distribution (option/value → count). */
export interface AnswerDistributionItem {
  label: string;
  value: number;
}

/** Aggregated answers for one question across submissions. */
export interface QuestionAnswerSummary {
  id: string;
  questionIndex: number;
  label: string;
  fieldType: string;
  /** # submissions that answered this question (non-empty). */
  answered: number;
  /** Option/value → count, sorted desc; choice fields may bucket the tail into "Others". */
  distribution: AnswerDistributionItem[];
}

export interface FormAnswerMetrics {
  startDate: string;
  endDate: string;
  /** Completed submissions in range. */
  submissions: number;
  /** Editable, non-Button fields. */
  totalQuestions: number;
  /** Avg # of questions answered per submission. */
  avgAnswered: number;
  questions: QuestionAnswerSummary[];
}

/** Per-metric Core Web Vitals summary over a time range. */
export interface VitalMetricSummary {
  /** 75th-percentile value (ms for lcp/inp, unitless for cls), null if no samples. */
  p75: number | null;
  rating: VitalRating | null;
  sampleCount: number;
  /** Change vs prior equal-length period (current − prior); negative = improvement for all three. Null if either period lacks samples. */
  deltaVsPrev: number | null;
}

export interface FormVitalsMetrics {
  startDate: string;
  endDate: string;

  lcp: VitalMetricSummary;
  inp: VitalMetricSummary;
  cls: VitalMetricSummary;

  /** Per-day p75 series for the trend chart; missing days resolve to null. */
  series: {
    date: string;
    lcpP75: number | null;
    inpP75: number | null;
    clsP75: number | null;
  }[];
}

export type TimeRangeFilter =
  | "last_24_hours"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "custom";

export interface TimeRange {
  filter: TimeRangeFilter;
  startDate?: string;
  endDate?: string;
}
