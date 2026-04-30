import { describe, expect, it } from "vitest";
import {
  flattenFreeThemeArgs,
  flattenProThemeArgs,
  pickThemePromptForPlan,
} from "@/lib/ai/theme-route-helpers";
import { FORM_THEME_FREE_SYSTEM_PROMPT, FORM_THEME_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { AI_THEME_TOKEN_KEYS } from "@/lib/ai/ops-schema";

describe("pickThemePromptForPlan", () => {
  it("uses the full Pro prompt + setFormTheme tool for plan='pro'", () => {
    const picked = pickThemePromptForPlan("pro");
    expect(picked.prompt).toBe(FORM_THEME_SYSTEM_PROMPT);
    expect(picked.toolName).toBe("setFormTheme");
    expect(picked.isPro).toBeTruthy();
  });

  it("uses the full Pro prompt + setFormTheme tool for plan='business'", () => {
    const picked = pickThemePromptForPlan("business");
    expect(picked.prompt).toBe(FORM_THEME_SYSTEM_PROMPT);
    expect(picked.toolName).toBe("setFormTheme");
    expect(picked.isPro).toBeTruthy();
  });

  it("uses the limited Free prompt + setFormThemeFree tool for plan='free'", () => {
    const picked = pickThemePromptForPlan("free");
    expect(picked.prompt).toBe(FORM_THEME_FREE_SYSTEM_PROMPT);
    expect(picked.toolName).toBe("setFormThemeFree");
    expect(picked.isPro).toBeFalsy();
  });

  it("falls through to free for an unknown plan string (safer to gate down)", () => {
    const picked = pickThemePromptForPlan("enterprise" as never);
    expect(picked.prompt).toBe(FORM_THEME_FREE_SYSTEM_PROMPT);
    expect(picked.toolName).toBe("setFormThemeFree");
    expect(picked.isPro).toBeFalsy();
  });
});

describe("flattenProThemeArgs", () => {
  it("returns a flat dict containing every token plus font and radius", () => {
    const tokens: Record<string, string> = {};
    for (const key of AI_THEME_TOKEN_KEYS) {
      tokens[`light:${key}`] = "#ffffff";
      tokens[`dark:${key}`] = "#000000";
    }
    const flat = flattenProThemeArgs({ tokens, font: "Inter", radius: "medium" });

    // 30 token keys + font + radius = 32 keys
    expect(Object.keys(flat)).toHaveLength(AI_THEME_TOKEN_KEYS.length * 2 + 2);
    expect(flat.font).toBe("Inter");
    expect(flat.radius).toBe("medium");
    expect(flat["light:primary"]).toBe("#ffffff");
    expect(flat["dark:primary"]).toBe("#000000");
  });

  it("does not introduce free-only keys (themeColor / baseColor / defaultMode)", () => {
    const tokens: Record<string, string> = {};
    for (const key of AI_THEME_TOKEN_KEYS) {
      tokens[`light:${key}`] = "#fff";
      tokens[`dark:${key}`] = "#000";
    }
    const flat = flattenProThemeArgs({ tokens, font: "Inter", radius: "small" });
    expect(flat.themeColor).toBeUndefined();
    expect(flat.baseColor).toBeUndefined();
    expect(flat.defaultMode).toBeUndefined();
  });
});

describe("flattenFreeThemeArgs", () => {
  it("returns exactly themeColor, baseColor, font, radius, defaultMode", () => {
    const flat = flattenFreeThemeArgs({
      themeColor: "blue",
      baseColor: "neutral",
      font: "Inter",
      radius: "medium",
      defaultMode: "system",
    });

    expect(Object.keys(flat).toSorted()).toStrictEqual(
      ["baseColor", "defaultMode", "font", "radius", "themeColor"].toSorted(),
    );
  });

  it("does not introduce Pro-only keys (light:* / dark:*)", () => {
    const flat = flattenFreeThemeArgs({
      themeColor: "rose",
      baseColor: "stone",
      font: "Lora",
      radius: "large",
      defaultMode: "light",
    });

    for (const key of Object.keys(flat)) {
      expect(key.startsWith("light:")).toBeFalsy();
      expect(key.startsWith("dark:")).toBeFalsy();
    }
  });
});
