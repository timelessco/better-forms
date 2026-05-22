// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { resolveQuestionFromFocus } from "@/lib/forms/extract-questions";
import type { QuestionRef } from "@/lib/forms/extract-questions";

const q = (id: string, questionType: string): QuestionRef => ({
  questionId: id,
  questionType,
  questionIndex: 0,
  stepId: "step_0",
  stepIndex: 0,
});

const wrap = (questionId: string, child: HTMLElement): HTMLElement => {
  const div = document.createElement("div");
  div.setAttribute("data-bf-question-id", questionId);
  div.append(child);
  return div;
};

const nestDeeply = (depth: number, leaf: HTMLElement): HTMLElement => {
  let current: HTMLElement = leaf;
  for (let i = 0; i < depth; i++) {
    const parent = document.createElement("div");
    parent.append(current);
    current = parent;
  }
  return current;
};

const mountForm = (...children: HTMLElement[]): HTMLFormElement => {
  const form = document.createElement("form");
  for (const child of children) form.append(child);
  document.body.append(form);
  return form;
};

describe("resolveQuestionFromFocus", () => {
  it("resolves a focused unnamed <input> inside a Question wrapper (Phone-like)", () => {
    const input = document.createElement("input");
    input.type = "tel";
    const form = mountForm(wrap("q-phone", nestDeeply(2, input)));
    const map = new Map([["q-phone", q("q-phone", "Phone")]]);
    expect(resolveQuestionFromFocus(form.querySelector("input"), map)?.questionId).toBe("q-phone");
  });

  it("resolves a focused <button> with no name (MultiChoice-like)", () => {
    const optionA = document.createElement("button");
    optionA.type = "button";
    optionA.textContent = "Option A";
    const optionB = document.createElement("button");
    optionB.type = "button";
    optionB.textContent = "Option B";
    const group = document.createElement("div");
    group.setAttribute("role", "radiogroup");
    group.append(optionA, optionB);
    const form = mountForm(wrap("q-mc", group));
    const map = new Map([["q-mc", q("q-mc", "MultiChoice")]]);
    expect(resolveQuestionFromFocus(form.querySelectorAll("button")[1], map)?.questionId).toBe(
      "q-mc",
    );
  });

  it("resolves a deeply nested focusable (Checkbox/MultiSelect-like)", () => {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.setAttribute("role", "checkbox");
    const form = mountForm(wrap("q-deep", nestDeeply(6, checkbox)));
    const map = new Map([["q-deep", q("q-deep", "Checkbox")]]);
    expect(resolveQuestionFromFocus(form.querySelector("button"), map)?.questionId).toBe("q-deep");
  });

  it("returns null when target is outside any Question wrapper", () => {
    const input = document.createElement("input");
    const form = mountForm(input);
    expect(resolveQuestionFromFocus(form.querySelector("input"), new Map())).toBeNull();
  });

  it("returns null when the wrapper's id isn't in the lookup map", () => {
    const input = document.createElement("input");
    const form = mountForm(wrap("unknown", input));
    const map = new Map([["other", q("other", "Input")]]);
    expect(resolveQuestionFromFocus(form.querySelector("input"), map)).toBeNull();
  });

  it("returns null for a null target", () => {
    expect(resolveQuestionFromFocus(null, new Map())).toBeNull();
  });

  it("picks the nearest wrapper when Questions are siblings", () => {
    const a = document.createElement("input");
    a.name = "q1";
    const b = document.createElement("input");
    const form = mountForm(wrap("q1", a), wrap("q2", b));
    const map = new Map([
      ["q1", q("q1", "Input")],
      ["q2", q("q2", "FileUpload")],
    ]);
    expect(resolveQuestionFromFocus(form.querySelectorAll("input")[1], map)?.questionId).toBe("q2");
  });
});
