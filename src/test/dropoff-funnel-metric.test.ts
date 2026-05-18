import { describe, expect, it } from "vitest";

import { computeDropoffRate, modeForStepCount } from "@/lib/analytics/dropoff-metric";
import type { DropoffMetricRow } from "@/lib/analytics/dropoff-metric";

describe("modeForStepCount", () => {
  it("returns single-page when stepCount is 1", () => {
    expect(modeForStepCount(1)).toBe("single-page");
  });

  it("returns single-page when stepCount is 0", () => {
    expect(modeForStepCount(0)).toBe("single-page");
  });

  it("returns multi-step when stepCount is greater than 1", () => {
    expect(modeForStepCount(2)).toBe("multi-step");
    expect(modeForStepCount(8)).toBe("multi-step");
  });
});

describe("computeDropoffRate", () => {
  const baseRow: DropoffMetricRow = {
    viewCount: 100,
    startCount: 80,
    completeCount: 60,
  };

  describe("multi-step mode", () => {
    it("uses view → complete for Step rows", () => {
      // (100 - 60) / 100 = 40%
      expect(computeDropoffRate(baseRow, "multi-step", "step")).toBe(40);
    });

    it("uses start → complete for Question rows", () => {
      // (80 - 60) / 80 = 25%
      expect(computeDropoffRate(baseRow, "multi-step", "question")).toBe(25);
    });

    it("defaults kind to step when omitted", () => {
      expect(computeDropoffRate(baseRow, "multi-step")).toBe(40);
    });

    it("returns null when view denominator is zero", () => {
      const empty: DropoffMetricRow = { viewCount: 0, startCount: 0, completeCount: 0 };
      expect(computeDropoffRate(empty, "multi-step", "step")).toBeNull();
    });

    it("returns null when start denominator is zero for Question rows", () => {
      const row: DropoffMetricRow = { viewCount: 10, startCount: 0, completeCount: 0 };
      expect(computeDropoffRate(row, "multi-step", "question")).toBeNull();
    });

    it("clamps negative numerator to 0 (completeCount > viewCount edge case)", () => {
      const row: DropoffMetricRow = { viewCount: 10, startCount: 10, completeCount: 12 };
      expect(computeDropoffRate(row, "multi-step", "step")).toBe(0);
    });
  });

  describe("single-page mode", () => {
    it("uses start → complete for Step rows", () => {
      // Single-page funnel: denominator is startCount regardless of row kind.
      // (80 - 60) / 80 = 25%
      expect(computeDropoffRate(baseRow, "single-page", "step")).toBe(25);
    });

    it("uses start → complete for Question rows", () => {
      expect(computeDropoffRate(baseRow, "single-page", "question")).toBe(25);
    });

    it("returns null when startCount is zero", () => {
      const row: DropoffMetricRow = { viewCount: 100, startCount: 0, completeCount: 0 };
      expect(computeDropoffRate(row, "single-page", "step")).toBeNull();
    });
  });

  it("rounds to nearest integer", () => {
    // (100 - 33) / 100 = 67% (66.999... rounded)
    const row: DropoffMetricRow = { viewCount: 100, startCount: 100, completeCount: 33 };
    expect(computeDropoffRate(row, "multi-step", "step")).toBe(67);
  });
});
