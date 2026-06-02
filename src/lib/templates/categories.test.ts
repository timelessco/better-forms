import { expect, it } from "vitest";
import { TEMPLATE_CATEGORIES, isTemplateCategory } from "./categories";

it("exposes a fixed, non-empty category list", () => {
  expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
  expect(TEMPLATE_CATEGORIES).toContain("Survey");
  expect(TEMPLATE_CATEGORIES).toContain("Other");
});

it("narrows arbitrary strings to known categories", () => {
  expect(isTemplateCategory("Survey")).toBe(true);
  expect(isTemplateCategory("not-a-category")).toBe(false);
});
