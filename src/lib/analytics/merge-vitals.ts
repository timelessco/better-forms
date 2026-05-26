import type { FormVitalsMetrics, VitalMetricSummary } from "@/types/analytics";
import {
  buildHistogram,
  histogramCount,
  mergeHistograms,
  p75FromHistogram,
  rateVital,
} from "./vitals";
import type { VitalHistogram, WebVitalName } from "./vitals";

/** The three histogram columns this read-model needs off a daily row. */
export interface VitalsDailyRow {
  date: string;
  lcpHistogram: VitalHistogram;
  inpHistogram: VitalHistogram;
  clsHistogram: VitalHistogram;
}

/** The three per-session vitals samples this read-model needs off a raw visit. */
export interface VitalsRawRow {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

interface BuildVitalsArgs {
  /** Past, fully-aggregated days inside the range. */
  dailyRows: VitalsDailyRow[];
  /** Raw visits for the open (today) portion of the range. */
  todayRawRows: VitalsRawRow[];
  /** Aggregated days of the immediately-preceding period (for deltas). */
  priorDailyRows: VitalsDailyRow[];
  /** Ordered UTC day keys the range touches. */
  days: string[];
  /** The open day key, or null when the range ends before today. */
  todayKey: string | null;
  startDate: string;
  endDate: string;
}

const METRICS: readonly WebVitalName[] = ["lcp", "inp", "cls"] as const;

const histogramKey = (metric: WebVitalName): keyof VitalsDailyRow =>
  metric === "lcp" ? "lcpHistogram" : metric === "inp" ? "inpHistogram" : "clsHistogram";

const rawValue = (metric: WebVitalName, row: VitalsRawRow): number | null =>
  metric === "lcp" ? row.lcpMs : metric === "inp" ? row.inpMs : row.cls;

/** Non-null raw samples for a metric across rows. */
const rawSamples = (metric: WebVitalName, rows: VitalsRawRow[]): number[] => {
  const values: number[] = [];
  for (const row of rows) {
    const value = rawValue(metric, row);
    if (value !== null && value !== undefined) {
      values.push(value);
    }
  }
  return values;
};

/** Histogram covering the whole range for a metric: past days + today's raw. */
const rangeHistogram = (
  metric: WebVitalName,
  dailyRows: VitalsDailyRow[],
  todayRawRows: VitalsRawRow[],
): VitalHistogram => {
  const key = histogramKey(metric);
  const dailyHistograms = dailyRows.map((row) => row[key] as VitalHistogram);
  const todayHistogram = buildHistogram(metric, rawSamples(metric, todayRawRows));
  return mergeHistograms(...dailyHistograms, todayHistogram);
};

const summarizeMetric = (
  metric: WebVitalName,
  current: VitalHistogram,
  prior: VitalHistogram,
): VitalMetricSummary => {
  const p75 = p75FromHistogram(metric, current);
  const priorP75 = p75FromHistogram(metric, prior);
  return {
    p75,
    rating: p75 === null ? null : rateVital(metric, p75),
    sampleCount: histogramCount(current),
    deltaVsPrev: p75 !== null && priorP75 !== null ? p75 - priorP75 : null,
  };
};

export const buildVitalsMetrics = (args: BuildVitalsArgs): FormVitalsMetrics => {
  const { dailyRows, todayRawRows, priorDailyRows, days, todayKey, startDate, endDate } = args;

  const dailyByDate = new Map(dailyRows.map((row) => [row.date, row]));

  const summaries = {} as Record<WebVitalName, VitalMetricSummary>;
  for (const metric of METRICS) {
    const current = rangeHistogram(metric, dailyRows, todayRawRows);
    const key = histogramKey(metric);
    const prior = mergeHistograms(...priorDailyRows.map((row) => row[key] as VitalHistogram));
    summaries[metric] = summarizeMetric(metric, current, prior);
  }

  const series = days.map((date) => {
    const isToday = date === todayKey;
    const dayHistogram = (metric: WebVitalName): VitalHistogram => {
      if (isToday) {
        return buildHistogram(metric, rawSamples(metric, todayRawRows));
      }
      const row = dailyByDate.get(date);
      return row ? (row[histogramKey(metric)] as VitalHistogram) : {};
    };
    return {
      date,
      lcpP75: p75FromHistogram("lcp", dayHistogram("lcp")),
      inpP75: p75FromHistogram("inp", dayHistogram("inp")),
      clsP75: p75FromHistogram("cls", dayHistogram("cls")),
    };
  });

  return {
    startDate,
    endDate,
    lcp: summaries.lcp,
    inp: summaries.inp,
    cls: summaries.cls,
    series,
  };
};
