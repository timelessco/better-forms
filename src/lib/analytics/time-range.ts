import type { TimeRange } from "@/types/analytics";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;
const DAYS_LAST_7 = 7;
const DAYS_LAST_30 = 30;
const DAYS_LAST_90 = 90;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type ResolvedRange = {
  start: Date;
  end: Date;
  /**
   * Inclusive list of UTC date keys (YYYY-MM-DD) that intersect [start, end].
   * Every calendar date with any portion in the window appears here.
   */
  days: string[];
};

const padTwo = (value: number): string => value.toString().padStart(2, "0");

/** Format a Date as a UTC date key (YYYY-MM-DD). */
export const toDateKey = (d: Date): string => {
  const year = d.getUTCFullYear();
  const month = padTwo(d.getUTCMonth() + 1);
  const day = padTwo(d.getUTCDate());
  return `${year}-${month}-${day}`;
};

const startOfUtcDay = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));

const parseDateKey = (key: string): Date => {
  if (!DATE_KEY_REGEX.test(key)) {
    throw new Error(`Invalid date key '${key}': expected YYYY-MM-DD`);
  }
  const [year, month, day] = key.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Round-trip check rejects out-of-range months/days (e.g. 2024-02-30).
  if (toDateKey(parsed) !== key) {
    throw new Error(`Invalid date key '${key}': not a real calendar date`);
  }
  return parsed;
};

/** Build the inclusive list of UTC date keys touched by [start, end]. */
const buildIntersectingDayKeys = (start: Date, end: Date): string[] => {
  if (end.getTime() < start.getTime()) {
    throw new Error(
      `Invalid range: end '${end.toISOString()}' is before start '${start.toISOString()}'`,
    );
  }
  const firstDay = startOfUtcDay(start);
  const lastDay = startOfUtcDay(end);
  const keys: string[] = [];
  for (let cursor = firstDay.getTime(); cursor <= lastDay.getTime(); cursor += MS_PER_DAY) {
    keys.push(toDateKey(new Date(cursor)));
  }
  return keys;
};

const resolveRollingHours = (hours: number, now: Date): ResolvedRange => {
  const end = new Date(now.getTime());
  const start = new Date(end.getTime() - hours * MS_PER_HOUR);
  const days = buildIntersectingDayKeys(start, end);
  return { start, end, days };
};

const resolveRollingDays = (days: number, now: Date): ResolvedRange => {
  const end = new Date(now.getTime());
  const start = new Date(end.getTime() - days * MS_PER_DAY);
  const dayKeys = buildIntersectingDayKeys(start, end);
  return { start, end, days: dayKeys };
};

/**
 * Resolve a TimeRange (filter + optional custom dates) into concrete
 * start/end Dates and the list of UTC date keys the window touches.
 */
export const resolveTimeRange = (input: TimeRange, now: Date = new Date()): ResolvedRange => {
  switch (input.filter) {
    case "last_24_hours":
      return resolveRollingHours(HOURS_PER_DAY, now);
    case "last_7_days":
      return resolveRollingDays(DAYS_LAST_7, now);
    case "last_30_days":
      return resolveRollingDays(DAYS_LAST_30, now);
    case "last_90_days":
      return resolveRollingDays(DAYS_LAST_90, now);
    case "custom": {
      if (!(input.startDate && input.endDate)) {
        throw new Error("Custom time range requires both startDate and endDate (YYYY-MM-DD)");
      }
      const start = parseDateKey(input.startDate);
      // End-of-day UTC for the endDate (inclusive)
      const endDay = parseDateKey(input.endDate);
      const end = new Date(endDay.getTime() + MS_PER_DAY - 1);
      const days = buildIntersectingDayKeys(start, end);
      return { start, end, days };
    }
    default: {
      const exhaustive: never = input.filter;
      throw new Error(`Unknown time range filter: ${exhaustive as string}`);
    }
  }
};

/**
 * Split a resolved range into a "today" portion and a list of fully-aggregated
 * past day keys. `todayStart` is the start of the current UTC day (when the
 * range includes today). `rawStart` is the SQL lower bound for raw rows in the
 * open day: `max(range.start, todayStart)`. Both are null when the range ends
 * before today.
 */
export const splitTodayVsPast = (
  range: ResolvedRange,
  now: Date = new Date(),
): { todayStart: Date | null; rawStart: Date | null; pastDays: string[] } => {
  const todayKey = toDateKey(now);
  const includesToday = range.days.includes(todayKey);
  const pastDays = range.days.filter((key) => key !== todayKey);
  if (!includesToday) {
    return { todayStart: null, rawStart: null, pastDays };
  }
  const todayStart = startOfUtcDay(now);
  const rawStart = range.start.getTime() > todayStart.getTime() ? range.start : todayStart;
  return { todayStart, rawStart, pastDays };
};
