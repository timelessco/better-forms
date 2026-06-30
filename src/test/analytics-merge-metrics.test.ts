import { describe, expect, it } from "vitest";
import type { formAnalyticsDaily, formVisits } from "@/db/schema";
import { mergeInsightsMetrics } from "@/lib/analytics/merge-metrics";

type DailyRow = typeof formAnalyticsDaily.$inferSelect;
type RawVisitRow = typeof formVisits.$inferSelect;

const baseTimestamp = new Date("2026-04-27T00:00:00Z");

const makeDaily = (overrides: Partial<DailyRow> & { date: string }): DailyRow => {
  const { date, ...rest } = overrides;
  return {
    id: `daily-${date}`,
    formId: "form-1",
    date,
    totalVisits: 0,
    uniqueVisitors: 0,
    totalSubmissions: 0,
    uniqueSubmitters: 0,
    avgDurationMs: null,
    // Duration is now median-based; mirror any avgDurationMs an override passes so existing fixtures
    // (which only set avgDurationMs) still drive the weighted-median assertions.
    medianDurationMs: overrides.avgDurationMs ?? null,
    deviceBreakdown: {},
    browserBreakdown: {},
    osBreakdown: {},
    countryBreakdown: {},
    cityBreakdown: {},
    sourceBreakdown: {},
    lcpHistogram: {},
    inpHistogram: {},
    clsHistogram: {},
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
    ...rest,
  };
};

const makeRaw = (overrides: Partial<RawVisitRow> & { id: string }): RawVisitRow => {
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

describe("mergeInsightsMetrics", () => {
  it("aggregates only past daily rows when there is no today data", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-24",
        totalVisits: 10,
        uniqueVisitors: 7,
        totalSubmissions: 2,
        uniqueSubmitters: 2,
        avgDurationMs: 1000,
        deviceBreakdown: { desktop: 6, mobile: 4 },
      }),
      makeDaily({
        date: "2026-04-25",
        totalVisits: 5,
        uniqueVisitors: 5,
        totalSubmissions: 1,
        uniqueSubmitters: 1,
        avgDurationMs: 2000,
        browserBreakdown: { Chrome: 5 },
      }),
      makeDaily({
        date: "2026-04-26",
        totalVisits: 3,
        uniqueVisitors: 3,
        totalSubmissions: 0,
        uniqueSubmitters: 0,
        avgDurationMs: null,
      }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows,
      todayRawRows: [],
      startDate: "2026-04-24",
      endDate: "2026-04-26",
      days: ["2026-04-24", "2026-04-25", "2026-04-26"],
      todayKey: null,
    });

    // Weighted avg: (1000*10 + 2000*5) / 15 = 20000 / 15 = 1333
    expect(result).toMatchObject({
      totalVisits: 18,
      uniqueVisitors: 15,
      totalSubmissions: 3,
      uniqueRespondents: 3,
      avgVisitDurationMs: 1333,
      devices: { desktop: 6, mobile: 4 },
      browsers: { Chrome: 5 },
      dailyData: [
        { date: "2026-04-24", visits: 10, uniqueVisitors: 7, submissions: 2 },
        { date: "2026-04-25", visits: 5, uniqueVisitors: 5, submissions: 1 },
        { date: "2026-04-26", visits: 3, uniqueVisitors: 3, submissions: 0 },
      ],
    });
  });

  it("aggregates only today raw rows when there is no past data", () => {
    const todayRawRows = [
      makeRaw({ id: "1", visitorHash: "v1", didSubmit: true, durationMs: 1000 }),
      makeRaw({ id: "2", visitorHash: "v1", didSubmit: false, durationMs: 500 }),
      makeRaw({ id: "3", visitorHash: "v2", didSubmit: true, durationMs: 1500 }),
      makeRaw({ id: "4", visitorHash: "v3", didSubmit: false }),
      makeRaw({ id: "5", visitorHash: "v3", didSubmit: false }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows: [],
      todayRawRows,
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      days: ["2026-04-27"],
      todayKey: "2026-04-27",
    });

    // Average of [1000, 500, 1500] = 1000
    expect(result).toMatchObject({
      totalVisits: 5,
      uniqueVisitors: 3,
      totalSubmissions: 2,
      uniqueRespondents: 2,
      avgVisitDurationMs: 1000,
      dailyData: [{ date: "2026-04-27", visits: 5, uniqueVisitors: 3, submissions: 2 }],
    });
  });

  it("merges past daily and today raw rows into the right totals and dailyData order", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-25",
        totalVisits: 4,
        uniqueVisitors: 3,
        totalSubmissions: 1,
        uniqueSubmitters: 1,
        avgDurationMs: 2000,
        countryBreakdown: { US: 3, IN: 1 },
        sourceBreakdown: { google: 2 },
      }),
      makeDaily({
        date: "2026-04-26",
        totalVisits: 2,
        uniqueVisitors: 2,
        totalSubmissions: 0,
        uniqueSubmitters: 0,
        avgDurationMs: 1000,
        countryBreakdown: { US: 2 },
      }),
    ];
    const todayRawRows = [
      makeRaw({ id: "r1", visitorHash: "v1", country: "US", utmSource: "twitter" }),
      makeRaw({ id: "r2", visitorHash: "v2", country: "IN", didSubmit: true }),
      makeRaw({ id: "r3", visitorHash: "v2", country: "IN" }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows,
      todayRawRows,
      startDate: "2026-04-25",
      endDate: "2026-04-27",
      days: ["2026-04-25", "2026-04-26", "2026-04-27"],
      todayKey: "2026-04-27",
    });

    // dailyAgg uniqueVisitors: 3+2 = 5; rawAgg: 2 unique hashes → 7 total
    expect(result).toMatchObject({
      totalVisits: 9,
      uniqueVisitors: 7,
      totalSubmissions: 2,
      uniqueRespondents: 2,
      countries: { US: 6, IN: 3 },
      sources: { google: 2, twitter: 1 },
      dailyData: [
        { date: "2026-04-25", visits: 4, uniqueVisitors: 3, submissions: 1 },
        { date: "2026-04-26", visits: 2, uniqueVisitors: 2, submissions: 0 },
        { date: "2026-04-27", visits: 3, uniqueVisitors: 2, submissions: 1 },
      ],
    });
  });

  it("returns zeroed metrics with one dailyData entry per day when there are no rows", () => {
    const result = mergeInsightsMetrics({
      dailyRows: [],
      todayRawRows: [],
      startDate: "2026-04-25",
      endDate: "2026-04-27",
      days: ["2026-04-25", "2026-04-26", "2026-04-27"],
      todayKey: "2026-04-27",
    });

    expect(result).toStrictEqual({
      startDate: "2026-04-25",
      endDate: "2026-04-27",
      totalVisits: 0,
      uniqueVisitors: 0,
      totalSubmissions: 0,
      // Proxy defaults; the real values are filled in by getFormInsightsImpl (a second query), not merge.
      completedSubmissions: 0,
      uniqueRespondents: 0,
      avgVisitDurationMs: 0,
      visitsDeltaPct: null,
      submissionsDeltaPct: null,
      completionRateDeltaPts: null,
      avgDurationDeltaMs: null,
      sources: {},
      devices: {},
      countries: {},
      cities: {},
      browsers: {},
      operatingSystems: {},
      dailyData: [
        { date: "2026-04-25", visits: 0, uniqueVisitors: 0, submissions: 0 },
        { date: "2026-04-26", visits: 0, uniqueVisitors: 0, submissions: 0 },
        { date: "2026-04-27", visits: 0, uniqueVisitors: 0, submissions: 0 },
      ],
    });
  });

  it("attributes submissions from raw rows to totals and unique respondents", () => {
    const todayRawRows = [
      makeRaw({ id: "r1", visitorHash: "v1", didSubmit: true }),
      makeRaw({ id: "r2", visitorHash: "v1", didSubmit: true }),
      makeRaw({ id: "r3", visitorHash: "v2", didSubmit: false }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows: [],
      todayRawRows,
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      days: ["2026-04-27"],
      todayKey: "2026-04-27",
    });

    expect(result.totalSubmissions).toBe(2);
    expect(result.uniqueRespondents).toBe(1);
  });

  it("buckets known browsers/OS by name and unknowns into Other", () => {
    const todayRawRows = [
      makeRaw({ id: "r1", browser: "Chrome", os: "Windows" }),
      makeRaw({ id: "r2", browser: "Firefox", os: "macOS" }),
      makeRaw({ id: "r3", browser: "UnknownBrowser", os: "BeOS" }),
      makeRaw({ id: "r4", browser: null, os: null }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows: [],
      todayRawRows,
      startDate: "2026-04-27",
      endDate: "2026-04-27",
      days: ["2026-04-27"],
      todayKey: "2026-04-27",
    });

    expect(result).toMatchObject({
      browsers: { Chrome: 1, Firefox: 1, Other: 2 },
      operatingSystems: { Windows: 1, macOS: 1, Other: 2 },
    });
  });

  it("merges country breakdowns additively across daily JSONB and raw rows", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        totalVisits: 8,
        countryBreakdown: { US: 5, IN: 3 },
      }),
    ];
    const todayRawRows = [
      makeRaw({ id: "r1", country: "US" }),
      makeRaw({ id: "r2", country: "DE" }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows,
      todayRawRows,
      startDate: "2026-04-26",
      endDate: "2026-04-27",
      days: ["2026-04-26", "2026-04-27"],
      todayKey: "2026-04-27",
    });

    expect(result.countries).toStrictEqual({ US: 6, IN: 3, DE: 1 });
  });

  it("computes avgVisitDurationMs as a weighted average across daily + raw", () => {
    const dailyRows = [
      makeDaily({
        date: "2026-04-26",
        totalVisits: 10,
        avgDurationMs: 1000, // weight 10
      }),
    ];
    const todayRawRows = [
      makeRaw({ id: "r1", durationMs: 5000 }),
      makeRaw({ id: "r2", durationMs: 5000 }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows,
      todayRawRows,
      startDate: "2026-04-26",
      endDate: "2026-04-27",
      days: ["2026-04-26", "2026-04-27"],
      todayKey: "2026-04-27",
    });

    // (1000*10 + 5000 + 5000) / (10 + 2) = 20000 / 12 = 1666.67 → 1667
    expect(result.avgVisitDurationMs).toBe(1667);
  });

  it("preserves dailyData ordering matching the input days array", () => {
    const dailyRows = [
      makeDaily({ date: "2026-04-26", totalVisits: 2 }),
      makeDaily({ date: "2026-04-24", totalVisits: 4 }),
    ];

    const result = mergeInsightsMetrics({
      dailyRows,
      todayRawRows: [],
      startDate: "2026-04-24",
      endDate: "2026-04-26",
      days: ["2026-04-24", "2026-04-25", "2026-04-26"],
      todayKey: null,
    });

    expect(result.dailyData).toStrictEqual([
      { date: "2026-04-24", visits: 4, uniqueVisitors: 0, submissions: 0 },
      { date: "2026-04-25", visits: 0, uniqueVisitors: 0, submissions: 0 },
      { date: "2026-04-26", visits: 2, uniqueVisitors: 0, submissions: 0 },
    ]);
  });
});
