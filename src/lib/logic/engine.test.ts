import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import { THANK_YOU_STEP } from "./types";
import type { Action, EngineField, EvaluationResult, OperatorId, Rule, Ruleset } from "./types";

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

describe("evaluate — moveToNext (focusField)", () => {
  it("focusField is the target of a passing Move-to-next-field action, else null", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "moveToNext", target: "vat" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).focusField).toBe("vat");
    expect(evaluate(rs, { country: "FR" }, fields).focusField).toBeNull();
  });

  it("ignores Move-to-next-field targets that are not known fields", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: { combinator: "all", children: [{ source: "country", operator: "isNotEmpty" }] },
        actions: [{ kind: "moveToNext", target: "ghost" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).focusField).toBeNull();
  });

  it("last passing Move-to-next-field wins (document order)", () => {
    const move = (id: string, target: string): Rule => ({
      id,
      stepId: "s1",
      when: { combinator: "all", children: [{ source: "country", operator: "isNotEmpty" }] },
      actions: [{ kind: "moveToNext", target }],
    });
    const rs = ruleset([move("r1", "vat"), move("r2", "extra")]);
    expect(evaluate(rs, { country: "DE" }, fields).focusField).toBe("extra");
  });

  it("uses the Else branch's Move-to-next-field when the condition fails", () => {
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [{ source: "country", operator: "equals", value: "DE" }],
        },
        actions: [{ kind: "moveToNext", target: "vat" }],
        elseActions: [{ kind: "moveToNext", target: "extra" }],
      },
    ]);
    expect(evaluate(rs, { country: "DE" }, fields).focusField).toBe("vat");
    expect(evaluate(rs, { country: "FR" }, fields).focusField).toBe("extra");
  });
});

describe("evaluate — setValue is never spontaneous (the prefill footgun)", () => {
  // Mirrors the reported confusion: "When Short Answer contains 'baskar' → Set it to 'vijayabaskar'".
  const rs = ruleset([
    {
      id: "r",
      stepId: "s1",
      when: {
        combinator: "any",
        children: [
          { source: "extra", operator: "equals", value: "baskar" },
          { source: "extra", operator: "contains", value: "baskar" },
        ],
      },
      actions: [{ kind: "setValue", target: "extra", value: "vijayabaskar" }],
    },
  ]);

  it("does NOT auto-fill on an empty/absent field — there is no spontaneous prefill", () => {
    expect(evaluate(rs, {}, fields).setValues.extra).toBeUndefined();
    expect(evaluate(rs, { extra: "" }, fields).setValues.extra).toBeUndefined();
    expect(evaluate(rs, { extra: "hello" }, fields).setValues.extra).toBeUndefined();
  });

  it("only fills once the answer actually satisfies the condition", () => {
    expect(evaluate(rs, { extra: "baskar" }, fields).setValues.extra).toBe("vijayabaskar");
  });

  it("a set-value whose result still matches its own condition stays applied (self-sustaining)", () => {
    // "vijayabaskar" itself contains "baskar", so re-evaluating with the filled value keeps it
    // applied. The engine is correct — the rule is self-referential, which is what causes the
    // value to look 'stuck/prefilled' once a persisted draft seeds it.
    expect(evaluate(rs, { extra: "vijayabaskar" }, fields).setValues.extra).toBe("vijayabaskar");
  });
});

describe("evaluate — full operator × action matrix (text field)", () => {
  // Condition source field is "x"; actions target a separate field "tgt".
  const matrixFields: EngineField[] = [{ name: "x" }, { name: "tgt" }];

  // Every text-field operator with an answer that makes it PASS and one that makes it FAIL.
  const OPERATORS: Array<{ op: OperatorId; operand?: string; pass: unknown; fail: unknown }> = [
    { op: "equals", operand: "baskar", pass: "baskar", fail: "other" },
    { op: "notEquals", operand: "baskar", pass: "other", fail: "baskar" },
    { op: "contains", operand: "baskar", pass: "vijayabaskar", fail: "vijaya" },
    { op: "notContains", operand: "baskar", pass: "vijaya", fail: "vijayabaskar" },
    { op: "isEmpty", pass: "", fail: "x" },
    { op: "isNotEmpty", pass: "x", fail: "" },
  ];

  // Every action with how to assert its effect is present (condition passes) / absent (fails).
  const ACTIONS: Array<{
    name: string;
    action: Action;
    present: (r: EvaluationResult) => unknown;
    absent: (r: EvaluationResult) => unknown;
  }> = [
    {
      name: "show field",
      action: { kind: "show", target: "tgt" },
      present: (r) => r.visibility.tgt === true,
      absent: (r) => r.visibility.tgt === false, // show-target hides by default
    },
    {
      name: "hide field",
      action: { kind: "hide", target: "tgt" },
      present: (r) => r.visibility.tgt === false,
      absent: (r) => r.visibility.tgt === true,
    },
    {
      name: "require field",
      action: { kind: "require", target: "tgt" },
      present: (r) => r.effectiveRequired.tgt === true,
      absent: (r) => r.effectiveRequired.tgt === false,
    },
    {
      name: "set value",
      action: { kind: "setValue", target: "tgt", value: "V" },
      present: (r) => r.setValues.tgt === "V",
      absent: (r) => r.setValues.tgt === undefined,
    },
    {
      name: "move to next field",
      action: { kind: "moveToNext", target: "tgt" },
      present: (r) => r.focusField === "tgt",
      absent: (r) => r.focusField === null,
    },
    {
      name: "jump to step",
      action: { kind: "jump", toStep: "s2" },
      present: (r) => r.resolveJump("s1") === "s2",
      absent: (r) => r.resolveJump("s1") === null,
    },
    {
      name: "hide submit",
      action: { kind: "hideSubmit" },
      present: (r) => r.hideSubmit === true,
      absent: (r) => r.hideSubmit === false,
    },
    {
      name: "redirect",
      action: { kind: "redirect", url: "https://x.test" },
      present: (r) => r.redirectUrl === "https://x.test",
      absent: (r) => r.redirectUrl === null,
    },
  ];

  for (const o of OPERATORS) {
    for (const a of ACTIONS) {
      it(`${o.op} → ${a.name}`, () => {
        const rs = ruleset([
          {
            id: "r",
            stepId: "s1",
            when: {
              combinator: "all",
              children: [{ source: "x", operator: o.op, value: o.operand }],
            },
            actions: [a.action],
          },
        ]);
        expect(a.present(evaluate(rs, { x: o.pass }, matrixFields))).toBe(true); // passes → effect on
        expect(a.absent(evaluate(rs, { x: o.fail }, matrixFields))).toBe(true); // fails → effect off
      });
    }
  }

  // Combinator coverage: And requires both, Or requires one — across both branches.
  it("And (all) vs Or (any) gate the action correctly", () => {
    const two = (combinator: "all" | "any"): Ruleset =>
      ruleset([
        {
          id: "r",
          stepId: "s1",
          when: {
            combinator,
            children: [
              { source: "x", operator: "equals", value: "a" },
              { source: "tgt", operator: "equals", value: "b" },
            ],
          },
          actions: [{ kind: "hideSubmit" }],
        },
      ]);
    expect(evaluate(two("all"), { x: "a", tgt: "b" }, matrixFields).hideSubmit).toBe(true);
    expect(evaluate(two("all"), { x: "a", tgt: "z" }, matrixFields).hideSubmit).toBe(false);
    expect(evaluate(two("any"), { x: "a", tgt: "z" }, matrixFields).hideSubmit).toBe(true);
    expect(evaluate(two("any"), { x: "z", tgt: "z" }, matrixFields).hideSubmit).toBe(false);
  });

  // Source-shape coverage: conditions reading non-text answers (single-choice string,
  // multi-select array, numeric scale, Matrix object) drive actions end-to-end.
  it("evaluates conditions over single-choice, multi-select, scale, and matrix sources", () => {
    const fieldsX: EngineField[] = [
      { name: "plan" }, // Dropdown/MultiChoice → string
      { name: "colors" }, // MultiSelect/Checkbox → array
      { name: "score" }, // LinearScale/Rating → numeric string
      { name: "grid" }, // Matrix → row→column object
      { name: "tgt" },
    ];
    const rs = ruleset([
      {
        id: "r",
        stepId: "s1",
        when: {
          combinator: "all",
          children: [
            { source: "plan", operator: "equals", value: "Premium" },
            { source: "colors", operator: "contains", value: "blue" },
            { source: "score", operator: "greaterThanOrEqual", value: "4" },
            { source: "grid", operator: "isNotEmpty" },
          ],
        },
        actions: [{ kind: "show", target: "tgt" }],
      },
    ]);
    // All four conditions pass → target shown.
    expect(
      evaluate(
        rs,
        { plan: "Premium", colors: ["red", "blue"], score: "5", grid: { row1: "a" } },
        fieldsX,
      ).visibility.tgt,
    ).toBe(true);
    // Any failing source (empty matrix, wrong choice, low score, missing color) → hidden.
    expect(
      evaluate(rs, { plan: "Premium", colors: ["red", "blue"], score: "5", grid: {} }, fieldsX)
        .visibility.tgt,
    ).toBe(false);
    expect(
      evaluate(
        rs,
        { plan: "Basic", colors: ["red", "blue"], score: "5", grid: { row1: "a" } },
        fieldsX,
      ).visibility.tgt,
    ).toBe(false);
    expect(
      evaluate(rs, { plan: "Premium", colors: ["red"], score: "5", grid: { row1: "a" } }, fieldsX)
        .visibility.tgt,
    ).toBe(false);
    expect(
      evaluate(
        rs,
        { plan: "Premium", colors: ["red", "blue"], score: "2", grid: { row1: "a" } },
        fieldsX,
      ).visibility.tgt,
    ).toBe(false);
  });

  // Else branch: the action fires when the condition FAILS instead of passes.
  it("Else action fires on the failing branch for every operator", () => {
    for (const o of OPERATORS) {
      const rs = ruleset([
        {
          id: "r",
          stepId: "s1",
          when: {
            combinator: "all",
            children: [{ source: "x", operator: o.op, value: o.operand }],
          },
          actions: [],
          elseActions: [{ kind: "setValue", target: "tgt", value: "ELSE" }],
        },
      ]);
      expect(evaluate(rs, { x: o.fail }, matrixFields).setValues.tgt).toBe("ELSE"); // fails → Else
      expect(evaluate(rs, { x: o.pass }, matrixFields).setValues.tgt).toBeUndefined(); // passes → no Else
    }
  });
});
