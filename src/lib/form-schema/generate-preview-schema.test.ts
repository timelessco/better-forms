import { describe, expect, it } from "vitest";
import * as v from "valibot";

import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { generateZodSchemaFromFields } from "./generate-preview-schema";

describe("generateZodSchemaFromFields - Date / Time required", () => {
  it("rejects empty Date when required", () => {
    const fields: PlateFormField[] = [{ id: "d", name: "d", fieldType: "Date", required: true }];
    const schema = generateZodSchemaFromFields(fields);
    const result = v.safeParse(schema, { d: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty Time when required", () => {
    const fields: PlateFormField[] = [{ id: "t", name: "t", fieldType: "Time", required: true }];
    const schema = generateZodSchemaFromFields(fields);
    const result = v.safeParse(schema, { t: "" });
    expect(result.success).toBe(false);
  });

  it("accepts empty Date when not required", () => {
    const fields: PlateFormField[] = [{ id: "d", name: "d", fieldType: "Date", required: false }];
    const schema = generateZodSchemaFromFields(fields);
    const result = v.safeParse(schema, { d: "" });
    expect(result.success).toBe(true);
  });

  it("rejects Number below min when required", () => {
    const fields: PlateFormField[] = [
      { id: "n", name: "n", fieldType: "Number", required: true, min: 3, max: 4 },
    ];
    const schema = generateZodSchemaFromFields(fields);
    expect(v.safeParse(schema, { n: 2 }).success).toBe(false);
    expect(v.safeParse(schema, { n: 3 }).success).toBe(true);
    expect(v.safeParse(schema, { n: 5 }).success).toBe(false);
  });

  it("rejects empty string for required Number (regression: Number('') is 0)", () => {
    const fields: PlateFormField[] = [
      { id: "n", name: "n", fieldType: "Number", required: true, min: 3, max: 12 },
    ];
    const schema = generateZodSchemaFromFields(fields);
    expect(v.safeParse(schema, { n: "" }).success).toBe(false);
    expect(v.safeParse(schema, { n: "5" }).success).toBe(true);
    expect(v.safeParse(schema, { n: "20" }).success).toBe(false);
  });
});
