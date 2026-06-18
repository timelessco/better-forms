import { describe, expect, it } from "vitest";
import { defaultFormSettings, sanitizeFormSettings } from "@/types/form-settings";

// The Settings page "Save" sends the whole draft settings blob to the server; sanitizeFormSettings
// is the trust boundary — it must keep only known keys and never coerce a real value to a default.
describe("sanitizeFormSettings", () => {
  it("drops unknown keys not in the settings schema", () => {
    const result = sanitizeFormSettings({ language: "French", __evil: "x", extra: 1 });
    expect(result).not.toHaveProperty("__evil");
    expect(result).not.toHaveProperty("extra");
    expect(result.language).toBe("French");
  });

  it("preserves an explicit false/null without falling back to the default", () => {
    // branding defaults to true; a user turning it off must stay off (regression guard against `?? default`).
    const result = sanitizeFormSettings({ branding: false, dataRetentionDate: null });
    expect(result.branding).toBe(false);
    expect(result.dataRetentionDate).toBeNull();
  });

  it("fills missing keys from defaults", () => {
    const result = sanitizeFormSettings({ language: "Spanish" });
    expect(result.branding).toBe(defaultFormSettings.branding);
    expect(result.redirectOnCompletion).toBe(defaultFormSettings.redirectOnCompletion);
    expect(Object.keys(result).sort()).toEqual(Object.keys(defaultFormSettings).sort());
  });

  it("rejects wrong-typed values and falls back to the default", () => {
    // A hand-crafted request can send any JSON past the v.any() input validator; the type guard
    // must drop wrong-typed values so e.g. `count >= maxSubmissions` never compares against a string.
    const result = sanitizeFormSettings({
      maxSubmissions: "abc",
      branding: "yes",
      dataRetentionDays: "10",
      presentationMode: "carousel",
    });
    expect(result.maxSubmissions).toBe(defaultFormSettings.maxSubmissions);
    expect(result.branding).toBe(defaultFormSettings.branding);
    expect(result.dataRetentionDays).toBe(defaultFormSettings.dataRetentionDays);
    expect(result.presentationMode).toBe(defaultFormSettings.presentationMode);
  });

  it("keeps valid explicit values of the right type", () => {
    const result = sanitizeFormSettings({
      maxSubmissions: 100,
      presentationMode: "field-by-field",
    });
    expect(result.maxSubmissions).toBe(100);
    expect(result.presentationMode).toBe("field-by-field");
  });

  it("carries the settings-page schedule/retention fields", () => {
    const result = sanitizeFormSettings({
      partialSubmissions: true,
      timezone: "GMT +05:30",
      dataRetentionDate: "2026-08-09",
      dataRetentionTime: "16:30",
      closeTime: "18:00",
    });
    expect(result.partialSubmissions).toBe(true);
    expect(result.timezone).toBe("GMT +05:30");
    expect(result.dataRetentionDate).toBe("2026-08-09");
    expect(result.dataRetentionTime).toBe("16:30");
    expect(result.closeTime).toBe("18:00");
  });
});
