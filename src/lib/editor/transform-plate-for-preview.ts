import type { Value } from "platejs";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { extractFileUploadFields } from "@/lib/form-schema/file-upload-types";
import {
  ALLOWED_LABEL_TYPES,
  INPUT_TYPE_TO_FIELD_TYPE,
  VARIANT_TO_FIELD_TYPE,
  extractNumberFields,
  resolveRequired,
} from "@/lib/form-schema/form-field-constants";
import { buildOptionList, extractTextContent, slugify } from "./transform-plate-to-form";
import type { PlateFormField } from "./transform-plate-to-form";

export type StaticSegment = { type: "static"; nodes: Value };
export type FieldSegment = { type: "field"; field: PlateFormField };
export type PreviewSegment = StaticSegment | FieldSegment;

export type PreviewStepResult = {
  steps: PreviewSegment[][];
  /** Raw Plate nodes for thank-you page (rendered entirely via PlateStatic) */
  thankYouNodes: Value | null;
};

/** Plate Value → chunked preview segments. Static content (headings/paragraphs/etc.)
 * → StaticSegments (PlateStatic); form fields → FieldSegments. Splits on pageBreak
 * (multi-step) and extracts isThankYouPage pageBreak. */
export const transformPlateForPreview = (value: Value): PreviewStepResult => {
  // formHeader handled separately by extractFormHeader.
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

/** Step id per CARD step, aligned 1:1 with `transformPlateForPreview(...).steps`
 * and with the ids the logic ruleset extractor assigns. First chunk = "step-0";
 * subsequent chunks take the id of the pageBreak that opens them. Used to map a
 * jump rule's target/source step id to a rendered step index. */
export const getPreviewStepIds = (value: Value): string[] => {
  let startIdx = 0;
  if (value.length > 0 && value[0].type === "formHeader") startIdx = 1;
  const remaining = value.slice(startIdx);

  const ids: string[] = [];
  let current = "step-0";
  let chunkLen = 0;
  let collectingThankYou = false;

  for (const node of remaining) {
    if (node.type === "pageBreak") {
      if (chunkLen > 0 && !collectingThankYou) {
        ids.push(current);
        chunkLen = 0;
      }
      if (node.isThankYouPage) collectingThankYou = true;
      else current = (node as { id?: string }).id ?? current;
      continue;
    }
    if (!collectingThankYou) chunkLen++;
  }
  if (chunkLen > 0 && !collectingThankYou) ids.push(current);
  return ids;
};

/** Plate nodes → ordered segments. Consecutive static nodes grouped into one
 * StaticSegment; form nodes (formLabel+formInput, formButton) → FieldSegments. */
const createSegments = (nodes: Value): PreviewSegment[] => {
  const segments: PreviewSegment[] = [];
  let staticBuffer: Value = [];
  let fieldIndex = 0;

  /** Label-node indices claimed by an input — skip in default branch. */
  const consumedIndices = new Set<number>();

  const flushStatic = () => {
    if (staticBuffer.length > 0) {
      segments.push({ type: "static", nodes: staticBuffer });
      staticBuffer = [];
    }
  };

  /** Look back at nodes[i-1] for a label: if in ALLOWED_LABEL_TYPES, extract text,
   * mark consumed, pop from static buffer if present. Returns {labelText,labelNode} or null. */
  const lookBackForLabel = (
    i: number,
  ): { labelText: string; labelNode: Record<string, unknown> } | null => {
    if (i <= 0) return null;
    const prev = nodes[i - 1];
    const prevType = prev.type;
    if (!ALLOWED_LABEL_TYPES.has(prevType)) return null;

    const labelText = extractTextContent(prev.children as Array<{ text?: string }>);
    consumedIndices.add(i - 1);

    // Pop label from static buffer if it was the most-recently pushed item.
    if (staticBuffer.length > 0 && staticBuffer[staticBuffer.length - 1] === prev) {
      staticBuffer.pop();
    }

    return { labelText, labelNode: prev as Record<string, unknown> };
  };

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    const nodeType = node.type;

    // Logic blocks are evaluation-only — never rendered. Skip before label look-back
    // and the static-buffer default so they don't surface as content.
    if (nodeType === "logicBlock") {
      i++;
      continue;
    }

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
      const rawInitialRows = node.initialRows;
      const initialRows =
        isFieldArray && typeof rawInitialRows === "number" && rawInitialRows > 0
          ? Math.floor(rawInitialRows)
          : undefined;

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      const fileUploadFields = nodeType === "formFileUpload" ? extractFileUploadFields(node) : {};
      const numberFields = nodeType === "formNumber" ? extractNumberFields(node) : {};
      const verifyEmail = nodeType === "formEmail" && node.verifyEmail === true ? true : undefined;
      const defaultCountryCode =
        nodeType === "formPhone" && typeof node.defaultCountryCode === "string"
          ? node.defaultCountryCode || undefined
          : undefined;
      const use24Hour = nodeType === "formTime" && node.use24Hour === true ? true : undefined;

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
          initialRows,
          ...fileUploadFields,
          ...numberFields,
          ...(verifyEmail ? { verifyEmail } : {}),
          ...(defaultCountryCode ? { defaultCountryCode } : {}),
          ...(use24Hour ? { use24Hour } : {}),
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

      const optionNodes: Array<{ children?: Array<{ text?: string }>; image?: string }> = [];
      let j = i;
      while (j < nodes.length && nodes[j].type === "formOptionItem") {
        optionNodes.push(nodes[j] as { children?: Array<{ text?: string }>; image?: string });
        j++;
      }
      const options = buildOptionList(optionNodes);

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      // Single-option checkboxes ("I agree") / switches usually lack a preceding
      // label — text lives on the option item. Fall back to it so downstream
      // (analytics, exports) gets a readable label.
      const fieldLabel = labelText || options[0]?.label;

      const fieldType = VARIANT_TO_FIELD_TYPE[variant] || "Checkbox";
      // `shuffle` lives on the group's first option node; only Dropdown reads it today.
      const shuffle = fieldType === "Dropdown" ? Boolean(node.shuffle) : undefined;
      // `optionLabel` (Labels submenu) also lives on the first option node; Checkbox/MultiChoice render it.
      const optionLabel =
        fieldType === "Checkbox" || fieldType === "MultiChoice"
          ? (node.optionLabel as OptionLabelStyle | undefined)
          : undefined;

      segments.push({
        type: "field",
        field: {
          id: name,
          name,
          fieldType,
          label: fieldLabel || undefined,
          labelType: label?.labelNode.type as string | undefined,
          required: isRequired,
          options,
          ...(shuffle !== undefined ? { shuffle } : {}),
          ...(optionLabel ? { optionLabel } : {}),
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

/** Re-chunk for field-by-field: each non-Button field = one step, with preceding
 * static carried along. Drops authored Buttons (runtime auto-renders per step).
 * Empty result (no fields) falls back to original chunking for static-only previews. */
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
  "Dropdown",
]);
