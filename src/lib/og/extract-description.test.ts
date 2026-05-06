import { describe, expect, it } from "vitest";
import { extractOgDescription } from "@/lib/og/extract-description";

const p = (text: string) => ({ type: "p", children: [{ text }] });
const h1 = (text: string) => ({ type: "h1", children: [{ text }] });
const formHeader = () => ({ type: "formHeader", children: [{ text: "" }] });
const formInput = () => ({ type: "formInput", children: [{ text: "" }] });

describe("extractOgDescription", () => {
  it("returns empty string for empty content", () => {
    expect(extractOgDescription([])).toBe("");
  });

  it("returns empty string when content has only a formHeader", () => {
    expect(extractOgDescription([formHeader()])).toBe("");
  });

  it("returns empty string when first non-header block is a form input", () => {
    expect(extractOgDescription([formHeader(), formInput()])).toBe("");
  });

  it("treats a p followed by a form input as a label and returns empty", () => {
    expect(extractOgDescription([formHeader(), p("What is your name?"), formInput()])).toBe("");
  });

  it("includes a p when it is followed by another p (not a label)", () => {
    expect(
      extractOgDescription([formHeader(), p("Tell us what you think."), p("Quick survey.")]),
    ).toBe("Tell us what you think. Quick survey.");
  });

  it("includes a single p when content ends after it", () => {
    expect(extractOgDescription([formHeader(), p("Tell us what you think.")])).toBe(
      "Tell us what you think.",
    );
  });

  it("ignores h1/h2/h3 (only p counts as description)", () => {
    expect(extractOgDescription([formHeader(), h1("Welcome"), p("Body."), formInput()])).toBe("");
  });

  it("works without a formHeader at the top", () => {
    expect(extractOgDescription([p("Hello"), p("World")])).toBe("Hello World");
  });

  it("truncates at 180 chars on a word boundary with …", () => {
    const long = "word ".repeat(80).trim();
    const out = extractOgDescription([formHeader(), p(long), p("trailing")]);
    expect(out.length).toBeLessThanOrEqual(180);
    expect(out.endsWith("…")).toBeTruthy();
    expect(out.slice(-2, -1)).not.toMatch(/\S/);
  });

  it("trims leading/trailing whitespace inside paragraphs", () => {
    expect(extractOgDescription([formHeader(), p("   spaced   "), p("ok")])).toBe("spaced ok");
  });

  it("only inspects the first two candidate blocks (third is ignored)", () => {
    expect(extractOgDescription([formHeader(), p("first"), p("second"), p("third")])).toBe(
      "first second",
    );
  });

  it("skips empty p blocks at the top and stops looking", () => {
    expect(extractOgDescription([formHeader(), p(""), p("hello")])).toBe("");
  });
});
