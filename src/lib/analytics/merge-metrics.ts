import { bumpKey } from "@/lib/analytics/aggregate-utils";
import { cappedDurationMs } from "@/lib/analytics/duration";
import { resolveSource } from "@/lib/analytics/source";
import type { formAnalyticsDaily, formVisits } from "@/db/schema";
import type { CountBreakdown, FormInsightsMetrics } from "@/types/analytics";

type DailyRow = typeof formAnalyticsDaily.$inferSelect;
type RawVisitRow = typeof formVisits.$inferSelect;

interface MergeArgs {
  dailyRows: DailyRow[];
  todayRawRows: RawVisitRow[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: string[]; // YYYY-MM-DD list, all dates in range
  todayKey: string | null; // YYYY-MM-DD or null if range excludes today
}

const KNOWN_BROWSERS = new Set(["Chrome", "Firefox", "Safari", "Edge"]);
const KNOWN_OS = new Set(["Windows", "macOS", "iOS", "Android", "Linux"]);

// Mutates `target` in place (avoids O(N × distinct) spread-clones per row);
// returns it for assignment ergonomics.
const addBreakdowns = (target: CountBreakdown, source: CountBreakdown): CountBreakdown => {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
  return target;
};

const bucketBrowser = (name: string | null | undefined): string => {
  if (name && KNOWN_BROWSERS.has(name)) {
    return name;
  }
  return "Other";
};

const bucketOs = (name: string | null | undefined): string => {
  if (name && KNOWN_OS.has(name)) {
    return name;
  }
  return "Other";
};

interface DailyAggregate {
  totalVisits: number;
  uniqueVisitors: number;
  totalSubmissions: number;
  uniqueRespondents: number;
  durationSumWeighted: number;
  durationVisitsWeight: number;
  sources: CountBreakdown;
  devices: CountBreakdown;
  countries: CountBreakdown;
  cities: CountBreakdown;
  browsers: CountBreakdown;
  operatingSystems: CountBreakdown;
}

const emptyAggregate = (): DailyAggregate => ({
  totalVisits: 0,
  uniqueVisitors: 0,
  totalSubmissions: 0,
  uniqueRespondents: 0,
  durationSumWeighted: 0,
  durationVisitsWeight: 0,
  sources: {},
  devices: {},
  countries: {},
  cities: {},
  browsers: {},
  operatingSystems: {},
});

// Median of a number list (0 for empty). Outlier-resistant central value for visit durations.
const medianOf = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const aggregateDailyRows = (rows: DailyRow[]): DailyAggregate => {
  const agg = emptyAggregate();
  for (const row of rows) {
    agg.totalVisits += row.totalVisits;
    // NOTE: summing uniqueVisitors over-counts multi-day visitors (once/day). v1 approximation.
    agg.uniqueVisitors += row.uniqueVisitors;
    agg.totalSubmissions += row.totalSubmissions;
    agg.uniqueRespondents += row.uniqueSubmitters;

    // Use the per-day MEDIAN, not the mean: a single abandoned tab left open for hours makes the
    // mean visit duration meaningless (e.g. 6h+ outliers → "405m" avg). Median is the typical time.
    if (row.medianDurationMs !== null && row.totalVisits > 0) {
      // Cap stored medians too (older rows were aggregated before the record-time cap existed).
      agg.durationSumWeighted += cappedDurationMs(row.medianDurationMs) * row.totalVisits;
      agg.durationVisitsWeight += row.totalVisits;
    }

    agg.devices = addBreakdowns(agg.devices, (row.deviceBreakdown ?? {}) as CountBreakdown);
    agg.browsers = addBreakdowns(agg.browsers, (row.browserBreakdown ?? {}) as CountBreakdown);
    agg.operatingSystems = addBreakdowns(
      agg.operatingSystems,
      (row.osBreakdown ?? {}) as CountBreakdown,
    );
    agg.countries = addBreakdowns(agg.countries, (row.countryBreakdown ?? {}) as CountBreakdown);
    agg.cities = addBreakdowns(agg.cities, (row.cityBreakdown ?? {}) as CountBreakdown);
    agg.sources = addBreakdowns(agg.sources, (row.sourceBreakdown ?? {}) as CountBreakdown);
  }
  return agg;
};

interface RawAggregate extends DailyAggregate {
  durationSum: number;
  durationCount: number;
}

const aggregateRawRows = (rows: RawVisitRow[]): RawAggregate => {
  const visitorHashes = new Set<string>();
  const respondentHashes = new Set<string>();
  let totalVisits = 0;
  let totalSubmissions = 0;
  const durations: number[] = [];
  const sources: CountBreakdown = {};
  const devices: CountBreakdown = {};
  const countries: CountBreakdown = {};
  const cities: CountBreakdown = {};
  const browsers: CountBreakdown = {};
  const operatingSystems: CountBreakdown = {};

  for (const row of rows) {
    totalVisits += 1;
    visitorHashes.add(row.visitorHash);
    if (row.didSubmit) {
      totalSubmissions += 1;
      respondentHashes.add(row.visitorHash);
    }
    if (row.durationMs !== null && row.durationMs !== undefined) {
      // Cap abandoned-tab outliers (durationMs is tab-open wall-clock time) before the median.
      durations.push(cappedDurationMs(row.durationMs));
    }

    bumpKey(devices, row.deviceType);
    bumpKey(countries, row.country);
    bumpKey(cities, row.city);
    bumpKey(sources, resolveSource({ utmSource: row.utmSource, referrer: row.referrer }));
    bumpKey(browsers, bucketBrowser(row.browser));
    bumpKey(operatingSystems, bucketOs(row.os));
  }

  // Today's typical duration = median of today's visits (outlier-resistant), weighted by count so it
  // blends with the daily medians in the same visit-weighted average.
  const durationCount = durations.length;
  const median = medianOf(durations);
  const durationSum = median * durationCount;
  return {
    totalVisits,
    uniqueVisitors: visitorHashes.size,
    totalSubmissions,
    uniqueRespondents: respondentHashes.size,
    durationSumWeighted: durationSum,
    durationVisitsWeight: durationCount,
    durationSum,
    durationCount,
    sources,
    devices,
    countries,
    cities,
    browsers,
    operatingSystems,
  };
};

const buildDailyEntry = (
  date: string,
  dailyByDate: Map<string, DailyRow>,
  todayKey: string | null,
  rawRows: RawVisitRow[],
): { date: string; visits: number; uniqueVisitors: number; submissions: number } => {
  if (todayKey && date === todayKey) {
    const visitorHashes = new Set<string>();
    let visits = 0;
    let submissions = 0;
    for (const row of rawRows) {
      visits += 1;
      visitorHashes.add(row.visitorHash);
      if (row.didSubmit) {
        submissions += 1;
      }
    }
    return { date, visits, uniqueVisitors: visitorHashes.size, submissions };
  }
  const row = dailyByDate.get(date);
  if (!row) {
    return { date, visits: 0, uniqueVisitors: 0, submissions: 0 };
  }
  return {
    date,
    visits: row.totalVisits,
    uniqueVisitors: row.uniqueVisitors,
    submissions: row.totalSubmissions,
  };
};

export const mergeInsightsMetrics = (args: MergeArgs): FormInsightsMetrics => {
  const { dailyRows, todayRawRows, startDate, endDate, days, todayKey } = args;

  const dailyAgg = aggregateDailyRows(dailyRows);
  const rawAgg = aggregateRawRows(todayRawRows);

  const totalVisits = dailyAgg.totalVisits + rawAgg.totalVisits;
  const uniqueVisitors = dailyAgg.uniqueVisitors + rawAgg.uniqueVisitors;
  const totalSubmissions = dailyAgg.totalSubmissions + rawAgg.totalSubmissions;
  const uniqueRespondents = dailyAgg.uniqueRespondents + rawAgg.uniqueRespondents;

  // Weighted avg across daily + raw pools
  const totalDurationSum = dailyAgg.durationSumWeighted + rawAgg.durationSum;
  const totalDurationWeight = dailyAgg.durationVisitsWeight + rawAgg.durationCount;
  const avgVisitDurationMs =
    totalDurationWeight > 0 ? Math.round(totalDurationSum / totalDurationWeight) : 0;

  const sources = addBreakdowns(dailyAgg.sources, rawAgg.sources);
  const devices = addBreakdowns(dailyAgg.devices, rawAgg.devices);
  const countries = addBreakdowns(dailyAgg.countries, rawAgg.countries);
  const cities = addBreakdowns(dailyAgg.cities, rawAgg.cities);
  const browsers = addBreakdowns(dailyAgg.browsers, rawAgg.browsers);
  const operatingSystems = addBreakdowns(dailyAgg.operatingSystems, rawAgg.operatingSystems);

  const dailyByDate = new Map<string, DailyRow>();
  for (const row of dailyRows) {
    dailyByDate.set(row.date, row);
  }
  const dailyData = days.map((date) => buildDailyEntry(date, dailyByDate, todayKey, todayRawRows));

  return {
    startDate,
    endDate,
    totalVisits,
    uniqueVisitors,
    totalSubmissions,
    // Proxy default; getFormInsightsImpl overrides with the authoritative submissions-table count.
    completedSubmissions: totalSubmissions,
    uniqueRespondents,
    avgVisitDurationMs,
    // Prior-period deltas need a second query; getFormInsightsImpl fills these in.
    visitsDeltaPct: null,
    submissionsDeltaPct: null,
    completionRateDeltaPts: null,
    avgDurationDeltaMs: null,
    sources,
    devices,
    countries,
    cities,
    browsers,
    operatingSystems,
    dailyData,
  };
};
