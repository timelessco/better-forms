import type { Value } from "platejs";

import { getFieldsFromSegments, getPreviewStepIds } from "@/lib/editor/transform-plate-for-preview";
import type { PreviewSegment } from "@/lib/editor/transform-plate-for-preview";
import { extractRuleset } from "./extract-ruleset";
import type { EngineField, Ruleset } from "./types";

/** Plain (serializable) conditional-logic payload — no functions, safe to ship
 * across the RSC boundary. The runtime engine (`evaluate`) is built from it client-side. */
export interface FormLogicValue {
  ruleset: Ruleset;
  /** All answerable fields (name + authored required), across every step. */
  allFields: EngineField[];
  /** Step id per rendered step index. Card mode aligns with the ruleset extractor's
   * ids ("step-0" + page-break ids); field-by-field uses synthetic ids (jumps degrade). */
  stepIds: string[];
  /** Answerable field names per rendered step index — used to skip fully-hidden steps. */
  stepFieldNames: string[][];
}

/** Derive the conditional-logic payload from published content + its rendered steps.
 * Shared by the builder preview (FormPreviewFromPlate) and the public RSC renderer so
 * both compute identical rulesets/step-ids/fields. */
export const buildFormLogic = (
  content: Value,
  steps: PreviewSegment[][],
  isFieldByField: boolean,
): FormLogicValue => {
  const stepFieldNames = steps.map((segs) =>
    getFieldsFromSegments(segs)
      .filter((f) => f.fieldType !== "Button")
      .map((f) => f.name),
  );
  const allFields: EngineField[] = [];
  for (const segs of steps) {
    for (const field of getFieldsFromSegments(segs)) {
      if (field.fieldType === "Button") continue;
      allFields.push({ name: field.name, required: field.required === true });
    }
  }
  const stepIds = isFieldByField ? steps.map((_, i) => `fbf-${i}`) : getPreviewStepIds(content);
  return { ruleset: extractRuleset(content), allFields, stepIds, stepFieldNames };
};
