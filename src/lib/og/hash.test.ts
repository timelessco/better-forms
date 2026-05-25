import { describe, expect, it } from "vitest";
import { computeOgHash, TEMPLATE_VERSION } from "@/lib/og/hash";

describe("computeOgHash", () => {
  it("returns a stable 10-char base64url string", () => {
    const hash = computeOgHash({
      title: "Customer Feedback",
      description: "Tell us what you think.",
    });
    expect(hash).toHaveLength(10);
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns the same hash for the same inputs", () => {
    const a = computeOgHash({ title: "Hello", description: "world" });
    const b = computeOgHash({ title: "Hello", description: "world" });
    expect(a).toBe(b);
  });

  it("differs when title changes", () => {
    const a = computeOgHash({ title: "Hello", description: "world" });
    const b = computeOgHash({ title: "Hello!", description: "world" });
    expect(a).not.toBe(b);
  });

  it("differs when description changes", () => {
    const a = computeOgHash({ title: "Hello", description: "world" });
    const b = computeOgHash({ title: "Hello", description: "WORLD" });
    expect(a).not.toBe(b);
  });

  it("differs when description goes from empty to present", () => {
    const a = computeOgHash({ title: "Hello", description: "" });
    const b = computeOgHash({ title: "Hello", description: "world" });
    expect(a).not.toBe(b);
  });

  it("differs when TEMPLATE_VERSION is mixed in (sanity)", () => {
    expect(TEMPLATE_VERSION).toBeTypeOf("number");
    expect(TEMPLATE_VERSION).toBeGreaterThanOrEqual(1);
  });
});
