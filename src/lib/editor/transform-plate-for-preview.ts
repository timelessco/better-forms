import type { Value } from "platejs";
import { extractFileUploadFields } from "@/lib/form-schema/file-upload-types";
import {
  ALLOWED_LABEL_TYPES,
  INPUT_TYPE_TO_FIELD_TYPE,
  VARIANT_TO_FIELD_TYPE,
  extractNumberFields,
  resolveRequired,
} from "@/lib/form-schema/form-field-constants";
import { extractTextContent, slugify } from "./transform-plate-to-form";
import type { PlateFormField } from "./transform-plate-to-form";

export type StaticSegment = { type: "static"; nodes: Value };
export type FieldSegment = { type: "field"; field: PlateFormField };
export type PreviewSegment = StaticSegment | FieldSegment;

export type PreviewStepResult = {
  steps: PreviewSegment[][];
  /** Raw Plate nodes for thank-you page (rendered entirely via PlateStatic) */
  thankYouNodes: Value | null;
};

/**
 * Transforms Plate editor Value into chunked preview segments.
 *
 * Static content (headings, paragraphs, blockquotes, code blocks, etc.)
 * is grouped into StaticSegments rendered by PlateStatic.
 * Form fields (Input, Textarea, Button) become FieldSegments
 * rendered by custom form components.
 *
 * Handles multi-step splitting on pageBreak nodes and
 * thank-you page extraction (isThankYouPage pageBreak).
 */
export const transformPlateForPreview = (value: Value): PreviewStepResult => {
  // formHeader is handled separately by extractFormHeader
  let startIdx = 0;
  if (value.length > 0 && value[0].type === "formHeader") {
    startIdx = 1;
  }

  const remaining = value.slice(startIdx);

  const rawSteps: Value[] = [];
  let thankYouNodes: Value | null = null;
  let currentChunk: Value = [];
  let collectingThankYou = false;

  for (const node of remaining) {
    if (node.type === "pageBreak") {
      if (currentChunk.length > 0 && !collectingThankYou) {
        rawSteps.push(currentChunk);
        currentChunk = [];
      }

      if (node.isThankYouPage) {
        collectingThankYou = true;
      }
      continue;
    }

    if (collectingThankYou) {
      if (!thankYouNodes) thankYouNodes = [];
      thankYouNodes.push(node);
    } else {
      currentChunk.push(node);
    }
  }

  if (currentChunk.length > 0 && !collectingThankYou) {
    rawSteps.push(currentChunk);
  }

  if (rawSteps.length === 0 && currentChunk.length > 0) {
    rawSteps.push(currentChunk);
  }

  const steps = rawSteps.map((stepNodes) => createSegments(stepNodes));

  return { steps, thankYouNodes };
};

/**
 * Walks an array of Plate nodes and produces an ordered list of segments.
 * Consecutive static nodes are grouped into a single StaticSegment.
 * Form nodes (formLabel+formInput, formButton) become FieldSegments.
 */
const createSegments = (nodes: Value): PreviewSegment[] => {
  const segments: PreviewSegment[] = [];
  let staticBuffer: Value = [];
  let fieldIndex = 0;

  /** Indices of label nodes that have been claimed by an input — skip in default branch */
  const consumedIndices = new Set<number>();

  const flushStatic = () => {
    if (staticBuffer.length > 0) {
      segments.push({ type: "static", nodes: staticBuffer });
      staticBuffer = [];
    }
  };

  /**
   * Look back at nodes[i-1] to find a label.
   * If the previous node is in ALLOWED_LABEL_TYPES, extract its text and
   * mark it as consumed (removing it from the static buffer if present).
   * Returns { labelText, labelNode } or null.
   */
  const lookBackForLabel = (
    i: number,
  ): { labelText: string; labelNode: Record<string, unknown> } | null => {
    if (i <= 0) return null;
    const prev = nodes[i - 1];
    const prevType = prev.type;
    if (!ALLOWED_LABEL_TYPES.has(prevType)) return null;

    const labelText = extractTextContent(prev.children as Array<{ text?: string }>);
    consumedIndices.add(i - 1);

    // Pop the label from the static buffer if it was the most-recently pushed item
    if (staticBuffer.length > 0 && staticBuffer[staticBuffer.length - 1] === prev) {
      staticBuffer.pop();
    }

    return { labelText, labelNode: prev as Record<string, unknown> };
  };

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const nodeType = node.type;

    if (INPUT_TYPE_TO_FIELD_TYPE[nodeType]) {
      const label = lookBackForLabel(i);
      flushStatic();
      const labelText = label?.labelText ?? "";
      const labelNode = label?.labelNode ?? null;
      const isRequired = resolveRequired(node as Record<string, unknown>, labelNode);

      const inputText = extractTextContent(node.children as Array<{ text?: string }>);
      const placeholder = inputText || (node.placeholder as string) || "";
      const minLength = node.minLength as number | undefined;
      const maxLength = node.maxLength as number | undefined;
      const defaultValue = node.defaultValue as string | undefined;
      const isFieldArray = node.isFieldArray === true ? true : undefined;

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      const fileUploadFields = nodeType === "formFileUpload" ? extractFileUploadFields(node) : {};
      const numberFields = nodeType === "formNumber" ? extractNumberFields(node) : {};

      segments.push({
        type: "field",
        field: {
          id: name,
          name,
          fieldType: INPUT_TYPE_TO_FIELD_TYPE[nodeType] as PlateFormField["fieldType"],
          label: labelText || undefined,
          labelType: label?.labelNode.type as string | undefined,
          placeholder: placeholder || undefined,
          required: isRequired,
          minLength,
          maxLength,
          defaultValue,
          isFieldArray,
          ...fileUploadFields,
          ...numberFields,
        } as PlateFormField,
      });
      fieldIndex++;
      i++;
      continue;
    }

    if (nodeType === "formMultiSelectInput") {
      const label = lookBackForLabel(i);
      flushStatic();
      const labelText = label?.labelText ?? "";
      const labelNode = label?.labelNode ?? null;
      const isRequired = resolveRequired(node as Record<string, unknown>, labelNode);

      const rawOptions = (node.options as string[]) ?? [];
      const options = rawOptions.map((opt, idx) => ({
        value: slugify(opt) || `option_${idx + 1}`,
        label: opt || `Option ${idx + 1}`,
      }));

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      segments.push({
        type: "field",
        field: {
          id: name,
          name,
          fieldType: "MultiSelect",
          label: labelText || undefined,
          labelType: label?.labelNode.type as string | undefined,
          required: isRequired,
          options,
        } as PlateFormField,
      });
      fieldIndex++;
      i++;
      continue;
    }

    // Compound field — collect consecutive option items
    if (nodeType === "formOptionItem") {
      const label = lookBackForLabel(i);
      flushStatic();
      const labelText = label?.labelText ?? "";
      const labelNode = label?.labelNode ?? null;
      const isRequired = resolveRequired(node as Record<string, unknown>, labelNode);

      const variant = (node.variant as string) || "checkbox";

      const options: { value: string; label: string }[] = [];
      let j = i;
      while (j < nodes.length && nodes[j].type === "formOptionItem") {
        const optText = extractTextContent(nodes[j].children as Array<{ text?: string }>);
        const optLabel = optText || `Option ${options.length + 1}`;
        options.push({
          value: slugify(optLabel) || `option_${options.length + 1}`,
          label: optLabel,
        });
        j++;
      }

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      // Single-option checkboxes ("I agree to terms") and switches typically
      // have no preceding label — the user-facing text lives on the option
      // item itself. Fall back to the option's own text so the field has a
      // readable label for downstream consumers (analytics, exports, etc.).
      const fieldLabel = labelText || options[0]?.label;

      segments.push({
        type: "field",
        field: {
          id: name,
          name,
          fieldType: VARIANT_TO_FIELD_TYPE[variant] || "Checkbox",
          label: fieldLabel || undefined,
          labelType: label?.labelNode.type as string | undefined,
          required: isRequired,
          options,
        } as PlateFormField,
      });
      fieldIndex++;
      i = j; // Advance past all consumed option nodes
      continue;
    }

    if (nodeType === "formButton") {
      flushStatic();

      const childText = extractTextContent(node.children as Array<{ text?: string }>);
      const btnText =
        (node.label as string | undefined) || childText || (node.buttonText as string | undefined);
      const btnRole = (node.buttonRole as "next" | "previous" | "submit") || "submit";
      const defaultText =
        btnRole === "next" ? "Next" : btnRole === "previous" ? "Previous" : "Submit";
      const name = `button_${fieldIndex}`;

      segments.push({
        type: "field",
        field: {
          id: name,
          name,
          fieldType: "Button",
          buttonText: btnText || defaultText,
          buttonRole: btnRole,
        },
      });
      fieldIndex++;
      i++;
      continue;
    }

    // Default: static content (skip if already consumed as a label)
    if (!consumedIndices.has(i)) {
      staticBuffer.push(node);
    }
    i++;
  }

  flushStatic();
  return segments;
};

/**
 * Re-chunk preview segments for field-by-field presentation: each non-Button
 * field becomes its own step, with preceding static content carried into the
 * same step. Authored Button fields are dropped — the runtime auto-renders a
 * submit/next button per step. If the result is empty (form has no fields),
 * falls back to the original chunking so static-only previews still render.
 */
export const chunkSegmentsForFieldByField = (steps: PreviewSegment[][]): PreviewSegment[][] => {
  const flattened: PreviewSegment[][] = [];
  let pending: PreviewSegment[] = [];
  for (const step of steps) {
    for (const seg of step) {
      if (seg.type === "field" && seg.field.fieldType === "Button") continue;
      pending.push(seg);
      if (seg.type === "field") {
        flattened.push(pending);
        pending = [];
      }
    }
  }
  if (pending.length > 0) flattened.push(pending);
  return flattened.length > 0 ? flattened : steps;
};

export const getFieldsFromSegments = (segments: PreviewSegment[]): PlateFormField[] =>
  segments.filter((seg): seg is FieldSegment => seg.type === "field").map((seg) => seg.field);

export const EDITABLE_FIELD_TYPES = new Set([
  "Input",
  "Textarea",
  "Email",
  "Phone",
  "Number",
  "Link",
  "Date",
  "Time",
  "FileUpload",
  "Checkbox",
  "MultiChoice",
  "MultiSelect",
  "Ranking",
]);
