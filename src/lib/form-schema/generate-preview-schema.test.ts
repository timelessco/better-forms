import { describe, expect, it } from "vitest";

import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import {
  generateDefaultValuesFromFields,
  generateZodSchemaFromFields,
} from "./generate-preview-schema";

describe("generateZodSchemaFromFields - Date / Time required", () => {
  it("rejects empty Date when required", () => {
    const fields: PlateFormField[] = [{ id: "d", name: "d", fieldType: "Date", required: true }];
    const schema = generateZodSchemaFromFields(fields);
    const result = schema.safeParse({ d: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty Time when required", () => {
    const fields: PlateFormField[] = [{ id: "t", name: "t", fieldType: "Time", required: true }];
    const schema = generateZodSchemaFromFields(fields);
    const result = schema.safeParse({ t: "" });
    expect(result.success).toBe(false);
  });

  it("accepts empty Date when not required", () => {
    const fields: PlateFormField[] = [{ id: "d", name: "d", fieldType: "Date", required: false }];
    const schema = generateZodSchemaFromFields(fields);
    const result = schema.safeParse({ d: "" });
    expect(result.success).toBe(true);
  });

  it("rejects Number below min when required", () => {
    const fields: PlateFormField[] = [
      { id: "n", name: "n", fieldType: "Number", required: true, min: 3, max: 4 },
    ];
    const schema = generateZodSchemaFromFields(fields);
    expect(schema.safeParse({ n: 2 }).success).toBe(false);
    expect(schema.safeParse({ n: 3 }).success).toBe(true);
    expect(schema.safeParse({ n: 5 }).success).toBe(false);
  });

  it("rejects empty string for required Number (regression: Number('') is 0)", () => {
    const fields: PlateFormField[] = [
      { id: "n", name: "n", fieldType: "Number", required: true, min: 3, max: 12 },
    ];
    const schema = generateZodSchemaFromFields(fields);
    expect(schema.safeParse({ n: "" }).success).toBe(false);
    expect(schema.safeParse({ n: "5" }).success).toBe(true);
    expect(schema.safeParse({ n: "20" }).success).toBe(false);
  });
});

describe("generateZodSchemaFromFields - repeatable", () => {
  const emailArr = (required: boolean): PlateFormField[] => [
    { id: "e", name: "e", fieldType: "Email", required, isFieldArray: true },
  ];

  it("required email array rejects when all items empty", () => {
    const schema = generateZodSchemaFromFields(emailArr(true));
    expect(schema.safeParse({ e: [""] }).success).toBe(false);
  });

  it("required email array accepts one valid item (ignores trailing empty)", () => {
    const schema = generateZodSchemaFromFields(emailArr(true));
    expect(schema.safeParse({ e: ["a@b.com", ""] }).success).toBe(true);
  });

  it("rejects a malformed item even among valid ones", () => {
    const schema = generateZodSchemaFromFields(emailArr(true));
    expect(schema.safeParse({ e: ["a@b.com", "not-an-email"] }).success).toBe(false);
  });

  it("optional array passes when entirely empty", () => {
    const schema = generateZodSchemaFromFields(emailArr(false));
    expect(schema.safeParse({ e: [""] }).success).toBe(true);
    expect(schema.safeParse({ e: [] }).success).toBe(true);
  });

  it("number array validates each item against min/max", () => {
    const fields: PlateFormField[] = [
      {
        id: "n",
        name: "n",
        fieldType: "Number",
        required: true,
        min: 1,
        max: 10,
        isFieldArray: true,
      },
    ];
    const schema = generateZodSchemaFromFields(fields);
    expect(schema.safeParse({ n: ["5", "9"] }).success).toBe(true);
    expect(schema.safeParse({ n: ["5", "99"] }).success).toBe(false);
  });
});

describe("generateDefaultValuesFromFields - repeatable", () => {
  it("defaults a repeatable scalar field to one empty item", () => {
    const fields: PlateFormField[] = [
      { id: "e", name: "e", fieldType: "Email", required: true, isFieldArray: true },
    ];
    expect(generateDefaultValuesFromFields(fields)).toEqual({ e: [""] });
  });

  it("seeds the configured defaultValue as the single item", () => {
    const fields: PlateFormField[] = [
      { id: "i", name: "i", fieldType: "Input", isFieldArray: true, defaultValue: "hello" },
    ];
    expect(generateDefaultValuesFromFields(fields)).toEqual({ i: ["hello"] });
  });

  it("non-repeatable scalar still defaults to a string", () => {
    const fields: PlateFormField[] = [{ id: "i", name: "i", fieldType: "Input" }];
    expect(generateDefaultValuesFromFields(fields)).toEqual({ i: "" });
  });
});
