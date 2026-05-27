import { describe, expect, it } from "vitest";
import {
  bucketLabel,
  buildHistogram,
  histogramCount,
  mergeHistograms,
  p75FromHistogram,
  rateVital,
} from "@/lib/analytics/vitals";

describe("bucketLabel", () => {
  it("floors a value to its bucket lower edge", () => {
    expect(bucketLabel("lcp", 2000)).toBe("2000");
    expect(bucketLabel("lcp", 2100)).toBe("2000"); // width 250 -> floor(2100/250)*250
    expect(bucketLabel("inp", 50)).toBe("50"); // width 50
    expect(bucketLabel("inp", 175)).toBe("150");
  });

  it("labels the zero bucket as '0'", () => {
    expect(bucketLabel("lcp", 0)).toBe("0");
    expect(bucketLabel("cls", 0)).toBe("0");
  });

  it("buckets CLS without float drift", () => {
    expect(bucketLabel("cls", 0.04)).toBe("0.025"); // width 0.025
    expect(bucketLabel("cls", 0.1)).toBe("0.1");
  });

  it("collapses values at or above the cap into an overflow bucket", () => {
    expect(bucketLabel("lcp", 6000)).toBe("6000+");
    expect(bucketLabel("lcp", 9999)).toBe("6000+");
    expect(bucketLabel("inp", 1000)).toBe("1000+");
    expect(bucketLabel("cls", 1)).toBe("1+");
  });
});

describe("buildHistogram", () => {
  it("counts samples into their buckets", () => {
    expect(buildHistogram("inp", [50, 150, 250, 50])).toEqual({
      "50": 2,
      "150": 1,
      "250": 1,
    });
  });

  it("returns an empty histogram for no samples", () => {
    expect(buildHistogram("lcp", [])).toEqual({});
  });
});

describe("mergeHistograms", () => {
  it("sums bucket counts across histograms", () => {
    expect(mergeHistograms({ "2000": 3 }, { "2000": 5, "3000": 2 })).toEqual({
      "2000": 8,
      "3000": 2,
    });
  });

  it("returns an empty histogram when merging nothing", () => {
    expect(mergeHistograms()).toEqual({});
  });
});

describe("histogramCount", () => {
  it("sums all bucket counts", () => {
    expect(histogramCount({ "2000": 8, "3000": 2 })).toBe(10);
    expect(histogramCount({})).toBe(0);
  });
});

describe("p75FromHistogram", () => {
  it("returns null for an empty histogram", () => {
    expect(p75FromHistogram("lcp", {})).toBeNull();
  });

  it("interpolates within a single bucket", () => {
    // 8 samples in [2000,2250); r=6, pos=0.75 -> 2000 + 0.75*250 = 2187.5.
    expect(p75FromHistogram("lcp", { "2000": 8 })).toBeCloseTo(2187.5, 1);
  });

  it("finds the bucket holding the 75th percentile across buckets", () => {
    // 100 samples, 25 per bucket; r = 75 lands at the top of the [500,750) bucket.
    const hist = { "0": 25, "250": 25, "500": 25, "750": 25 };
    expect(p75FromHistogram("lcp", hist)).toBeCloseTo(750, 1);
  });

  it("agrees with a merged histogram", () => {
    const merged = mergeHistograms({ "0": 25, "250": 25 }, { "500": 25, "750": 25 });
    expect(p75FromHistogram("lcp", merged)).toBeCloseTo(750, 1);
  });
});

describe("rateVital", () => {
  it("rates LCP by the 2500ms / 4000ms thresholds", () => {
    expect(rateVital("lcp", 2500)).toBe("good");
    expect(rateVital("lcp", 2501)).toBe("needs-improvement");
    expect(rateVital("lcp", 4000)).toBe("needs-improvement");
    expect(rateVital("lcp", 4001)).toBe("poor");
  });

  it("rates INP by the 200ms / 500ms thresholds", () => {
    expect(rateVital("inp", 200)).toBe("good");
    expect(rateVital("inp", 201)).toBe("needs-improvement");
    expect(rateVital("inp", 501)).toBe("poor");
  });

  it("rates CLS by the 0.1 / 0.25 thresholds", () => {
    expect(rateVital("cls", 0.1)).toBe("good");
    expect(rateVital("cls", 0.2)).toBe("needs-improvement");
    expect(rateVital("cls", 0.26)).toBe("poor");
  });
});
