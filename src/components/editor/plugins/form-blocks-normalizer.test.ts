import { describe, expect, it } from "vitest";
import type { TElement } from "platejs";
import { redirectInsertBeforeButton } from "./form-blocks-normalizer";

const el = (type: string): TElement => ({ type, children: [{ text: "" }] });
const button = (): TElement => ({ type: "formButton", children: [{ text: "Submit" }] });

describe("redirectInsertBeforeButton", () => {
  it("keeps position when the previous node is not a button", () => {
    const children = [el("p"), el("formInput")];
    expect(redirectInsertBeforeButton(children, 2, [el("p")])).toBeNull();
  });

  it("keeps position when there is no previous node (insertIndex 0)", () => {
    const children = [button()];
    expect(redirectInsertBeforeButton(children, 0, [el("p")])).toBeNull();
  });

  it("redirects non-pageBreak content to before a preceding button", () => {
    const children = [el("p"), button()];
    // Inserting at index 2 (right after the button) → redirect to index 1 (before the button).
    expect(redirectInsertBeforeButton(children, 2, [el("p")])).toBe(1);
  });

  it("resolves the button-at-index-0 edge case: content lands before the button (index 0)", () => {
    const children = [button()];
    // Inserting at index 1 (after a button that sits at index 0) → returns 0, placing content
    // before the button (not out of bounds, not silently dropped).
    expect(redirectInsertBeforeButton(children, 1, [el("p")])).toBe(0);
  });

  it("allows page breaks to sit immediately after a button (no redirect)", () => {
    const children = [button()];
    expect(redirectInsertBeforeButton(children, 1, [el("pageBreak")])).toBeNull();
  });

  it("redirects when only some inserted nodes are page breaks", () => {
    const children = [el("p"), button()];
    expect(redirectInsertBeforeButton(children, 2, [el("pageBreak"), el("p")])).toBe(1);
  });

  it("accepts a single node (non-array)", () => {
    const children = [button()];
    expect(redirectInsertBeforeButton(children, 1, el("formInput"))).toBe(0);
  });
});
