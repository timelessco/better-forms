import { describe, expect, it } from "vitest";
import { STALE_CUSTOMIZATION_KEYS, migrateCustomization } from "@/lib/theme/customization-migrate";

describe("migrateCustomization", () => {
  it("strips stale coverFit but keeps other keys", () => {
    expect(migrateCustomization({ coverFit: "contain", titleFontSize: "20px" })).toEqual({
      titleFontSize: "20px",
    });
  });

  it("returns {} for null and undefined", () => {
    expect(migrateCustomization(null)).toEqual({});
    expect(migrateCustomization(undefined)).toEqual({});
  });

  it("leaves a clean object's content unchanged", () => {
    const clean = { titleFontSize: "20px", pageWidth: "640px" };
    expect(migrateCustomization(clean)).toEqual(clean);
  });

  it("does not mutate its input", () => {
    const input = { coverFit: "contain", pageWidth: "640px" };
    migrateCustomization(input);
    expect(input).toEqual({ coverFit: "contain", pageWidth: "640px" });
  });

  it("is idempotent", () => {
    const input = { coverFit: "contain", titleFontSize: "20px" };
    const once = migrateCustomization(input);
    expect(migrateCustomization(once)).toEqual(once);
  });

  it("strips every declared stale key", () => {
    const withStale = Object.fromEntries(STALE_CUSTOMIZATION_KEYS.map((k) => [k, "x"]));
    expect(migrateCustomization({ ...withStale, keep: "yes" })).toEqual({ keep: "yes" });
  });

  it("promotes legacy light:customCss to the global customCss key", () => {
    expect(migrateCustomization({ "light:customCss": ".bf-themed{color:red}" })).toEqual({
      customCss: ".bf-themed{color:red}",
    });
  });

  it("promotes legacy dark:customCss when light is absent", () => {
    expect(migrateCustomization({ "dark:customCss": ".bf-themed{color:blue}" })).toEqual({
      customCss: ".bf-themed{color:blue}",
    });
  });

  it("prefers light:customCss over dark and drops both prefixed keys", () => {
    expect(migrateCustomization({ "light:customCss": "L", "dark:customCss": "D" })).toEqual({
      customCss: "L",
    });
  });

  it("keeps an existing bare customCss over legacy prefixed keys", () => {
    expect(
      migrateCustomization({ customCss: "BARE", "light:customCss": "L", "dark:customCss": "D" }),
    ).toEqual({ customCss: "BARE" });
  });

  it("is idempotent on legacy CSS promotion", () => {
    const once = migrateCustomization({ "light:customCss": "L" });
    expect(migrateCustomization(once)).toEqual(once);
  });
});
