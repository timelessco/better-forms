import { describe, expect, it } from "vitest";
import { buildSystemPrompt, computeNextQuestionId, monthKey } from "@/lib/ai/chat-form-helpers";
import type { TransformedElement } from "@/lib/editor/transform-plate-to-form";

const q = (id: string, fieldType: TransformedElement["fieldType"] = "Input"): TransformedElement =>
  ({ id, name: id, fieldType, label: id, required: false }) as TransformedElement;

const staticBlock = (id: string, fieldType: "H1" | "PageBreak" = "H1"): TransformedElement =>
  ({ id, name: id, fieldType, content: id, static: true }) as TransformedElement;

describe("ai-chat-form-helpers", () => {
  describe("monthKey", () => {
    it("returns the UTC YYYY-MM for the given date", () => {
      expect(monthKey(new Date("2026-05-06T12:34:56Z"))).toBe("2026-05");
    });

    it("uses UTC even when the local timezone disagrees", () => {
      expect(monthKey(new Date("2025-12-31T23:30:00Z"))).toBe("2025-12");
    });
  });

  describe("computeNextQuestionId", () => {
    it("returns the first Question when no answers exist", () => {
      const content = [staticBlock("h1"), q("q1"), q("q2")];
      expect(computeNextQuestionId(content, {})).toBe("q1");
    });

    it("skips already-answered Questions", () => {
      const content = [q("q1"), q("q2"), q("q3")];
      expect(computeNextQuestionId(content, { q1: "value" })).toBe("q2");
    });

    it("ignores static Blocks (headings, page breaks) when picking the next Question", () => {
      const content = [q("q1"), staticBlock("h1"), staticBlock("pb", "PageBreak"), q("q2")];
      expect(computeNextQuestionId(content, { q1: "value" })).toBe("q2");
    });

    it("returns null when every Question has an Answer", () => {
      const content = [q("q1"), q("q2")];
      expect(computeNextQuestionId(content, { q1: "a", q2: "b" })).toBeNull();
    });

    it("returns null for an empty form", () => {
      expect(computeNextQuestionId([], {})).toBeNull();
    });

    it("excludes Button fields — they are navigation, not Questions", () => {
      const content = [q("q1"), q("submit", "Button" as never), q("q2")];
      expect(computeNextQuestionId(content, { q1: "a" })).toBe("q2");
    });
  });

  describe("buildSystemPrompt", () => {
    const baseInput = {
      formTitle: "Customer Feedback",
      tone: "friendly" as const,
      language: "English",
      content: [q("q1"), q("q2")],
      currentQuestionId: "q1",
      priorAnswers: {} as Record<string, unknown>,
      greeting: null as string | null,
    };

    it("includes the form title and tone in the prompt", () => {
      const prompt = buildSystemPrompt(baseInput);
      expect(prompt).toContain("Customer Feedback");
      expect(prompt.toLowerCase()).toContain("friendly");
    });

    it("includes the active language so the AI replies in the Respondent's language", () => {
      const prompt = buildSystemPrompt({ ...baseInput, language: "Spanish" });
      expect(prompt).toContain("Spanish");
    });

    it("identifies the current Question and forbids telegraphing future Questions", () => {
      const prompt = buildSystemPrompt(baseInput);
      expect(prompt).toContain("q1");
      expect(prompt.toLowerCase()).toMatch(/do not.*future|do not.*preview|never.*future/);
    });

    it("renders prior Answers as label → value pairs", () => {
      const content = [q("name"), q("color")];
      const prompt = buildSystemPrompt({
        ...baseInput,
        content,
        currentQuestionId: "color",
        priorAnswers: { name: "Alice" },
      });
      expect(prompt).toContain("name");
      expect(prompt).toContain("Alice");
    });

    it("uses the verbatim greeting Setting when supplied on the first turn", () => {
      const prompt = buildSystemPrompt({ ...baseInput, greeting: "Welcome to Acme!" });
      expect(prompt).toContain("Welcome to Acme!");
    });
  });
});
