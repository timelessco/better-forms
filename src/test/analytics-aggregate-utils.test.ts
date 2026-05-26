import { describe, expect, it } from "vitest";
import type { formQuestionProgress, formVisits } from "@/db/schema";
import { buildDailyAnalyticsRows, buildDailyDropoffRows } from "@/lib/analytics/aggregate-utils";

type RawVisit = typeof formVisits.$inferSelect;
type RawProgress = typeof formQuestionProgress.$inferSelect;

const baseTimestamp = new Date("2026-04-27T12:00:00Z");
const now = new Date("2026-04-28T01:00:00Z");
const dateKey = "2026-04-27";

const makeVisit = (overrides: Partial<RawVisit> & { id: string }): RawVisit => {
  const { id, ...rest } = overrides;
  return {
    id,
    formId: "form-1",
    visitorHash: `hash-${id}`,
    sessionId: `sess-${id}`,
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    deviceType: null,
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
    country: null,
    city: null,
    region: null,
    visitStartedAt: baseTimestamp,
    visitEndedAt: null,
    durationMs: null,
    didStartForm: false,
    didSubmit: false,
    submissionId: null,
    lcpMs: null,
    inpMs: null,
    cls: null,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    ...rest,
  };
};

const makeProgress = (overrides: Partial<RawProgress> & { id: string }): RawProgress => {
  const { id, ...rest } = overrides;
  return {
    id,
    formId: "form-1",
    visitId: `visit-${id}`,
    visitorHash: `hash-${id}`,
    questionId: "q-1",
    questionType: "text",
    questionIndex: 0,
    stepId: null,
    stepIndex: null,
    viewedAt: baseTimestamp,
    startedAt: null,
    completedAt: null,
    wasLastQuestion: false,
    createdAt: baseTimestamp,
    ...rest,
  };
};

describe("buildDailyAnalyticsRows", () => {
  it("returns empty array for empty input", () => {
    expect(buildDailyAnalyticsRows([], dateKey, now)).toStrictEqual([]);
  });

  it("aggregates visits, unique visitors, submissions, unique submitters", () => {
    const visits = [
      makeVisit({ id: "v1", visitorHash: "h1", didSubmit: true }),
      makeVisit({ id: "v2", visitorHash: "h1", didSubmit: false }),
      makeVisit({ id: "v3", visitorHash: "h2", didSubmit: false }),
    ];

    const rows = buildDailyAnalyticsRows(visits, dateKey, now);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      formId: "form-1",
      date: dateKey,
      totalVisits: 3,
      uniqueVisitors: 2,
      totalSubmissions: 1,
      uniqueSubmitters: 1,
    });
  });

  it("creates one row per distinct formId", () => {
    const visits = [
      makeVisit({ id: "v1", formId: "form-a" }),
      makeVisit({ id: "v2", formId: "form-b" }),
      makeVisit({ id: "v3", formId: "form-a" }),
    ];

    const rows = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(rows).toHaveLength(2);
    const totals = Object.fromEntries(rows.map((r) => [r.formId, r.totalVisits]));
    expect(totals).toStrictEqual({ "form-a": 2, "form-b": 1 });
  });

  it("builds device breakdown skipping nulls", () => {
    const visits = [
      makeVisit({ id: "v1", deviceType: "desktop" }),
      makeVisit({ id: "v2", deviceType: "mobile" }),
      makeVisit({ id: "v3", deviceType: "tablet" }),
      makeVisit({ id: "v4", deviceType: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row.deviceBreakdown).toStrictEqual({ desktop: 1, mobile: 1, tablet: 1 });
  });

  it("builds browser breakdown, mapping null/unknown to Other key", () => {
    const visits = [
      makeVisit({ id: "v1", browser: "Chrome" }),
      makeVisit({ id: "v2", browser: "Safari" }),
      makeVisit({ id: "v3", browser: "Opera" }),
      makeVisit({ id: "v4", browser: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row.browserBreakdown).toStrictEqual({ Chrome: 1, Safari: 1, Opera: 1, Other: 1 });
  });

  it("builds os breakdown, mapping null/unknown to Other key", () => {
    const visits = [
      makeVisit({ id: "v1", os: "Windows" }),
      makeVisit({ id: "v2", os: "iOS" }),
      makeVisit({ id: "v3", os: "FreeBSD" }),
      makeVisit({ id: "v4", os: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row.osBreakdown).toStrictEqual({ Windows: 1, iOS: 1, FreeBSD: 1, Other: 1 });
  });

  it("computes average and median durations, ignoring nulls", () => {
    const visits = [
      makeVisit({ id: "v1", durationMs: 1000 }),
      makeVisit({ id: "v2", durationMs: 2000 }),
      makeVisit({ id: "v3", durationMs: null }),
      makeVisit({ id: "v4", durationMs: 3000 }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row).toMatchObject({
      avgDurationMs: 2000,
      medianDurationMs: 2000,
    });
  });

  it("returns null durations when no durationMs values present", () => {
    const visits = [
      makeVisit({ id: "v1", durationMs: null }),
      makeVisit({ id: "v2", durationMs: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row).toMatchObject({
      avgDurationMs: null,
      medianDurationMs: null,
    });
  });

  it("builds country breakdown skipping nulls", () => {
    const visits = [
      makeVisit({ id: "v1", country: "US" }),
      makeVisit({ id: "v2", country: "US" }),
      makeVisit({ id: "v3", country: "IN" }),
      makeVisit({ id: "v4", country: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row.countryBreakdown).toStrictEqual({ US: 2, IN: 1 });
  });

  it("builds source breakdown, falling back to 'direct' for null utmSource", () => {
    const visits = [
      makeVisit({ id: "v1", utmSource: "google" }),
      makeVisit({ id: "v2", utmSource: "google" }),
      makeVisit({ id: "v3", utmSource: null }),
      makeVisit({ id: "v4", utmSource: "twitter" }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    expect(row.sourceBreakdown).toStrictEqual({
      google: 2,
      direct: 1,
      twitter: 1,
    });
  });

  it("builds Core Web Vitals histograms from non-null samples", () => {
    const visits = [
      makeVisit({ id: "v1", lcpMs: 2000, inpMs: 150, cls: 0.04 }),
      makeVisit({ id: "v2", lcpMs: 2100, inpMs: null, cls: null }),
      makeVisit({ id: "v3", lcpMs: null, inpMs: null, cls: null }),
    ];
    const [row] = buildDailyAnalyticsRows(visits, dateKey, now);
    // LCP 2000 & 2100 both floor to the 2000 bucket (width 250).
    expect(row.lcpHistogram).toStrictEqual({ "2000": 2 });
    // INP only v1 (150) is non-null -> bucket 150.
    expect(row.inpHistogram).toStrictEqual({ "150": 1 });
    // CLS only v1 (0.04) is non-null -> bucket 0.025 (0.04/0.025 = 1.6).
    expect(row.clsHistogram).toStrictEqual({ "0.025": 1 });
  });
});

describe("buildDailyDropoffRows", () => {
  it("returns empty array for empty input", () => {
    expect(buildDailyDropoffRows({ rows: [], visits: [], dateKey, now })).toStrictEqual([]);
  });

  it("creates one row per (formId, questionId, questionIndex) group", () => {
    const events = [
      makeProgress({
        id: "p1",
        formId: "form-a",
        questionId: "q1",
        questionIndex: 0,
      }),
      makeProgress({
        id: "p2",
        formId: "form-a",
        questionId: "q1",
        questionIndex: 0,
      }),
      makeProgress({
        id: "p3",
        formId: "form-a",
        questionId: "q2",
        questionIndex: 1,
      }),
      makeProgress({
        id: "p4",
        formId: "form-b",
        questionId: "q1",
        questionIndex: 0,
      }),
      makeProgress({
        id: "p5",
        formId: "form-b",
        questionId: "q2",
        questionIndex: 1,
      }),
    ];

    const rows = buildDailyDropoffRows({
      rows: events,
      visits: [],
      dateKey,
      now,
    });
    expect(rows).toHaveLength(4);
    const lookup = new Map(rows.map((r) => [`${r.formId}:${r.questionId}`, r.viewCount]));
    expect(lookup.get("form-a:q1")).toBe(2);
    expect(lookup.get("form-b:q1")).toBe(1);
  });

  it("counts views, starts, completes, and dropoffs correctly (started-but-not-completed)", () => {
    const events = [
      makeProgress({
        id: "p1",
        startedAt: baseTimestamp,
        completedAt: baseTimestamp,
      }),
      makeProgress({ id: "p2", startedAt: baseTimestamp, completedAt: null }),
      makeProgress({ id: "p3", startedAt: null, completedAt: null }),
      makeProgress({
        id: "p4",
        startedAt: baseTimestamp,
        completedAt: baseTimestamp,
      }),
    ];
    const [row] = buildDailyDropoffRows({
      rows: events,
      visits: [],
      dateKey,
      now,
    });
    // ADR-0002: dropoffCount = started && !completed = just p2 = 1.
    expect(row).toMatchObject({
      viewCount: 4,
      startCount: 3,
      completeCount: 2,
      dropoffCount: 1,
    });
  });

  it("computes dropoffRate at percentage*100 scale (50% -> 5000)", () => {
    // half complete, half drop off (started but not completed)
    const completed: RawProgress[] = Array.from({ length: 50 }, (_, i) =>
      makeProgress({
        id: `c${i}`,
        completedAt: baseTimestamp,
        startedAt: baseTimestamp,
      }),
    );
    const dropped: RawProgress[] = Array.from({ length: 50 }, (_, i) =>
      makeProgress({
        id: `d${i}`,
        completedAt: null,
        startedAt: baseTimestamp,
      }),
    );
    const events = [...completed, ...dropped];
    const [row] = buildDailyDropoffRows({
      rows: events,
      visits: [],
      dateKey,
      now,
    });
    expect(row).toMatchObject({
      viewCount: 100,
      completeCount: 50,
      dropoffCount: 50,
      dropoffRate: 5000,
      completionRate: 5000,
    });
  });

  it("preserves date and formId/questionId/questionIndex on output", () => {
    const events = [
      makeProgress({
        id: "p1",
        formId: "form-x",
        questionId: "q-42",
        questionIndex: 7,
      }),
    ];
    const [row] = buildDailyDropoffRows({
      rows: events,
      visits: [],
      dateKey,
      now,
    });
    expect(row).toMatchObject({
      date: dateKey,
      formId: "form-x",
      questionId: "q-42",
      questionIndex: 7,
    });
  });
});
