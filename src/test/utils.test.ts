import { describe, expect, it } from "vitest";
import { cn, parseTimestampAsUTC } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false, "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts with last-wins", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("parseTimestampAsUTC", () => {
  it("returns null for undefined", () => {
    expect(parseTimestampAsUTC(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseTimestampAsUTC("")).toBeNull();
  });

  it("parses ISO string with Z suffix as-is", () => {
    const date = parseTimestampAsUTC("2025-01-15T10:30:00Z");
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2025-01-15T10:30:00.000Z");
  });

  it("parses ISO string with timezone offset as-is", () => {
    const date = parseTimestampAsUTC("2025-01-15T10:30:00+05:30");
    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCHours()).toBe(5);
  });

  it("parses Postgres-style timestamp without timezone as UTC", () => {
    const date = parseTimestampAsUTC("2025-01-15 10:30:00");
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2025-01-15T10:30:00.000Z");
  });

  it("parses ISO timestamp without timezone as UTC", () => {
    const date = parseTimestampAsUTC("2025-01-15T10:30:00");
    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2025-01-15T10:30:00.000Z");
  });
});
