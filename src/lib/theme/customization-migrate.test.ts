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
});
