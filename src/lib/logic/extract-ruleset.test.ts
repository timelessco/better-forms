import { describe, expect, it } from "vitest";
import type { Value } from "platejs";
import { extractRuleset } from "./extract-ruleset";

const FIRST_STEP = "step-0";

const content = (extra: Record<string, unknown>[] = []): Value =>
  [
    { type: "formLabel", id: "country", children: [{ text: "Country" }] },
    { type: "formInput", children: [{ text: "" }] },
    {
      type: "logicBlock",
      id: "lb1",
      when: {
        combinator: "all",
        children: [{ source: "country", operator: "equals", value: "DE" }],
      },
      actions: [{ kind: "show", target: "vat" }],
      children: [{ text: "" }],
    },
    { type: "formLabel", id: "vat", children: [{ text: "VAT" }] },
    { type: "formInput", children: [{ text: "" }] },
    ...extra,
  ] as unknown as Value;

describe("extractRuleset", () => {
  it("extracts a rule with the step id of its containing step", () => {
    const { rules } = extractRuleset(content());
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("lb1");
    expect(rules[0].stepId).toBe(FIRST_STEP);
    expect(rules[0].actions[0]).toEqual({ kind: "show", target: "vat" });
  });

  it("assigns the opening pageBreak id as the step id for later steps", () => {
    const value = [
      { type: "pageBreak", id: "pb1", children: [{ text: "" }] },
      { type: "formLabel", id: "q2", children: [{ text: "Q2" }] },
      { type: "formInput", children: [{ text: "" }] },
      {
        type: "logicBlock",
        id: "lb2",
        when: { combinator: "all", children: [{ source: "q2", operator: "isNotEmpty" }] },
        actions: [{ kind: "jump", toStep: "__thankYou__" }],
        children: [{ text: "" }],
      },
    ] as unknown as Value;
    const { rules } = extractRuleset(value);
    expect(rules[0].stepId).toBe("pb1");
  });

  it("flags an orphaned condition source", () => {
    const value = [
      {
        type: "logicBlock",
        id: "lb",
        when: {
          combinator: "all",
          children: [{ source: "ghost", operator: "equals", value: "x" }],
        },
        actions: [{ kind: "hide", target: "vat" }],
        children: [{ text: "" }],
      },
      { type: "formLabel", id: "vat", children: [{ text: "VAT" }] },
      { type: "formInput", children: [{ text: "" }] },
    ] as unknown as Value;
    const { orphanedRefs } = extractRuleset(value);
    expect(orphanedRefs).toContain("ghost");
  });

  it("drops a repeatable field used as a condition source and flags it", () => {
    const value = [
      { type: "formLabel", id: "emails", children: [{ text: "Emails" }] },
      { type: "formEmail", isFieldArray: true, children: [{ text: "" }] },
      {
        type: "logicBlock",
        id: "lb",
        when: {
          combinator: "all",
          children: [{ source: "emails", operator: "contains", value: "@x" }],
        },
        actions: [{ kind: "hide", target: "emails" }],
        children: [{ text: "" }],
      },
    ] as unknown as Value;
    const { rules, orphanedRefs } = extractRuleset(value);
    // hide-target "emails" is fine; the condition source "emails" (repeatable) is dropped.
    expect(orphanedRefs).toContain("emails");
    expect(rules[0].when.children).toHaveLength(0);
  });

  it("returns an empty ruleset for content with no logic blocks", () => {
    const value = [
      { type: "formLabel", id: "q", children: [{ text: "Q" }] },
      { type: "formInput", children: [{ text: "" }] },
    ] as unknown as Value;
    expect(extractRuleset(value)).toEqual({ rules: [], orphanedRefs: [] });
  });
});
