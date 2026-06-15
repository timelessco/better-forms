import { describe, expect, it } from "vitest";

import { fieldsBefore, formatMentionValue, hasMention, resolveMentions } from "./resolve-mentions";

const ctx = (values: Record<string, unknown>, labels: Record<string, string> = {}) => ({
  getValue: (name: string) => values[name],
  getLabel: (name: string) => labels[name],
});

describe("resolveMentions", () => {
  it("returns a single text run for plain text nodes", () => {
    const runs = resolveMentions([{ text: "Hello there" }], ctx({}));
    expect(runs).toEqual([{ kind: "text", text: "Hello there" }]);
  });

  it("resolves a filled mention to its live value", () => {
    const nodes = [
      { text: "hi , " },
      { type: "mention", fieldName: "name", value: "Name", children: [{ text: "" }] },
      { text: " !" },
    ];
    const runs = resolveMentions(nodes, ctx({ name: "Ada" }));
    expect(runs).toEqual([
      { kind: "text", text: "hi , " },
      { kind: "value", text: "Ada" },
      { kind: "text", text: " !" },
    ]);
  });

  it("falls back to the referenced field label when the value is empty", () => {
    const nodes = [{ type: "mention", fieldName: "name", value: "Name", children: [{ text: "" }] }];
    const runs = resolveMentions(nodes, ctx({}, { name: "Enter Your Name" }));
    expect(runs).toEqual([{ kind: "placeholder", text: "Enter Your Name" }]);
  });

  it("falls back to the stored display value when the field was deleted", () => {
    const nodes = [
      { type: "mention", fieldName: "gone", value: "Old Field", children: [{ text: "" }] },
    ];
    const runs = resolveMentions(nodes, ctx({}));
    expect(runs).toEqual([{ kind: "placeholder", text: "Old Field" }]);
  });

  it("joins array values (multi-choice answers)", () => {
    const nodes = [
      { type: "mention", fieldName: "tools", value: "Tools", children: [{ text: "" }] },
    ];
    const runs = resolveMentions(nodes, ctx({ tools: ["Vim", "VSCode"] }));
    expect(runs).toEqual([{ kind: "value", text: "Vim, VSCode" }]);
  });

  it("treats zero as a real answer, not empty", () => {
    const nodes = [
      { type: "mention", fieldName: "score", value: "Score", children: [{ text: "" }] },
    ];
    const runs = resolveMentions(nodes, ctx({ score: 0 }));
    expect(runs).toEqual([{ kind: "value", text: "0" }]);
  });
});

describe("formatMentionValue", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(formatMentionValue(null)).toBe("");
    expect(formatMentionValue(undefined)).toBe("");
    expect(formatMentionValue("")).toBe("");
    expect(formatMentionValue([])).toBe("");
  });
});

describe("hasMention", () => {
  it("detects a mention anywhere in the children", () => {
    expect(hasMention([{ text: "a" }, { type: "mention", fieldName: "x" }])).toBe(true);
    expect(hasMention([{ text: "a" }])).toBe(false);
    expect(hasMention(undefined)).toBe(false);
  });
});

describe("fieldsBefore", () => {
  const fields = [{ name: "a" }, { name: "b" }, { name: "c" }];

  it("returns every field when there is no cutoff", () => {
    expect(fieldsBefore(fields, null)).toEqual(fields);
  });

  it("returns only fields preceding the cutoff (excludes self and later)", () => {
    expect(fieldsBefore(fields, "b")).toEqual([{ name: "a" }]);
  });

  it("returns every field when the cutoff is not found", () => {
    expect(fieldsBefore(fields, "z")).toEqual(fields);
  });
});
