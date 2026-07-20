import { describe, expect, it } from "vitest";
import { generateDualThemeCss, generateThemeCss } from "@/lib/theme/generate-theme-css";

describe("custom CSS injection", () => {
  it("wraps bare variable declarations in the .bf-themed scope", () => {
    const css = generateThemeCss({ customCss: "--bf-block-margin: 40px;" });
    expect(css).toContain("/* Custom CSS (scoped to the form) */");
    expect(css).toContain(".bf-themed {\n--bf-block-margin: 40px;\n}");
  });

  it("emits the custom block AFTER the generated vars so overrides win on cascade order", () => {
    const css = generateThemeCss({ customCss: "--bf-title-letter-spacing: -0.02em;" });
    const generatedIdx = css.indexOf("--bf-title-letter-spacing: -0.03em");
    const overrideIdx = css.indexOf("--bf-title-letter-spacing: -0.02em");
    expect(generatedIdx).toBeGreaterThanOrEqual(0);
    expect(overrideIdx).toBeGreaterThan(generatedIdx);
  });

  it("scopes custom CSS in the dual-theme output too", () => {
    const css = generateDualThemeCss({ customCss: "--bf-option-gap: 8px;" });
    expect(css).toContain(".bf-themed {\n--bf-option-gap: 8px;\n}");
  });

  it("applies legacy mode-prefixed custom CSS via the migration (promoted + wrapped)", () => {
    const css = generateDualThemeCss({ "light:customCss": "--bf-field-gap: 20px;" });
    expect(css).toContain(".bf-themed {\n--bf-field-gap: 20px;\n}");
  });

  it("omits the custom block when no custom CSS is set", () => {
    const css = generateThemeCss({ preset: "vega" });
    expect(css).not.toContain("Custom CSS");
  });
});
