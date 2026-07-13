import { describe, expect, it } from "vitest";

import {
  buildAnswerDistribution,
  capWithOthers,
  emailDomain,
  lengthBucket,
  normalizeAnswer,
  resolveAnalysis,
  urlDomain,
} from "@/lib/analytics/answer-analysis";

describe("resolveAnalysis", () => {
  it("treats any field with an option set as choice", () => {
    expect(resolveAnalysis("Input", true)).toBe("choice");
    expect(resolveAnalysis("MultiChoice", false)).toBe("choice");
    expect(resolveAnalysis("Rating", false)).toBe("choice");
  });

  it("maps free-text field types to their bucketing kind", () => {
    expect(resolveAnalysis("Email", false)).toBe("domain");
    expect(resolveAnalysis("Link", false)).toBe("domain");
    expect(resolveAnalysis("Textarea", false)).toBe("length");
    expect(resolveAnalysis("FileUpload", false)).toBe("presence");
  });

  it("falls back to raw for low-cardinality types", () => {
    expect(resolveAnalysis("Number", false)).toBe("raw");
    expect(resolveAnalysis("Date", false)).toBe("raw");
  });
});

describe("lengthBucket", () => {
  it("buckets char counts short→long against the boundaries", () => {
    expect(lengthBucket(0)).toBe("Very short");
    expect(lengthBucket(20)).toBe("Very short"); // inclusive upper bound
    expect(lengthBucket(21)).toBe("Short");
    expect(lengthBucket(60)).toBe("Short");
    expect(lengthBucket(61)).toBe("Medium");
    expect(lengthBucket(160)).toBe("Medium");
    expect(lengthBucket(161)).toBe("Detailed");
    expect(lengthBucket(10_000)).toBe("Detailed");
  });
});

describe("emailDomain", () => {
  it("lowercases + trims the domain after the last @", () => {
    expect(emailDomain("Alice@Gmail.com")).toBe("gmail.com");
    expect(emailDomain("a@b@Example.COM ")).toBe("example.com"); // lastIndexOf
  });

  it("returns 'other' when no domain is extractable", () => {
    expect(emailDomain("notanemail")).toBe("other");
    expect(emailDomain("trailing@")).toBe("other");
  });
});

describe("urlDomain", () => {
  it("strips scheme + www and lowercases the host", () => {
    expect(urlDomain("https://www.Behance.net/foo")).toBe("behance.net");
    expect(urlDomain("behance.net")).toBe("behance.net"); // no scheme → https:// prepended
  });

  it("falls back to the trimmed lowercased input when unparseable", () => {
    expect(urlDomain("  Not A Url  ")).toBe("not a url");
  });
});

describe("capWithOthers", () => {
  it("returns the list unchanged when at or under the cap", () => {
    const rows = [
      { label: "a", value: 3 },
      { label: "b", value: 1 },
    ];
    expect(capWithOthers(rows, 6)).toBe(rows);
  });

  it("rolls the tail past the cap into an Others bucket", () => {
    const rows = [
      { label: "a", value: 5 },
      { label: "b", value: 3 },
      { label: "c", value: 2 },
      { label: "d", value: 1 },
    ];
    expect(capWithOthers(rows, 2)).toEqual([
      { label: "a", value: 5 },
      { label: "b", value: 3 },
      { label: "Others", value: 3 },
    ]);
  });
});

describe("normalizeAnswer", () => {
  it("returns [] for nullish and empty strings", () => {
    expect(normalizeAnswer(null)).toEqual([]);
    expect(normalizeAnswer(undefined)).toEqual([]);
    expect(normalizeAnswer("   ")).toEqual([]);
  });

  it("flattens scalars, arrays, and matrix records to present strings", () => {
    expect(normalizeAnswer("hi")).toEqual(["hi"]);
    expect(normalizeAnswer(42)).toEqual(["42"]);
    expect(normalizeAnswer(["a", "", "b"])).toEqual(["a", "b"]);
    expect(normalizeAnswer({ row1: "x", row2: ["y", ""], row3: "" })).toEqual(["x", "y"]);
  });
});

describe("buildAnswerDistribution", () => {
  const optionLabel = (v: string) => v.toUpperCase();

  it("length: fixed buckets short→long, drops empty ones", () => {
    const counts = new Map([
      ["Short", 2],
      ["Detailed", 1],
    ]);
    expect(
      buildAnswerDistribution({
        analysis: "length",
        counts,
        answered: 3,
        submissionCount: 3,
        optionLabel,
      }),
    ).toEqual([
      { label: "Short", value: 2 },
      { label: "Detailed", value: 1 },
    ]);
  });

  it("presence: Yes vs No against submission count", () => {
    expect(
      buildAnswerDistribution({
        analysis: "presence",
        counts: new Map(),
        answered: 2,
        submissionCount: 5,
        optionLabel,
      }),
    ).toEqual([
      { label: "Yes", value: 2 },
      { label: "No", value: 3 },
    ]);
  });

  it("choice: maps values through optionLabel, desc sort, caps at 6 + Others", () => {
    const counts = new Map(
      [
        ["a", 1],
        ["b", 7],
        ["c", 2],
        ["d", 3],
        ["e", 4],
        ["f", 5],
        ["g", 6],
      ].map(([k, v]) => [k as string, v as number]),
    );
    const result = buildAnswerDistribution({
      analysis: "choice",
      counts,
      answered: 28,
      submissionCount: 28,
      optionLabel,
    });
    expect(result).toEqual([
      { label: "B", value: 7 },
      { label: "G", value: 6 },
      { label: "F", value: 5 },
      { label: "E", value: 4 },
      { label: "D", value: 3 },
      { label: "C", value: 2 },
      { label: "Others", value: 1 }, // "a" tail
    ]);
  });

  it("raw: desc sort, top 8 distinct values, no relabeling", () => {
    const counts = new Map(Array.from({ length: 10 }, (_, i) => [`v${i}`, i + 1] as const));
    const result = buildAnswerDistribution({
      analysis: "raw",
      counts,
      answered: 55,
      submissionCount: 55,
      optionLabel,
    });
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ label: "v9", value: 10 });
    expect(result.at(-1)).toEqual({ label: "v2", value: 3 });
  });
});
