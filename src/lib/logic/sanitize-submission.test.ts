import { describe, expect, it } from "vitest";
import * as v from "valibot";
import type { Value } from "platejs";
import { buildVisibleSchema, sanitizeSubmission } from "./sanitize-submission";

const content = [
  { type: "formLabel", id: "country", children: [{ text: "Country" }] },
  { type: "formInput", children: [{ text: "" }] },
  {
    type: "logicBlock",
    id: "lb",
    when: { combinator: "all", children: [{ source: "country", operator: "equals", value: "US" }] },
    actions: [{ kind: "hide", target: "vat" }],
    children: [{ text: "" }],
  },
  { type: "formLabel", id: "vat", children: [{ text: "VAT" }] },
  { type: "formInput", children: [{ text: "" }] },
] as unknown as Value;

describe("sanitizeSubmission", () => {
  it("keeps answers for visible fields", () => {
    const { data, hiddenStripped } = sanitizeSubmission(content, { country: "DE", vat: "DE123" });
    expect(data).toEqual({ country: "DE", vat: "DE123" });
    expect(hiddenStripped).toEqual([]);
  });

  it("strips and flags an answer the client sent for a server-hidden field", () => {
    const { data, hiddenStripped, rejected } = sanitizeSubmission(content, {
      country: "US",
      vat: "SHOULD_NOT_BE_HERE",
    });
    expect(data).toEqual({ country: "US" });
    expect(hiddenStripped).toContain("vat");
    expect(rejected).toContain("vat");
  });
});

const requiredVatContent = [
  { type: "formLabel", id: "country", children: [{ text: "Country" }] },
  { type: "formInput", children: [{ text: "" }] },
  {
    type: "logicBlock",
    id: "lb",
    when: { combinator: "all", children: [{ source: "country", operator: "equals", value: "US" }] },
    actions: [{ kind: "hide", target: "vat" }],
    children: [{ text: "" }],
  },
  { type: "formLabel", id: "vat", children: [{ text: "VAT" }] },
  { type: "formInput", required: true, children: [{ text: "" }] },
] as unknown as Value;

describe("buildVisibleSchema", () => {
  it("omits a hidden required field so it can't block submit", () => {
    const schema = buildVisibleSchema(requiredVatContent, { country: "US" });
    expect(v.safeParse(schema, { country: "US" }).success).toBe(true);
  });

  it("enforces a visible required field", () => {
    const schema = buildVisibleSchema(requiredVatContent, { country: "DE" });
    expect(v.safeParse(schema, { country: "DE" }).success).toBe(false);
    expect(v.safeParse(schema, { country: "DE", vat: "DE123" }).success).toBe(true);
  });
});
