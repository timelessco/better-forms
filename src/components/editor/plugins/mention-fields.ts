import type { TElement } from "platejs";
import type { PlateEditor } from "platejs/react";

import { fieldsBefore } from "@/lib/editor/resolve-mentions";
import {
  getFieldsFromSegments,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import { INPUT_TYPE_TO_FIELD_TYPE } from "@/lib/form-schema/form-field-constants";

/** Field types whose answer is a single, displayable value — what an `@`-mention can
 * usefully inline. Excludes Matrix/Signature/FileUpload/Button (object/binary answers). */
const MENTIONABLE_FIELD_TYPES = new Set([
  "Input",
  "Textarea",
  "Email",
  "Phone",
  "Number",
  "Link",
  "Date",
  "Time",
  "Checkbox",
  "MultiChoice",
  "Ranking",
  "LinearScale",
  "Rating",
]);

/** Top-level node types that don't begin a field (skipped so the start-index scan stays
 * aligned 1:1 with transformPlateForPreview's field order). */
const NON_FIELD_TYPES = new Set(["pageBreak", "logicBlock", "formButton", "formHeader"]);

/** Mirrors createSegments' field detection: a node that begins a new field. Consecutive
 * option items collapse into one field, so only the first of a run counts. */
const isFieldStart = (type: string | undefined, prevType: string | undefined): boolean => {
  if (!type) return false;
  if (INPUT_TYPE_TO_FIELD_TYPE[type]) return true;
  if (type === "formMatrix") return true;
  if (type === "formOptionItem") return prevType !== "formOptionItem";
  return false;
};

export interface MentionableField {
  /** Stable field `name` — stored on the mention node so renames don't break it. */
  key: string;
  /** Display label shown in the picker and on the pill. */
  text: string;
}

/** Fields a `@`-mention at `element` may reference: only those positioned BEFORE it in the
 * document (excludes the field this mention belongs to and everything after), filtered to
 * value-bearing types. Guarantees the referenced answer exists by the time the field renders. */
export const getMentionableFields = (
  editor: PlateEditor,
  element: TElement,
): MentionableField[] => {
  // Global field list — names match the ones used at resolution time.
  const { steps } = transformPlateForPreview(editor.children);
  const fields = steps.flatMap(getFieldsFromSegments).filter((f) => f.fieldType !== "Button");

  // Parallel scan: top-level index where each field begins, in the same order as `fields`.
  const nodes = editor.children as Array<{ type?: string }>;
  const startIndices: number[] = [];
  for (let t = 0; t < nodes.length; t++) {
    const type = nodes[t]?.type;
    if (type && NON_FIELD_TYPES.has(type)) continue;
    if (isFieldStart(type, nodes[t - 1]?.type)) startIndices.push(t);
  }

  // Cutoff = first field at/after the mention's block → the owning/following field; excluded.
  const path = editor.api.findPath(element);
  const blockIndex = path?.[0] ?? nodes.length;
  const cutoffIdx = startIndices.findIndex((idx) => idx >= blockIndex);
  const cutoffName = cutoffIdx === -1 ? null : (fields[cutoffIdx]?.name ?? null);

  return fieldsBefore(fields, cutoffName)
    .filter((f) => MENTIONABLE_FIELD_TYPES.has(f.fieldType))
    .map((f) => ({ key: f.name, text: f.label ?? f.name }));
};
