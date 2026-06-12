import { describe, expect, it } from "vitest";
import {
  getProCustomizationSections,
  proSectionForKey,
  stripProCustomization,
} from "@/lib/theme/pro-customization";

describe("proSectionForKey", () => {
  it("classifies pro keys to their sections", () => {
    expect(proSectionForKey("titleFont")).toBe("Typography");
    expect(proSectionForKey("textAlign")).toBe("Typography");
    expect(proSectionForKey("light:primary")).toBe("Colors");
    expect(proSectionForKey("dark:title-color")).toBe("Colors");
    expect(proSectionForKey("foreground")).toBe("Colors"); // legacy unprefixed token
    expect(proSectionForKey("inputRadius")).toBe("Inputs");
    expect(proSectionForKey("buttonHeight")).toBe("Buttons");
    expect(proSectionForKey("customCss")).toBe("Custom CSS");
    expect(proSectionForKey("dark:customCss")).toBe("Custom CSS");
  });

  it("leaves free (Appearance/preset) keys ungated", () => {
    for (const key of [
      "pageWidth",
      "coverWidth",
      "coverRadius",
      "logoRadius",
      "logoWidth",
      "defaultMode",
      "preset",
      "baseColor",
      "themeColor",
      "radius",
      "spacing",
      // `font` (body font family) is a FREE_CUSTOMIZATION_KEYS basic Theme control — must NOT be
      // classified Pro, else free users (incl. AI free-tier theming) lose their font on publish.
      "font",
    ]) {
      expect(proSectionForKey(key)).toBeNull();
    }
  });

  it("keeps the title font and body sizing/spacing Pro (only body `font` is free)", () => {
    expect(proSectionForKey("titleFont")).toBe("Typography");
    expect(proSectionForKey("baseFontSize")).toBe("Typography");
    expect(proSectionForKey("letterSpacing")).toBe("Typography");
  });
});

describe("getProCustomizationSections", () => {
  it("returns ordered labels for active pro values only", () => {
    expect(
      getProCustomizationSections({
        buttonRadius: "8",
        titleFont: "Inter",
        pageWidth: "80%",
        foreground: "", // mode-migration leftover — inactive
      }),
    ).toEqual(["Typography", "Buttons"]);
  });

  it("handles null/empty customization", () => {
    expect(getProCustomizationSections(null)).toEqual([]);
    expect(getProCustomizationSections({})).toEqual([]);
  });
});

describe("stripProCustomization", () => {
  it("removes pro keys, keeps free keys", () => {
    expect(
      stripProCustomization({
        pageWidth: "80%",
        preset: "custom",
        titleFont: "Inter",
        "light:primary": "#ff0000",
        inputHeight: "40",
        customCss: ".x{}",
        defaultMode: "dark",
      }),
    ).toEqual({ pageWidth: "80%", preset: "custom", defaultMode: "dark" });
  });

  it("is identity for pro-free customization", () => {
    const free = { pageWidth: "70%", coverRadius: "12" };
    expect(stripProCustomization(free)).toEqual(free);
    expect(stripProCustomization(null)).toEqual({});
  });
});
