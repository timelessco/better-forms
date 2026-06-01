import type { Value } from "platejs";
import * as v from "valibot";
import {
  getFieldsFromSegments,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import { generateZodSchemaFromFields } from "@/lib/form-schema/generate-preview-schema";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { evaluate } from "./engine";
import { extractRuleset } from "./extract-ruleset";
import type { EngineField } from "./types";

/** Full answerable fields from content (Button excluded), in document order. */
const collectAllFields = (content: Value): PlateFormField[] => {
  const out: PlateFormField[] = [];
  const { steps } = transformPlateForPreview(content);
  for (const segments of steps) {
    for (const field of getFieldsFromSegments(segments)) {
      if (field.fieldType === "Button") continue;
      out.push(field);
    }
  }
  return out;
};

const toEngineFields = (fields: PlateFormField[]): EngineField[] =>
  fields.map((f) => ({
    name: f.name,
    required: (f as { required?: boolean }).required === true,
  }));

const collectEngineFields = (content: Value): EngineField[] =>
  toEngineFields(collectAllFields(content));

export interface SanitizeResult {
  data: Record<string, unknown>;
  /** field names hidden by the server-side engine */
  hiddenStripped: string[];
  /** submitted keys the client shouldn't have sent (subset of hiddenStripped that was present) */
  rejected: string[];
}

/** Authoritative server pass: drop answers for server-hidden fields; flag client overreach. */
export const sanitizeSubmission = (
  content: Value,
  submitted: Record<string, unknown>,
): SanitizeResult => {
  const fields = collectEngineFields(content);
  const ruleset = extractRuleset(content);
  const { visibility, setValues } = evaluate(ruleset, submitted, fields);

  const hiddenStripped: string[] = [];
  const rejected: string[] = [];
  const data: Record<string, unknown> = { ...submitted };

  for (const field of fields) {
    if (visibility[field.name] === false) {
      hiddenStripped.push(field.name);
      if (field.name in submitted) {
        rejected.push(field.name);
        delete data[field.name];
      }
    }
  }

  // Authoritatively force "Set value" targets — don't trust a client-sent override.
  for (const [name, value] of Object.entries(setValues)) {
    if (visibility[name] !== false) data[name] = value;
  }

  return { data, hiddenStripped, rejected };
};

/** Valibot schema covering only the fields visible for `answers`, with logic-driven
 * effective-required applied. Shared by client (live validation) and server (authoritative
 * submit validation) so both enforce identical rules. Hidden fields are excluded, so a
 * hidden-but-authored-required field never blocks; a passing require-action adds requiredness. */
export const buildVisibleSchema = (
  content: Value,
  answers: Record<string, unknown>,
): v.ObjectSchema<v.ObjectEntries, undefined> => {
  const allFields = collectAllFields(content);
  const ruleset = extractRuleset(content);
  const { visibility, effectiveRequired } = evaluate(ruleset, answers, toEngineFields(allFields));
  const visibleFields = allFields
    .filter((f) => visibility[f.name] !== false)
    .map((f) => ({ ...f, required: effectiveRequired[f.name] === true }) as PlateFormField);
  return generateZodSchemaFromFields(visibleFields);
};
