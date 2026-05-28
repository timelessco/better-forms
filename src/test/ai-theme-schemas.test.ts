import { describe, expect, it } from "vitest";
import * as v from "valibot";
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
    expect(v.safeParse(freeThemeSchema, valid).success).toBeTruthy();
  });

  it("rejects an out-of-enum themeColor", () => {
    const result = v.safeParse(freeThemeSchema, { ...valid, themeColor: "magenta" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum baseColor (e.g. a theme color slipping in)", () => {
    const result = v.safeParse(freeThemeSchema, { ...valid, baseColor: "blue" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum radius", () => {
    const result = v.safeParse(freeThemeSchema, { ...valid, radius: "round" });
    expect(result.success).toBeFalsy();
  });

  it("rejects an out-of-enum defaultMode", () => {
    const result = v.safeParse(freeThemeSchema, { ...valid, defaultMode: "auto" });
    expect(result.success).toBeFalsy();
  });

  it("rejects when any of the five required fields is missing", () => {
    for (const key of Object.keys(valid)) {
      const partial = { ...valid } as Record<string, unknown>;
      delete partial[key];
      expect(v.safeParse(freeThemeSchema, partial).success).toBeFalsy();
    }
  });

  it("accepts any non-empty string for font (Google Fonts catalog is open)", () => {
    expect(
      v.safeParse(freeThemeSchema, { ...valid, font: "Playfair Display" }).success,
    ).toBeTruthy();
    expect(v.safeParse(freeThemeSchema, { ...valid, font: "JetBrains Mono" }).success).toBeTruthy();
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
    expect(v.safeParse(themeTokensSchema, fullTokens).success).toBeTruthy();
  });

  it("rejects a partial payload (15 keys missing)", () => {
    const half: Record<string, string> = {};
    for (const key of AI_THEME_TOKEN_KEYS) {
      half[`light:${key}`] = "#ffffff";
    }
    expect(v.safeParse(themeTokensSchema, half).success).toBeFalsy();
  });

  it("rejects a payload missing a single required key", () => {
    const missingOne = { ...fullTokens };
    delete (missingOne as Record<string, unknown>)["light:primary"];
    expect(v.safeParse(themeTokensSchema, missingOne).success).toBeFalsy();
  });

  it("rejects a payload with non-string token values", () => {
    const badType = { ...fullTokens, "light:primary": 123 } as unknown;
    expect(v.safeParse(themeTokensSchema, badType).success).toBeFalsy();
  });
});
