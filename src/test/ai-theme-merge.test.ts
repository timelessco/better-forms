import { describe, expect, it } from "vitest";
import {
  mergeSetThemeOpIntoCustomization,
  mergeThemeIntoCustomization,
} from "@/lib/editor/merge-theme";
import type { SetThemeOp } from "@/lib/ai/ops-schema";

// What the FREE setFormThemeFree tool returns (server already flattened it).
const freeThemePayload = {
  themeColor: "blue",
  baseColor: "neutral",
  font: "Inter",
  radius: "medium",
  defaultMode: "system",
};

// What the PRO setFormTheme tool returns (server already flattened it).
const proThemePayload = {
  "light:background": "#ffffff",
  "light:foreground": "#0a0a0a",
  "light:primary": "#2563eb",
  "dark:background": "#0a0a0a",
  "dark:foreground": "#fafafa",
  "dark:primary": "#3b82f6",
  font: "Inter",
  radius: "medium",
};

describe("mergeThemeIntoCustomization (theme-mode optimistic write)", () => {
  it("merges a free-tier theme into an empty customization without triggering the Pro gate", () => {
    const merged = mergeThemeIntoCustomization({}, freeThemePayload);

    // Every free-tool key lands in customization, plus the preset marker flipping the selector to "custom".
    expect(merged).toMatchObject({
      ...freeThemePayload,
      preset: "custom",
    });
  });

  it("merges a free-tier theme on top of an existing free preset without triggering the Pro gate", () => {
    const merged = mergeThemeIntoCustomization(
      { preset: "mira", themeColor: "zinc" },
      freeThemePayload,
    );

    // Theme overrides existing themeColor; preset is rewritten to "custom".
    expect(merged.themeColor).toBe("blue");
    expect(merged.preset).toBe("custom");
  });

  it("merges a Pro-tier theme — light/dark token overrides land in customization", () => {
    // Customization is no longer a draft-write gate (soft Pro gate strips at publish instead).
    const merged = mergeThemeIntoCustomization({}, proThemePayload);
    expect(merged["light:primary"]).toBe("#2563eb");
    expect(merged["dark:primary"]).toBe("#3b82f6");
  });

  it("strips stale Pro-tier keys when merging a free-tier theme (no key carry-over)", () => {
    // Ex-Pro (or stale org.plan) may have light:/dark: tokens; free-tier write must not drag them forward or the optimistic update hits the server Pro gate.
    const merged = mergeThemeIntoCustomization(
      {
        "light:primary": "#abcdef",
        "dark:primary": "#123456",
        customCss: ".x {}",
        themeColor: "zinc",
      },
      freeThemePayload,
    );

    expect(merged["light:primary"]).toBeUndefined();
    expect(merged["dark:primary"]).toBeUndefined();
    expect(merged.customCss).toBeUndefined();
  });

  it("after stripping stale Pro keys on a free-tier merge, only free keys remain", () => {
    const merged = mergeThemeIntoCustomization(
      { "light:primary": "#abcdef", customCss: ".x {}", themeColor: "zinc" },
      freeThemePayload,
    );

    // New theme is applied, preset flipped to custom; no Pro-tier keys survive the strip.
    expect(merged.themeColor).toBe("blue");
    expect(merged.preset).toBe("custom");
    expect(Object.keys(merged).some((k) => k.includes(":") || k === "customCss")).toBeFalsy();
  });

  it("keeps existing Pro-tier keys when merging a Pro-tier theme (Pro users retain their full customization)", () => {
    // Pro path emits light:/dark: tokens; merging onto existing light: keys (Pro steady state) must preserve/overwrite them, not strip.
    const merged = mergeThemeIntoCustomization(
      { "light:secondary": "#eeeeee", titleFont: "Lora" },
      proThemePayload,
    );

    expect(merged["light:secondary"]).toBe("#eeeeee");
    expect(merged.titleFont).toBe("Lora");
    expect(merged["light:primary"]).toBe("#2563eb");
    expect(merged.preset).toBe("custom");
  });
});

describe("streaming-path / theme-mode parity (backwards compat after refactor)", () => {
  it("a streaming SetThemeOp with full Pro tokens produces the same customization as the theme-mode Pro path", () => {
    // Streaming SetThemeOp { tokens, font, radius } vs theme-mode's pre-flattened { ...tokens, font, radius } must merge to identical records — no field drift between paths.
    const tokens: Record<string, string> = {
      "light:primary": "#2563eb",
      "dark:primary": "#3b82f6",
      "light:background": "#ffffff",
      "dark:background": "#0a0a0a",
    };
    const op: SetThemeOp = {
      type: "set-theme",
      tokens,
      font: "Inter",
      radius: "medium",
    };

    const fromStreamingPath = mergeSetThemeOpIntoCustomization({}, op);
    const fromThemeModePath = mergeThemeIntoCustomization(
      {},
      {
        ...tokens,
        font: "Inter",
        radius: "medium",
      },
    );

    expect(fromStreamingPath).toStrictEqual(fromThemeModePath);
  });

  it("a streaming SetThemeOp with only font set still produces the same shape as the theme-mode path with the same single field", () => {
    const op: SetThemeOp = { type: "set-theme", font: "Lora" };

    const fromStreamingPath = mergeSetThemeOpIntoCustomization({}, op);
    const fromThemeModePath = mergeThemeIntoCustomization({}, { font: "Lora" });

    expect(fromStreamingPath).toStrictEqual(fromThemeModePath);
  });

  it("preserves prior free-tier customization (themeColor) across both paths identically when the new payload is free-tier", () => {
    // Free-tier theme: both paths preserve free keys from `current`. (Theme-mode also strips non-free keys; streaming doesn't plan-branch — divergence tested above.)
    const op: SetThemeOp = { type: "set-theme", radius: "large" };

    const current = { themeColor: "rose" };
    const fromStreamingPath = mergeSetThemeOpIntoCustomization(current, op);
    const fromThemeModePath = mergeThemeIntoCustomization(current, { radius: "large" });

    expect(fromStreamingPath).toStrictEqual(fromThemeModePath);
    expect(fromStreamingPath.themeColor).toBe("rose");
  });
});

describe("mergeSetThemeOpIntoCustomization (streaming AI path → set-theme op)", () => {
  it("applies tokens, font, and radius from a SetThemeOp", () => {
    const op: SetThemeOp = {
      type: "set-theme",
      tokens: { "light:primary": "#2563eb", "dark:primary": "#3b82f6" },
      font: "Poppins",
      radius: "large",
    };
    const merged = mergeSetThemeOpIntoCustomization({}, op);

    expect(merged["light:primary"]).toBe("#2563eb");
    expect(merged["dark:primary"]).toBe("#3b82f6");
    expect(merged.font).toBe("Poppins");
    expect(merged.radius).toBe("large");
    expect(merged.preset).toBe("custom");
  });

  it("preserves existing customization keys not overridden by the op", () => {
    const op: SetThemeOp = {
      type: "set-theme",
      font: "Inter",
    };
    const merged = mergeSetThemeOpIntoCustomization({ themeColor: "blue", titleFont: "Lora" }, op);

    expect(merged.themeColor).toBe("blue");
    expect(merged.titleFont).toBe("Lora");
    expect(merged.font).toBe("Inter");
    expect(merged.preset).toBe("custom");
  });

  it("is a no-op on customization keys when the op carries no fields (still marks preset='custom')", () => {
    const op: SetThemeOp = { type: "set-theme" };
    const merged = mergeSetThemeOpIntoCustomization({ font: "Lora" }, op);

    // Existing keys preserved, preset upgraded.
    expect(merged.font).toBe("Lora");
    expect(merged.preset).toBe("custom");
  });

  it("does not write radius/font when op fields are undefined", () => {
    const op: SetThemeOp = {
      type: "set-theme",
      tokens: { "light:primary": "#000" },
    };
    const merged = mergeSetThemeOpIntoCustomization({}, op);

    expect(merged["light:primary"]).toBe("#000");
    expect(merged.font).toBeUndefined();
    expect(merged.radius).toBeUndefined();
  });
});
