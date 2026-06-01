import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import { THANK_YOU_STEP } from "./types";
import type { EngineField, Rule, Ruleset } from "./types";

const ruleset = (rules: Rule[]): Ruleset => ({ rules, orphanedRefs: [] });

const fields: EngineField[] = [
  { name: "country" },
  { name: "vat", required: true },
  { name: "extra" },
];

describe("evaluate — visibility", () => {
  it("show-targeted field is hidden by default and revealed when its condition passes", () => {
    const rs = ruleset([
      {
        id: "r1",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "show", target: "vat" }],
      },
    ]);
    expect(evaluate(rs, { country: "FR" }, fields).visibility.vat).toBe(false);
    expect(evaluate(rs, { country: "DE" }, fields).visibility.vat).toBe(true);
  });

  it("hide action conceals an otherwise-visible field when its condition passes", () => {
    const rs = ruleset([
      {
        id: "r1",
        stepId: "s1",
        when: {
          combinator: "any",
          children: [{ source: "country", operator: "equals", value: "US" }],
        },
        actions: [{ kind: "hide", target: "extra" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).visibility.extra).toBe(true);
    expect(evaluate(rs, { country: "US" }, fields).visibility.extra).toBe(false);
  });

  it("hide wins over show deterministically, regardless of rule order", () => {
    const show: Rule = {
      id: "show",
      stepId: "s1",
      when: {
        combinator: "all",
        children: [{ source: "country", operator: "equals", value: "DE" }],
      },
      actions: [{ kind: "show", target: "vat" }],
    };
    const hide: Rule = {
      id: "hide",
      stepId: "s1",
      when: {
        combinator: "all",
        children: [{ source: "country", operator: "equals", value: "DE" }],
      },
      actions: [{ kind: "hide", target: "vat" }],
    };
    // Both rules fire for country=DE; hide must win in either authoring order.
    expect(evaluate(ruleset([show, hide]), { country: "DE" }, fields).visibility.vat).toBe(false);
    expect(evaluate(ruleset([hide, show]), { country: "DE" }, fields).visibility.vat).toBe(false);
  });

  it("applies elseActions (Else Do) when the condition fails", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "show", target: "vat" }],
        elseActions: [{ kind: "show", target: "extra" }],
      },
    ]);
    // country=DE → Do branch: vat shown, extra (else-show-target) stays hidden-by-default
    const pass = evaluate(rs, { country: "DE" }, fields);
    expect(pass.visibility.vat).toBe(true);
    expect(pass.visibility.extra).toBe(false);
    // country=FR → Else Do branch: extra shown, vat stays hidden-by-default
    const fail = evaluate(rs, { country: "FR" }, fields);
    expect(fail.visibility.vat).toBe(false);
    expect(fail.visibility.extra).toBe(true);
  });

  it("setValue auto-fills a target only on the active branch", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "setValue", target: "vat", value: "36" }],
        elseActions: [{ kind: "setValue", target: "vat", value: "0" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).setValues.vat).toBe("36");
    expect(evaluate(rs, { country: "FR" }, fields).setValues.vat).toBe("0");
  });

  it("ignores action targets that are not known fields (no stray visibility keys)", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "hide", target: "ghostField" }],
      },
    ]);
    const result = evaluate(rs, { country: "DE" }, fields);
    expect("ghostField" in result.visibility).toBe(false);
  });
});

describe("evaluate — combinators & grouping", () => {
  it("all requires every child; any requires one", () => {
    const all: Rule = {
      id: "r",
      stepId: "s1",
      when: {
        combinator: "all",
        children: [
          { source: "country", operator: "equals", value: "DE" },
          { source: "extra", operator: "isNotEmpty" },
        ],
      },
      actions: [{ kind: "hide", target: "vat" }],
    };
    expect(evaluate(ruleset([all]), { country: "DE", extra: "x" }, fields).visibility.vat).toBe(
      false,
    );
    expect(evaluate(ruleset([all]), { country: "DE", extra: "" }, fields).visibility.vat).toBe(
      true,
    );
  });

  it("nested group expresses (A and B) or C", () => {
    const rule: Rule = {
      id: "r",
      stepId: "s1",
      when: {
        combinator: "any",
        children: [
          {
            combinator: "all",
            children: [
              { source: "country", operator: "equals", value: "DE" },
              { source: "extra", operator: "equals", value: "biz" },
            ],
          },
          { source: "country", operator: "equals", value: "CH" },
        ],
      },
      actions: [{ kind: "hide", target: "vat" }],
    };
    expect(evaluate(ruleset([rule]), { country: "CH" }, fields).visibility.vat).toBe(false);
    expect(evaluate(ruleset([rule]), { country: "DE", extra: "biz" }, fields).visibility.vat).toBe(
      false,
    );
    expect(evaluate(ruleset([rule]), { country: "DE", extra: "x" }, fields).visibility.vat).toBe(
      true,
    );
  });
});

describe("evaluate — required, hideSubmit, redirect", () => {
  it("authored-required but hidden field is not effectively required", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "US" }],
        },
        actions: [{ kind: "hide", target: "vat" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).effectiveRequired.vat).toBe(true);
    expect(evaluate(rs, { country: "US" }, fields).effectiveRequired.vat).toBe(false);
  });

  it("require action makes a visible field required only when its condition passes", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "require", target: "extra" }],
      },
    ]);
    expect(evaluate(rs, { country: "FR" }, fields).effectiveRequired.extra).toBe(false);
    expect(evaluate(rs, { country: "DE" }, fields).effectiveRequired.extra).toBe(true);
  });

  it("hideSubmit and redirect react to conditions", () => {
    const rs = ruleset([
      {
        id: "r1",
        stepId: "s1",
        when: { combinator: "all", children: [{ source: "country", operator: "isEmpty" }] },
        actions: [{ kind: "hideSubmit" }],
      },
      {
        id: "r2",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "redirect", url: "https://de.example.com" }],
      },
    ]);
    expect(evaluate(rs, { country: "" }, fields).hideSubmit).toBe(true);
    expect(evaluate(rs, { country: "DE" }, fields).hideSubmit).toBe(false);
    expect(evaluate(rs, { country: "DE" }, fields).redirectUrl).toBe("https://de.example.com");
    expect(evaluate(rs, { country: "FR" }, fields).redirectUrl).toBeNull();
  });
});

describe("evaluate — resolveJump", () => {
  it("first matching jump rule on the step wins; non-match falls through to null", () => {
    const rs = ruleset([
      {
        id: "r1",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "US" }],
        },
        actions: [{ kind: "jump", toStep: "s3" }],
      },
      {
        id: "r2",
        stepId: "s1",
        when: { combinator: "all", children: [{ source: "country", operator: "isEmpty" }] },
        actions: [{ kind: "jump", toStep: THANK_YOU_STEP }],
      },
    ]);
    expect(evaluate(rs, { country: "US" }, fields).resolveJump("s1")).toBe("s3");
    expect(evaluate(rs, { country: "" }, fields).resolveJump("s1")).toBe(THANK_YOU_STEP);
    expect(evaluate(rs, { country: "DE" }, fields).resolveJump("s1")).toBeNull();
    expect(evaluate(rs, { country: "US" }, fields).resolveJump("s2")).toBeNull();
  });
});

describe("evaluate — fail-closed orphans", () => {
  it("condition on an unknown source evaluates false", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "ghost", operator: "equals", value: "x" }],
        },
        actions: [{ kind: "hide", target: "vat" }],
      },
    ]);
    expect(evaluate(rs, { ghost: "x" }, fields).visibility.vat).toBe(true); // hide never fires
  });
});
