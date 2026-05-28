/**
 * Generate Zod validation schema from PlateFormField definitions.
 *
 * This utility creates a Zod schema object from the validation properties
 * stored in the Plate editor nodes, enabling runtime form validation in preview mode.
 */
import { isValidPhoneNumber } from "react-phone-number-input";
import { z } from "zod";
import type { ZodType } from "zod";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";

/** Strict per-item validator for a repeatable scalar field. Empty items are
 * filtered out before this runs, so every item must be a valid non-empty value. */
const buildArrayItemSchema = (field: PlateFormField): ZodType => {
  switch (field.fieldType) {
    case "Email":
      return z.email({ error: "Please enter a valid email address" });
    case "Link": {
      const urlRegex = /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/;
      return z.string().regex(urlRegex, "Please enter a valid URL");
    }
    case "Number": {
      let n = z.coerce.number({ error: "Please enter a valid number" });
      if (field.allowDecimals === false) n = n.int("Decimals are not allowed");
      if (typeof field.min === "number")
        n = n.min(field.min, `Value must be at least ${field.min}`);
      if (typeof field.max === "number") n = n.max(field.max, `Value must be at most ${field.max}`);
      return n;
    }
    case "Phone":
      return z.string().refine((v) => isValidPhoneNumber(v), "Please enter a valid phone number");
    case "Input":
    case "Textarea": {
      let s: z.ZodString = z.string().min(1, "This field is required");
      if ("minLength" in field && field.minLength) {
        s = s.min(field.minLength, `Minimum ${field.minLength} characters required`);
      }
      if ("maxLength" in field && field.maxLength) {
        s = s.max(field.maxLength, `Maximum ${field.maxLength} characters allowed`);
      }
      return s;
    }
    default:
      // Date, Time, and any fallback scalar: non-empty string.
      return z.string().min(1, "This field is required");
  }
};

/**
 * Generates a Zod schema from an array of PlateFormField.
 *
 * @param fields - Array of form fields with validation properties
 * @returns Zod object schema for form validation
 */
export const generateZodSchemaFromFields = (fields: PlateFormField[]): z.ZodObject => {
  const schemaShape: Record<string, ZodType> = {};

  for (const field of fields) {
    // Skip Button fields - they don't have validation
    if (field.fieldType === "Button") {
      continue;
    }

    if ("isFieldArray" in field && field.isFieldArray) {
      // Required: validate every item strictly (so empty items each get their
      // own per-index "This field is required" error, routed to <FieldError />
      // inside the item component).
      // Optional: accept empty items via union, only flag genuinely-malformed
      // non-empty values.
      const strictItem = buildArrayItemSchema(field);
      const item = field.required ? strictItem : z.union([z.literal(""), strictItem]);
      const arraySchema = field.required
        ? z.array(item).min(1, "This field is required")
        : z.array(item);
      schemaShape[field.name] = arraySchema;
      continue;
    }

    let fieldSchema: ZodType;

    switch (field.fieldType) {
      case "Email":
        fieldSchema = field.required
          ? z
              .email({ error: "Please enter a valid email address" })
              .min(1, "This field is required")
          : z.union([z.literal(""), z.email({ error: "Please enter a valid email address" })]);
        break;
      case "Link": {
        const urlRegex = /^(https?:\/\/)?[\w.-]+\.\w{2,}(\/\S*)?$/;
        fieldSchema = field.required
          ? z
              .string({ error: "This field is required" })
              .min(1, "This field is required")
              .regex(urlRegex, "Please enter a valid URL")
          : z.union([z.literal(""), z.string().regex(urlRegex, "Please enter a valid URL")]);
        break;
      }
      case "Number": {
        let numberSchema = z.coerce.number({ error: "Please enter a valid number" });
        if (field.allowDecimals === false) {
          numberSchema = numberSchema.int("Decimals are not allowed");
        }
        if (typeof field.min === "number") {
          numberSchema = numberSchema.min(field.min, `Value must be at least ${field.min}`);
        }
        if (typeof field.max === "number") {
          numberSchema = numberSchema.max(field.max, `Value must be at most ${field.max}`);
        }
        // `Number("")` is 0, so a required Number with an empty input would
        // silently coerce to 0 and pass. Preprocess "" → undefined so the
        // downstream number schema sees undefined and rejects it with the
        // standard required-field error.
        fieldSchema = field.required
          ? z.preprocess(
              (val) => (val === "" || val === null || val === undefined ? undefined : val),
              numberSchema,
            )
          : z.union([z.literal(""), numberSchema]);
        break;
      }
      case "Phone": {
        // PhoneInput emits E.164 strings (e.g. "+919360992440"). Validate the
        // phone-number format with libphonenumber, not character-count limits
        // that may have been written onto the node before Phone was split out
        // of the text-like settings UI.
        const phoneSchema = z
          .string()
          .refine((v) => isValidPhoneNumber(v), "Please enter a valid phone number");
        fieldSchema = field.required
          ? z.string().min(1, "This field is required").pipe(phoneSchema)
          : z.union([z.literal(""), phoneSchema]);
        break;
      }
      case "Date":
        fieldSchema = field.required
          ? z.string({ error: "This field is required" }).nonempty("Please select a date")
          : z.string().optional();
        break;
      case "Time":
        fieldSchema = field.required
          ? z.string({ error: "This field is required" }).nonempty("Please select a time")
          : z.string().optional();
        break;
      case "FileUpload": {
        const uploadedFileSchema = z.object({
          url: z.string(),
          name: z.string(),
          size: z.number(),
          type: z.string(),
        });
        fieldSchema = field.required
          ? uploadedFileSchema.refine((v) => v && v.url.length > 0, {
              message: "Please upload a file",
            })
          : z.union([z.literal(""), uploadedFileSchema]).optional();
        break;
      }
      case "Checkbox":
      case "MultiSelect":
        if (field.required) {
          fieldSchema = z.array(z.string()).nonempty("Please select at least one option");
        } else {
          fieldSchema = z.array(z.string()).default([]);
        }
        break;
      case "MultiChoice":
        if (field.required) {
          fieldSchema = z.string().min(1, "Please select an option");
        } else {
          fieldSchema = z.string().default("");
        }
        break;
      case "Ranking":
        if (field.required) {
          fieldSchema = z.array(z.string()).nonempty("Please rank the options");
        } else {
          fieldSchema = z.array(z.string()).default([]);
        }
        break;
      default: {
        // Input, Textarea, Phone, and other string-based types
        let schema: z.ZodString = z.string();

        if ("minLength" in field && field.minLength !== undefined && field.minLength > 0) {
          schema = schema.min(field.minLength, `Minimum ${field.minLength} characters required`);
        }

        if ("maxLength" in field && field.maxLength !== undefined && field.maxLength > 0) {
          schema = schema.max(field.maxLength, `Maximum ${field.maxLength} characters allowed`);
        }

        // Required fields must have at least 1 character
        if (field.required && !("minLength" in field && field.minLength !== undefined)) {
          schema = schema.min(1, "This field is required");
        }

        fieldSchema = schema;
        break;
      }
    }

    if (field.required) {
      schemaShape[field.name] = fieldSchema;
    } else {
      schemaShape[field.name] = fieldSchema.optional();
    }
  }

  return z.object(schemaShape);
};

/**
 * Generates default form values from fields, using defaultValue if specified.
 *
 * @param fields - Array of form fields
 * @returns Object with field names as keys and default values
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
      defaults[field.name] = [seed];
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
