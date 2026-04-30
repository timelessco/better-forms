import { describe, expect, it } from "vitest";
import { freeThemeSchema, themeTokensSchema, AI_THEME_TOKEN_KEYS } from "@/lib/ai/ops-schema";

describe("freeThemeSchema", () => {
  const valid = {
    themeColor: "blue",
    baseColor: "neutral",
    font: "Inter",
    radius: "medium",
    defaultMode: "system",
  };

  it("accepts a fully valid payload", () => {
    expect(freeThemeSchema.safeParse(valid).success).toBeTruthy();
  });

  it("rejects an out-of-enum themeColor", () => {
    const result = freeThemeSchema.safeParse({ ...valid, themeColor: "magenta" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum baseColor (e.g. a theme color slipping in)", () => {
    const result = freeThemeSchema.safeParse({ ...valid, baseColor: "blue" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum radius", () => {
    const result = freeThemeSchema.safeParse({ ...valid, radius: "round" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum defaultMode", () => {
    const result = freeThemeSchema.safeParse({ ...valid, defaultMode: "auto" });
    expect(result.success).toBeFalsy();
  });

  it("rejects when any of the five required fields is missing", () => {
    for (const key of Object.keys(valid)) {
      const partial = { ...valid } as Record<string, unknown>;
      delete partial[key];
      expect(freeThemeSchema.safeParse(partial).success).toBeFalsy();
    }
  });

  it("accepts any non-empty string for font (Google Fonts catalog is open)", () => {
    expect(freeThemeSchema.safeParse({ ...valid, font: "Playfair Display" }).success).toBeTruthy();
    expect(freeThemeSchema.safeParse({ ...valid, font: "JetBrains Mono" }).success).toBeTruthy();
  });
});

describe("themeTokensSchema", () => {
  const fullTokens = (() => {
    const out: Record<string, string> = {};
    for (const key of AI_THEME_TOKEN_KEYS) {
      out[`light:${key}`] = "#ffffff";
      out[`dark:${key}`] = "#000000";
    }
    return out;
  })();

  it("accepts a fully populated 30-key payload", () => {
    expect(themeTokensSchema.safeParse(fullTokens).success).toBeTruthy();
  });

  it("rejects a partial payload (15 keys missing)", () => {
    const half: Record<string, string> = {};
    for (const key of AI_THEME_TOKEN_KEYS) {
      half[`light:${key}`] = "#ffffff";
    }
    expect(themeTokensSchema.safeParse(half).success).toBeFalsy();
  });

  it("rejects a payload missing a single required key", () => {
    const missingOne = { ...fullTokens };
    delete (missingOne as Record<string, unknown>)["light:primary"];
    expect(themeTokensSchema.safeParse(missingOne).success).toBeFalsy();
  });

  it("rejects a payload with non-string token values", () => {
    const badType = { ...fullTokens, "light:primary": 123 } as unknown;
    expect(themeTokensSchema.safeParse(badType).success).toBeFalsy();
  });
});
