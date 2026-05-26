import { describe, expect, it } from "vitest";
import { buildVitalsMetrics } from "@/lib/analytics/merge-vitals";

const emptyDay = (date: string) => ({
  date,
  lcpHistogram: {},
  inpHistogram: {},
  clsHistogram: {},
});

describe("buildVitalsMetrics", () => {
  it("returns null summaries and a null series for no data", () => {
    const result = buildVitalsMetrics({
      dailyRows: [],
      todayRawRows: [],
      priorDailyRows: [],
      days: ["2026-04-24", "2026-04-25"],
      todayKey: null,
      startDate: "2026-04-24",
      endDate: "2026-04-25",
    });

    expect(result.lcp).toEqual({ p75: null, rating: null, sampleCount: 0, deltaVsPrev: null });
    expect(result.series).toEqual([
      { date: "2026-04-24", lcpP75: null, inpP75: null, clsP75: null },
      { date: "2026-04-25", lcpP75: null, inpP75: null, clsP75: null },
    ]);
  });

  it("merges past-day histograms into the LCP summary with a prior delta", () => {
    const result = buildVitalsMetrics({
      dailyRows: [
        { ...emptyDay("2026-04-24"), lcpHistogram: { "2000": 4 } },
        { ...emptyDay("2026-04-25"), lcpHistogram: { "2000": 4 } },
      ],
      todayRawRows: [],
      priorDailyRows: [{ ...emptyDay("2026-04-23"), lcpHistogram: { "3000": 8 } }],
      days: ["2026-04-24", "2026-04-25"],
      todayKey: null,
      startDate: "2026-04-24",
      endDate: "2026-04-25",
    });

    expect(result.lcp.sampleCount).toBe(8);
    expect(result.lcp.p75).toBeCloseTo(2187.5, 1);
    expect(result.lcp.rating).toBe("good");
    // prior p75 (hist {3000:8}) = 3187.5 -> delta = 2187.5 - 3187.5
    expect(result.lcp.deltaVsPrev).toBeCloseTo(-1000, 1);
    expect(result.series[0]).toEqual({
      date: "2026-04-24",
      lcpP75: expect.closeTo(2187.5, 1),
      inpP75: null,
      clsP75: null,
    });
  });

  it("buckets today's raw samples into the summary and today's series entry", () => {
    const result = buildVitalsMetrics({
      dailyRows: [],
      todayRawRows: [
        { lcpMs: 2000, inpMs: 150, cls: 0.05 },
        { lcpMs: 2100, inpMs: null, cls: null },
      ],
      priorDailyRows: [],
      days: ["2026-04-26"],
      todayKey: "2026-04-26",
      startDate: "2026-04-26",
      endDate: "2026-04-26",
    });

    // LCP: [2000,2100] both in the 2000 bucket -> 2 samples -> p75 2187.5
    expect(result.lcp.sampleCount).toBe(2);
    expect(result.lcp.p75).toBeCloseTo(2187.5, 1);
    // INP: only one non-null sample (150) -> bucket 150 -> 187.5
    expect(result.inp.sampleCount).toBe(1);
    expect(result.inp.p75).toBeCloseTo(187.5, 1);
    // CLS: one sample 0.05 -> bucket 0.05 (0.05/0.025 = 2) -> 0.05 + 0.75*0.025 = 0.06875
    expect(result.cls.sampleCount).toBe(1);
    expect(result.cls.p75).toBeCloseTo(0.06875, 4);

    expect(result.series).toEqual([
      {
        date: "2026-04-26",
        lcpP75: expect.closeTo(2187.5, 1),
        inpP75: expect.closeTo(187.5, 1),
        clsP75: expect.closeTo(0.06875, 4),
      },
    ]);
  });
});
