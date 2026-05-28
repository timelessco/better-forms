/** Build a valibot schema from Plate-node validation props for preview-mode validation. */
import { isValidPhoneNumber } from "react-phone-number-input";
import * as v from "valibot";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

// Re-export alias kept for callers — name stays stable even though impl is valibot.
type AnyValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** Strict per-item validator for a repeatable scalar field. Every item must be
 * a valid non-empty value of the field's type. Branches inline rather than
 * accumulating into an array because valibot's v.pipe is strongly typed and
 * spread arrays of mixed PipeItems don't satisfy its generics. */
const buildArrayItemSchema = (field: PlateFormField): AnyValibotSchema => {
  switch (field.fieldType) {
    case "Email":
      return v.pipe(
        v.string(),
        v.nonEmpty("This field is required"),
        v.email("Please enter a valid email address"),
      );
    case "Link": {
      const urlRegex = /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/;
      return v.pipe(
        v.string(),
        v.nonEmpty("This field is required"),
        v.regex(urlRegex, "Please enter a valid URL"),
      );
    }
    case "Number": {
      // Coerce string/number → number, guard "" → undefined (Number("")===0 would pass otherwise).
      const coerceNum = (val: unknown): number | undefined => {
        if (val === "" || val === null || val === undefined) return undefined;
        return Number(val);
      };
      const base = v.pipe(
        v.unknown(),
        v.transform(coerceNum),
        v.number("Please enter a valid number") as unknown as v.TransformAction<unknown, number>,
      );
      const intCheck = v.integer("Decimals are not allowed");
      const minMsg = (min: number) => `Value must be at least ${min}`;
      const maxMsg = (max: number) => `Value must be at most ${max}`;
      const noInt = field.allowDecimals !== false;
      if (typeof field.min === "number" && typeof field.max === "number") {
        return noInt
          ? v.pipe(
              base,
              v.minValue(field.min, minMsg(field.min)),
              v.maxValue(field.max, maxMsg(field.max)),
            )
          : v.pipe(
              base,
              intCheck,
              v.minValue(field.min, minMsg(field.min)),
              v.maxValue(field.max, maxMsg(field.max)),
            );
      }
      if (typeof field.min === "number") {
        return noInt
          ? v.pipe(base, v.minValue(field.min, minMsg(field.min)))
          : v.pipe(base, intCheck, v.minValue(field.min, minMsg(field.min)));
      }
      if (typeof field.max === "number") {
        return noInt
          ? v.pipe(base, v.maxValue(field.max, maxMsg(field.max)))
          : v.pipe(base, intCheck, v.maxValue(field.max, maxMsg(field.max)));
      }
      return noInt ? base : v.pipe(base, intCheck);
    }
    case "Phone":
      return v.pipe(
        v.string(),
        v.nonEmpty("This field is required"),
        v.check((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
      );
    case "Input":
    case "Textarea": {
      const hasMin = "minLength" in field && field.minLength;
      const hasMax = "maxLength" in field && field.maxLength;
      if (hasMin && hasMax) {
        return v.pipe(
          v.string(),
          v.nonEmpty("This field is required"),
          v.minLength(field.minLength!, `Minimum ${field.minLength} characters required`),
          v.maxLength(field.maxLength!, `Maximum ${field.maxLength} characters allowed`),
        );
      }
      if (hasMin) {
        return v.pipe(
          v.string(),
          v.nonEmpty("This field is required"),
          v.minLength(field.minLength!, `Minimum ${field.minLength} characters required`),
        );
      }
      if (hasMax) {
        return v.pipe(
          v.string(),
          v.nonEmpty("This field is required"),
          v.maxLength(field.maxLength!, `Maximum ${field.maxLength} characters allowed`),
        );
      }
      return v.pipe(v.string(), v.nonEmpty("This field is required"));
    }
    default:
      // Date, Time, and any fallback scalar: non-empty string.
      return v.pipe(v.string(), v.nonEmpty("This field is required"));
  }
};

/**
 * Valibot schema from PlateFormField[].
 * @param fields - form fields w/ validation props
 * @returns valibot object schema
 */
export const generateZodSchemaFromFields = (
  fields: PlateFormField[],
): v.ObjectSchema<v.ObjectEntries, undefined> => {
  const schemaShape: v.ObjectEntries = {};

  for (const field of fields) {
    // Skip Button fields - they don't have validation
    if (field.fieldType === "Button") {
      continue;
    }

    if ("isFieldArray" in field && field.isFieldArray) {
      // Required: validate every item strictly (so empty items each get their
      // own per-index "This field is required" error routed to <FieldError />
      // inside the item component). Optional: accept empty items via union;
      // only flag genuinely-malformed non-empty values.
      const strictItem = buildArrayItemSchema(field);
      const item = field.required
        ? strictItem
        : (v.union([v.literal(""), strictItem]) as AnyValibotSchema);
      const arraySchema: AnyValibotSchema = field.required
        ? v.pipe(v.array(item), v.nonEmpty("This field is required"))
        : v.array(item);
      schemaShape[field.name] = arraySchema;
      continue;
    }

    let fieldSchema: AnyValibotSchema;
    let isAlreadyOptional = false;

    switch (field.fieldType) {
      case "Email":
        fieldSchema = field.required
          ? v.pipe(
              v.string(),
              v.nonEmpty("This field is required"),
              v.email("Please enter a valid email address"),
            )
          : v.union([
              v.literal(""),
              v.pipe(v.string(), v.email("Please enter a valid email address")),
            ]);
        break;
      case "Link": {
        const urlRegex = /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/;
        fieldSchema = field.required
          ? v.pipe(
              v.string(),
              v.nonEmpty("This field is required"),
              v.regex(urlRegex, "Please enter a valid URL"),
            )
          : v.union([
              v.literal(""),
              v.pipe(v.string(), v.regex(urlRegex, "Please enter a valid URL")),
            ]);
        break;
      }
      case "Number": {
        // Coerce string/number → number, guard "" → undefined (Number("")===0 would pass without this).
        const coerceNum = (val: unknown): number | undefined => {
          if (val === "" || val === null || val === undefined) return undefined;
          return Number(val);
        };
        // Build number schema with optional int/min/max validations.
        const buildNumSchema = (): AnyValibotSchema => {
          const base = v.pipe(
            v.unknown(),
            v.transform(coerceNum),
            // Cast: transform output is number|undefined; number() rejects undefined — correct behavior.
            v.number("Please enter a valid number") as unknown as v.TransformAction<
              unknown,
              number
            >,
          );
          if (
            field.allowDecimals === false &&
            typeof field.min === "number" &&
            typeof field.max === "number"
          ) {
            return v.pipe(
              base,
              v.integer("Decimals are not allowed"),
              v.minValue(field.min, `Value must be at least ${field.min}`),
              v.maxValue(field.max, `Value must be at most ${field.max}`),
            );
          }
          if (field.allowDecimals === false && typeof field.min === "number") {
            return v.pipe(
              base,
              v.integer("Decimals are not allowed"),
              v.minValue(field.min, `Value must be at least ${field.min}`),
            );
          }
          if (field.allowDecimals === false && typeof field.max === "number") {
            return v.pipe(
              base,
              v.integer("Decimals are not allowed"),
              v.maxValue(field.max, `Value must be at most ${field.max}`),
            );
          }
          if (field.allowDecimals === false) {
            return v.pipe(base, v.integer("Decimals are not allowed"));
          }
          if (typeof field.min === "number" && typeof field.max === "number") {
            return v.pipe(
              base,
              v.minValue(field.min, `Value must be at least ${field.min}`),
              v.maxValue(field.max, `Value must be at most ${field.max}`),
            );
          }
          if (typeof field.min === "number") {
            return v.pipe(base, v.minValue(field.min, `Value must be at least ${field.min}`));
          }
          if (typeof field.max === "number") {
            return v.pipe(base, v.maxValue(field.max, `Value must be at most ${field.max}`));
          }
          return base;
        };
        const numSchema = buildNumSchema();
        fieldSchema = field.required
          ? numSchema
          : // Accept "" as literal pass-through; otherwise coerce+validate.
            v.union([v.literal(""), numSchema]);
        break;
      }
      case "Phone": {
        // PhoneInput emits E.164 (e.g. "+919360992440"). Validate format via
        // libphonenumber, not stale char-count limits from the old text UI.
        const phoneSchema = v.pipe(
          v.string(),
          v.check((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
        );
        fieldSchema = field.required
          ? v.pipe(
              v.string(),
              v.nonEmpty("This field is required"),
              v.check((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
            )
          : v.union([v.literal(""), phoneSchema]);
        break;
      }
      case "Date":
        fieldSchema = field.required
          ? v.pipe(v.string(), v.nonEmpty("Please select a date"))
          : v.optional(v.string());
        if (!field.required) isAlreadyOptional = true;
        break;
      case "Time":
        fieldSchema = field.required
          ? v.pipe(v.string(), v.nonEmpty("Please select a time"))
          : v.optional(v.string());
        if (!field.required) isAlreadyOptional = true;
        break;
      case "FileUpload": {
        const uploadedFileSchema = v.object({
          url: v.string(),
          name: v.string(),
          size: v.number(),
          type: v.string(),
        });
        fieldSchema = field.required
          ? v.pipe(
              uploadedFileSchema,
              v.check((val) => Boolean(val?.url && val.url.length > 0), "Please upload a file"),
            )
          : v.optional(v.union([v.literal(""), uploadedFileSchema]));
        if (!field.required) isAlreadyOptional = true;
        break;
      }
      case "Checkbox":
      case "MultiSelect":
        if (field.required) {
          fieldSchema = v.pipe(
            v.array(v.string()),
            v.nonEmpty("Please select at least one option"),
          );
        } else {
          fieldSchema = v.optional(v.array(v.string()), []);
          isAlreadyOptional = true;
        }
        break;
      case "MultiChoice":
        if (field.required) {
          fieldSchema = v.pipe(v.string(), v.minLength(1, "Please select an option"));
        } else {
          fieldSchema = v.optional(v.string(), "");
          isAlreadyOptional = true;
        }
        break;
      case "Ranking":
        if (field.required) {
          fieldSchema = v.pipe(v.array(v.string()), v.nonEmpty("Please rank the options"));
        } else {
          fieldSchema = v.optional(v.array(v.string()), []);
          isAlreadyOptional = true;
        }
        break;
      default: {
        // Input, Textarea, Phone, and other string-based types
        const pipes: v.MinLengthAction<string, number, string>[] = [];

        if ("minLength" in field && field.minLength !== undefined && field.minLength > 0) {
          pipes.push(
            v.minLength(field.minLength, `Minimum ${field.minLength} characters required`),
          );
        }

        // Required fields must have at least 1 character
        if (field.required && !("minLength" in field && field.minLength !== undefined)) {
          pipes.push(v.minLength(1, "This field is required"));
        }

        const maxPipes: v.MaxLengthAction<string, number, string>[] = [];
        if ("maxLength" in field && field.maxLength !== undefined && field.maxLength > 0) {
          maxPipes.push(
            v.maxLength(field.maxLength, `Maximum ${field.maxLength} characters allowed`),
          );
        }

        if (pipes.length > 0 && maxPipes.length > 0) {
          fieldSchema = v.pipe(v.string(), pipes[0], maxPipes[0]);
        } else if (pipes.length > 0) {
          fieldSchema = v.pipe(v.string(), pipes[0]);
        } else if (maxPipes.length > 0) {
          fieldSchema = v.pipe(v.string(), maxPipes[0]);
        } else {
          fieldSchema = v.string();
        }
        break;
      }
    }

    if (field.required || isAlreadyOptional) {
      schemaShape[field.name] = fieldSchema as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
    } else {
      schemaShape[field.name] = v.optional(
        fieldSchema as v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
      );
    }
  }

  return v.object(schemaShape);
};

/**
 * Default form values from fields (uses field.defaultValue if set).
 * @param fields - form fields
 * @returns field name → default value
 */
export const generateDefaultValuesFromFields = (
  fields: PlateFormField[],
): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};

  for (const field of fields) {
    // Skip Button fields - they don't have form values
    if (field.fieldType === "Button") {
      continue;
    }
    if ("isFieldArray" in field && field.isFieldArray) {
      const seed = "defaultValue" in field && field.defaultValue ? field.defaultValue : "";
      // Honor the editor-configured row count (each click of "+ Add" in the
      // editor bumps this) so the published form opens with that many rows.
      const rawRows = "initialRows" in field ? field.initialRows : undefined;
      const rows = typeof rawRows === "number" && rawRows > 0 ? Math.floor(rawRows) : 1;
      defaults[field.name] = Array.from({ length: rows }, () => seed);
      continue;
    }
    if (
      field.fieldType === "Checkbox" ||
      field.fieldType === "MultiSelect" ||
      field.fieldType === "Ranking"
    ) {
      defaults[field.name] = [];
    } else if (field.fieldType === "MultiChoice") {
      defaults[field.name] = "";
    } else {
      defaults[field.name] =
        "defaultValue" in field && field.defaultValue ? field.defaultValue : "";
    }
  }

  return defaults;
};
