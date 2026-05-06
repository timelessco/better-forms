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

export interface QuestionDropoffMetrics {
  formId: string;
  startDate: string;
  endDate: string;

  questions: {
    questionId: string;
    questionIndex: number;
    questionLabel?: string;
    viewCount: number;
    startCount: number;
    completeCount: number;
    dropoffCount: number;
    dropoffRate: number; // 0-100
    completionRate: number; // 0-100
  }[];

  totalStarted: number;
  totalCompleted: number;
  overallCompletionRate: number;
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
