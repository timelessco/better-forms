import { describe, expect, it } from "vitest";
import { resolveTimeRange, splitTodayVsPast, toDateKey } from "@/lib/analytics/time-range";

const FIXED_NOW = new Date("2026-04-27T12:00:00Z");

describe("toDateKey", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    expect(toDateKey(new Date("2026-04-27T12:00:00Z"))).toBe("2026-04-27");
  });

  it("uses UTC date even for instants near midnight in non-UTC timezones", () => {
    // 2026-04-27T23:30:00-05:00 == 2026-04-28T04:30:00Z
    expect(toDateKey(new Date("2026-04-27T23:30:00-05:00"))).toBe("2026-04-28");
    // 2026-04-28T00:30:00+05:00 == 2026-04-27T19:30:00Z
    expect(toDateKey(new Date("2026-04-28T00:30:00+05:00"))).toBe("2026-04-27");
  });

  it("zero-pads month and day", () => {
    expect(toDateKey(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});

describe("resolveTimeRange", () => {
  it("resolves last_24_hours at noon: 2 day keys (yesterday + today)", () => {
    const result = resolveTimeRange({ filter: "last_24_hours" }, FIXED_NOW);
    expect(result.end.toISOString()).toBe(FIXED_NOW.toISOString());
    expect(result.start.toISOString()).toBe(new Date("2026-04-26T12:00:00Z").toISOString());
    expect(result.days).toStrictEqual(["2026-04-26", "2026-04-27"]);
  });

  it("last_24_hours early in day: window touches yesterday + today", () => {
    const earlyNow = new Date("2026-04-27T01:00:00Z");
    const result = resolveTimeRange({ filter: "last_24_hours" }, earlyNow);
    expect(result.days).toStrictEqual(["2026-04-26", "2026-04-27"]);
  });

  it("last_24_hours late in day: window touches yesterday + today", () => {
    const lateNow = new Date("2026-04-27T23:00:00Z");
    const result = resolveTimeRange({ filter: "last_24_hours" }, lateNow);
    // start = 2026-04-26T23:00:00Z, end = 2026-04-27T23:00:00Z
    expect(result.days).toStrictEqual(["2026-04-26", "2026-04-27"]);
  });

  it("resolves last_7_days at noon: 8 unique day keys (window touches 8 calendar dates)", () => {
    const result = resolveTimeRange({ filter: "last_7_days" }, FIXED_NOW);
    expect(result.end.toISOString()).toBe(FIXED_NOW.toISOString());
    expect(result.days).toHaveLength(8);
    expect(new Set(result.days).size).toBe(8);
    expect(result.days[0]).toBe("2026-04-20");
    expect(result.days[result.days.length - 1]).toBe("2026-04-27");
  });

  it("resolves last_7_days at midnight UTC: exactly 8 day keys (window starts at start-of-day)", () => {
    const midnightNow = new Date("2026-04-27T00:00:00Z");
    const result = resolveTimeRange({ filter: "last_7_days" }, midnightNow);
    // start = 2026-04-20T00:00:00Z, end = 2026-04-27T00:00:00Z
    expect(result.days).toHaveLength(8);
    expect(result.days[0]).toBe("2026-04-20");
    expect(result.days[result.days.length - 1]).toBe("2026-04-27");
  });

  it("resolves last_30_days: 31 unique day keys at noon (window touches 31 calendar dates)", () => {
    const result = resolveTimeRange({ filter: "last_30_days" }, FIXED_NOW);
    expect(result.days).toHaveLength(31);
    expect(new Set(result.days).size).toBe(31);
    expect(result.days[result.days.length - 1]).toBe("2026-04-27");
  });

  it("resolves last_90_days: 91 unique day keys at noon", () => {
    const result = resolveTimeRange({ filter: "last_90_days" }, FIXED_NOW);
    expect(result.days).toHaveLength(91);
    expect(new Set(result.days).size).toBe(91);
    expect(result.days[result.days.length - 1]).toBe("2026-04-27");
  });

  it("year-boundary: last_7_days starting in early January includes December keys", () => {
    const earlyJan = new Date("2026-01-03T12:00:00Z");
    const result = resolveTimeRange({ filter: "last_7_days" }, earlyJan);
    // start = 2025-12-27T12:00:00Z, end = 2026-01-03T12:00:00Z -> 8 days
    expect(result.days).toHaveLength(8);
    expect(result.days[0]).toBe("2025-12-27");
    expect(result.days).toContain("2025-12-31");
    expect(result.days).toContain("2026-01-01");
    expect(result.days[result.days.length - 1]).toBe("2026-01-03");
  });

  it("resolves custom range with valid startDate/endDate (inclusive)", () => {
    const result = resolveTimeRange(
      {
        filter: "custom",
        startDate: "2026-04-01",
        endDate: "2026-04-05",
      },
      FIXED_NOW,
    );
    expect(result.days).toStrictEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);
    expect(toDateKey(result.start)).toBe("2026-04-01");
    expect(toDateKey(result.end)).toBe("2026-04-05");
  });

  it("custom range with same start and end produces single day", () => {
    const result = resolveTimeRange(
      {
        filter: "custom",
        startDate: "2026-04-10",
        endDate: "2026-04-10",
      },
      FIXED_NOW,
    );
    expect(result.days).toStrictEqual(["2026-04-10"]);
  });

  it("custom range across leap-year February boundary", () => {
    const result = resolveTimeRange(
      {
        filter: "custom",
        startDate: "2024-02-28",
        endDate: "2024-03-01",
      },
      FIXED_NOW,
    );
    expect(result.days).toStrictEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  it("throws when custom is missing startDate", () => {
    expect(() => resolveTimeRange({ filter: "custom", endDate: "2026-04-05" }, FIXED_NOW)).toThrow(
      /startDate/i,
    );
  });

  it("throws when custom is missing endDate", () => {
    expect(() =>
      resolveTimeRange({ filter: "custom", startDate: "2026-04-01" }, FIXED_NOW),
    ).toThrow(/endDate/i);
  });

  it("throws when custom is missing both dates", () => {
    expect(() => resolveTimeRange({ filter: "custom" }, FIXED_NOW)).toThrow(
      /startDate and endDate/i,
    );
  });

  it("throws on out-of-range calendar date (e.g., 2024-02-30)", () => {
    expect(() =>
      resolveTimeRange(
        { filter: "custom", startDate: "2024-02-30", endDate: "2024-03-01" },
        FIXED_NOW,
      ),
    ).toThrow(/calendar date/i);
  });
});

describe("splitTodayVsPast", () => {
  it("last_7_days: excludes today's key, todayStart and rawStart set", () => {
    const range = resolveTimeRange({ filter: "last_7_days" }, FIXED_NOW);
    const { todayStart, rawStart, pastDays } = splitTodayVsPast(range, FIXED_NOW);
    expect(pastDays).toHaveLength(7);
    expect(pastDays).not.toContain("2026-04-27");
    expect(todayStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    // range.start (7 days ago at 12:00Z) is earlier than today's 00:00Z, so rawStart = todayStart
    expect(rawStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });

  it("returns null todayStart and rawStart when range ends before today", () => {
    const range = resolveTimeRange(
      {
        filter: "custom",
        startDate: "2026-04-01",
        endDate: "2026-04-05",
      },
      FIXED_NOW,
    );
    const { todayStart, rawStart, pastDays } = splitTodayVsPast(range, FIXED_NOW);
    expect(todayStart).toBeNull();
    expect(rawStart).toBeNull();
    expect(pastDays).toStrictEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);
  });

  it("returns todayStart and rawStart when custom range includes today", () => {
    const range = resolveTimeRange(
      {
        filter: "custom",
        startDate: "2026-04-25",
        endDate: "2026-04-27",
      },
      FIXED_NOW,
    );
    const { todayStart, rawStart, pastDays } = splitTodayVsPast(range, FIXED_NOW);
    expect(todayStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(rawStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(pastDays).toStrictEqual(["2026-04-25", "2026-04-26"]);
  });

  it("last_24_hours at noon: pastDays contains yesterday, todayStart and rawStart set", () => {
    const range = resolveTimeRange({ filter: "last_24_hours" }, FIXED_NOW);
    const { todayStart, rawStart, pastDays } = splitTodayVsPast(range, FIXED_NOW);
    expect(pastDays).toStrictEqual(["2026-04-26"]);
    expect(todayStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    // range.start = 2026-04-26T12:00:00Z, todayStart = 2026-04-27T00:00:00Z -> rawStart = todayStart
    expect(rawStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });

  it("last_24_hours early in day: rawStart = todayStart (range.start < todayStart)", () => {
    const earlyNow = new Date("2026-04-27T01:00:00Z");
    const range = resolveTimeRange({ filter: "last_24_hours" }, earlyNow);
    const { todayStart, rawStart } = splitTodayVsPast(range, earlyNow);
    // range.start = 2026-04-26T01:00:00Z, todayStart = 2026-04-27T00:00:00Z -> rawStart = todayStart
    expect(todayStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
    expect(rawStart?.toISOString()).toBe("2026-04-27T00:00:00.000Z");
  });
});
