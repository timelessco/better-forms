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

  it("accepts null for optional fields (regression: AI Chat records skips as null)", () => {
    const fields: PlateFormField[] = [
      { id: "m", name: "m", fieldType: "MultiSelect", required: false, options: [] },
      { id: "f", name: "f", fieldType: "FileUpload", required: false },
      { id: "t", name: "t", fieldType: "Input", required: false },
    ] as PlateFormField[];
    const schema = generateZodSchemaFromFields(fields);
    expect(v.safeParse(schema, { m: null, f: null, t: null }).success).toBe(true);
  });

  it("still rejects null for a required array field", () => {
    const fields: PlateFormField[] = [
      { id: "m", name: "m", fieldType: "MultiSelect", required: true, options: [] },
    ] as PlateFormField[];
    const schema = generateZodSchemaFromFields(fields);
    expect(v.safeParse(schema, { m: null }).success).toBe(false);
  });
});
