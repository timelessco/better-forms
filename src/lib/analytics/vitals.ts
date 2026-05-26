/**
 * Pure Core Web Vitals helpers — bucketing, histogram merge, interpolated p75,
 * and Google's good/needs-improvement/poor rating thresholds. No DB, no I/O, so
 * the same code runs in the aggregation cron, the read server fn, and tests.
 *
 * Histograms are `Record<bucketLabel, count>`. A bucket label is its lower edge
 * (e.g. "2000"); the top bucket collapses everything at/above the cap into an
 * overflow bucket labelled "<cap>+" (e.g. "6000+").
 */

export type WebVitalName = "lcp" | "inp" | "cls";

export type VitalRating = "good" | "needs-improvement" | "poor";

export type VitalHistogram = Record<string, number>;

interface VitalConfig {
  /** Bucket width in the metric's native unit (ms for lcp/inp, unitless for cls). */
  width: number;
  /** Values at or above this collapse into the overflow bucket. */
  cap: number;
  /** Decimal places the unit needs; drives integer-scaled bucketing for cls. */
  decimals: number;
  /** Upper bound (inclusive) for a "good" rating. */
  good: number;
  /** Upper bound (inclusive) for a "needs-improvement" rating. */
  needsImprovement: number;
}

const VITAL_CONFIG: Record<WebVitalName, VitalConfig> = {
  lcp: { width: 250, cap: 6000, decimals: 0, good: 2500, needsImprovement: 4000 },
  inp: { width: 50, cap: 1000, decimals: 0, good: 200, needsImprovement: 500 },
  cls: { width: 0.025, cap: 1, decimals: 3, good: 0.1, needsImprovement: 0.25 },
};

const OVERFLOW_SUFFIX = "+";

const scaleFor = (decimals: number): number => 10 ** decimals;

/** Format a numeric bucket edge into its label, trimming trailing zeros. */
const formatEdge = (value: number, decimals: number): string => {
  if (decimals === 0) {
    return String(value);
  }
  return value.toFixed(decimals).replace(/\.?0+$/, "");
};

/** Bucket label (lower edge, or "<cap>+" overflow) for a single sample value. */
export const bucketLabel = (metric: WebVitalName, value: number): string => {
  const { width, cap, decimals } = VITAL_CONFIG[metric];
  const scale = scaleFor(decimals);
  const scaledValue = Math.round(value * scale);
  const scaledCap = Math.round(cap * scale);
  if (scaledValue >= scaledCap) {
    return `${formatEdge(cap, decimals)}${OVERFLOW_SUFFIX}`;
  }
  const scaledWidth = Math.round(width * scale);
  const scaledLower = Math.floor(scaledValue / scaledWidth) * scaledWidth;
  return formatEdge(scaledLower / scale, decimals);
};

/** Count a list of raw samples into a histogram. */
export const buildHistogram = (metric: WebVitalName, values: number[]): VitalHistogram => {
  const hist: VitalHistogram = {};
  for (const value of values) {
    const label = bucketLabel(metric, value);
    hist[label] = (hist[label] ?? 0) + 1;
  }
  return hist;
};

/** Sum bucket counts across any number of histograms. */
export const mergeHistograms = (...histograms: VitalHistogram[]): VitalHistogram => {
  const merged: VitalHistogram = {};
  for (const hist of histograms) {
    for (const [label, count] of Object.entries(hist)) {
      merged[label] = (merged[label] ?? 0) + count;
    }
  }
  return merged;
};

/** Total sample count in a histogram. */
export const histogramCount = (hist: VitalHistogram): number => {
  let total = 0;
  for (const count of Object.values(hist)) {
    total += count;
  }
  return total;
};

/** Numeric lower edge for a bucket label ("6000+" overflow resolves to the cap). */
const edgeValue = (metric: WebVitalName, label: string): number => {
  if (label.endsWith(OVERFLOW_SUFFIX)) {
    return VITAL_CONFIG[metric].cap;
  }
  return Number(label);
};

/**
 * 75th-percentile estimate from a histogram, linearly interpolated within the
 * bucket that holds the 0.75·N rank. Returns null for an empty histogram. The
 * overflow bucket returns the cap (no upper edge to interpolate toward).
 */
export const p75FromHistogram = (metric: WebVitalName, hist: VitalHistogram): number | null => {
  const total = histogramCount(hist);
  if (total === 0) {
    return null;
  }
  const target = 0.75 * total;
  const { width } = VITAL_CONFIG[metric];
  const buckets = Object.entries(hist)
    .map(([label, count]) => ({ label, count, lower: edgeValue(metric, label) }))
    .sort((a, b) => a.lower - b.lower);

  let cumulativeBefore = 0;
  for (const bucket of buckets) {
    const cumulativeAfter = cumulativeBefore + bucket.count;
    if (cumulativeAfter >= target) {
      if (bucket.label.endsWith(OVERFLOW_SUFFIX)) {
        return bucket.lower;
      }
      const position = (target - cumulativeBefore) / bucket.count;
      return bucket.lower + position * width;
    }
    cumulativeBefore = cumulativeAfter;
  }
  // Unreachable: target <= total, so some bucket always crosses it.
  return buckets[buckets.length - 1]?.lower ?? null;
};

/** Rate a metric value against Google's CWV thresholds. */
export const rateVital = (metric: WebVitalName, value: number): VitalRating => {
  const { good, needsImprovement } = VITAL_CONFIG[metric];
  if (value <= good) {
    return "good";
  }
  if (value <= needsImprovement) {
    return "needs-improvement";
  }
  return "poor";
};
