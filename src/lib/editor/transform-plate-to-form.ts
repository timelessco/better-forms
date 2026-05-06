import type { Value } from "platejs";
import { extractFileUploadFields } from "@/lib/form-schema/file-upload-types";
import {
  ALLOWED_LABEL_TYPES,
  FORM_INPUT_NODE_TYPES,
  INPUT_TYPE_TO_FIELD_TYPE,
  VARIANT_TO_FIELD_TYPE,
  resolveRequired,
} from "@/lib/form-schema/form-field-constants";

/** Loose Plate node shape for tree traversal in extractors */
interface PlateNode {
  type?: string;
  text?: string;
  children?: PlateNode[];
  [key: string]: unknown;
}

type FormHeaderData = {
  title: string;
  icon: string | null;
  iconColor: string | null;
  cover: string | null;
};

export const extractFormHeader = (value: Value): FormHeaderData | null => {
  if (value.length > 0 && value[0].type === "formHeader") {
    const node = value[0];
    return {
      title: (node.title as string) || "",
      icon: (node.icon as string | null) || null,
      iconColor: (node.iconColor as string | null) || null,
      cover: (node.cover as string | null) || null,
    };
  }
  return null;
};

export type PlateFormField =
  | {
      id: string;
      name: string;
      fieldType: "Input";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      defaultValue?: string;
    }
  | {
      id: string;
      name: string;
      fieldType: "Textarea";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      defaultValue?: string;
    }
  | {
      id: string;
      name: string;
      fieldType: "Email";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      name: string;
      fieldType: "Phone";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      name: string;
      fieldType: "Number";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
      min?: number;
      max?: number;
    }
  | {
      id: string;
      name: string;
      fieldType: "Link";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      name: string;
      fieldType: "Date";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      name: string;
      fieldType: "Time";
      label?: string;
      labelType?: string;
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      name: string;
      fieldType: "FileUpload";
      label?: string;
      labelType?: string;
      required?: boolean;
      accept?: string;
      maxFileSize?: number;
      maxFiles?: number;
      allowedFileTypes?: string;
      allowedFileExtensions?: string[];
    }
  | {
      id: string;
      name: string;
      fieldType: "Checkbox";
      label?: string;
      labelType?: string;
      required?: boolean;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      fieldType: "MultiChoice";
      label?: string;
      labelType?: string;
      required?: boolean;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      fieldType: "MultiSelect";
      label?: string;
      labelType?: string;
      required?: boolean;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      fieldType: "Ranking";
      label?: string;
      labelType?: string;
      required?: boolean;
      options: { value: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      fieldType: "Button";
      buttonText?: string;
      buttonRole: "next" | "previous" | "submit";
    };

export type PlateStaticElement =
  | { id: string; fieldType: "H1"; content: string; static: true; name: string }
  | { id: string; fieldType: "H2"; content: string; static: true; name: string }
  | { id: string; fieldType: "H3"; content: string; static: true; name: string }
  | { id: string; fieldType: "Separator"; static: true; name: string }
  | { id: string; fieldType: "EmptyBlock"; static: true; name: string }
  | {
      id: string;
      fieldType: "FieldDescription";
      content: string;
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "PageBreak";
      isThankYouPage: boolean;
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "UnorderedList";
      items: string[];
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "OrderedList";
      items: string[];
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "Toggle";
      title: string;
      children: TransformedElement[];
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "Table";
      rows: { cells: string[]; isHeader: boolean }[];
      static: true;
      name: string;
    }
  | {
      id: string;
      fieldType: "Callout";
      emoji?: string;
      content: string;
      static: true;
      name: string;
    };

export type TransformedElement = PlateFormField | PlateStaticElement;

export const extractTextContent = (children: Array<{ text?: string }>): string => {
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => child.text || "")
    .join("")
    .trim();
};

/**
 * True when `type` is a Plate node that, if it appears immediately after a
 * label-eligible block (p / h1-3 / formLabel / blockquote), would consume
 * that block as its field label in `transformPlateStateToFormElements`.
 *
 * Used by extractors that need to distinguish description prose from a
 * field label — a leading `p` whose next block is one of these types is a
 * label, not description text.
 */
export const isFormInputType = (type: string | undefined): boolean =>
  type !== undefined && FORM_INPUT_NODE_TYPES.has(type);

/** Slugify a label, e.g. "Email Address" -> "email_address". */
const NON_ALNUM_RE = /[^a-z0-9]+/g;
const TRIM_UNDERSCORES_RE = /^_|_$/g;

export const slugify = (str: string): string =>
  str.toLowerCase().replace(NON_ALNUM_RE, "_").replace(TRIM_UNDERSCORES_RE, "") || "field";

/** Extracts list items from a Plate list node (ul/ol). Structure: ul > li > lic > text. */
const extractListItems = (node: PlateNode): string[] => {
  const items: string[] = [];
  if (!node.children || !Array.isArray(node.children)) return items;

  for (const li of node.children) {
    if (li.type === "li" && li.children) {
      // List item content is typically wrapped in a "lic" node
      for (const child of li.children) {
        if (child.type === "lic" || child.type === "p") {
          const text = extractTextContent((child.children ?? []) as Array<{ text?: string }>);
          if (text) items.push(text);
        } else if (child.text !== undefined) {
          const text = child.text?.trim();
          if (text) items.push(text);
        }
      }
    }
  }
  return items;
};

/** Extracts table rows from a Plate table node. Structure: table > tr > (th|td) > text. */
const extractTableRows = (node: PlateNode): { cells: string[]; isHeader: boolean }[] => {
  const rows: { cells: string[]; isHeader: boolean }[] = [];
  if (!node.children || !Array.isArray(node.children)) return rows;

  for (const tr of node.children) {
    if (tr.type === "tr" && tr.children) {
      const cells: string[] = [];
      let isHeader = false;

      for (const cell of tr.children) {
        if (cell.type === "th") {
          isHeader = true;
        }
        // Cells often have p > text structure
        let cellText = "";
        if (cell.children) {
          for (const cellChild of cell.children) {
            if (cellChild.type === "p" && cellChild.children) {
              cellText += extractTextContent(cellChild.children);
            } else if (cellChild.text !== undefined) {
              cellText += cellChild.text;
            }
          }
        }
        cells.push(cellText.trim());
      }

      if (cells.length > 0) {
        rows.push({ cells, isHeader });
      }
    }
  }
  return rows;
};

/**
 * Transforms Plate.js editor Value into form elements suitable for export.
 *
 * Uses an "input-looks-back" heuristic: each form input node looks at value[i-1]
 * to find its label. Label-like nodes (formLabel, h1-h3, p, blockquote) peek ahead
 * at value[i+1] — if the next node is a form input, the label skips itself so the
 * input can claim it.
 *
 * Supports:
 * - formInput/formTextarea/formEmail/etc. with preceding label -> typed fields
 * - formMultiSelectInput with preceding label -> MultiSelect field
 * - formOptionItem runs with preceding label -> Checkbox/MultiChoice/etc.
 * - h1, h2, h3 -> Static headings (unless consumed as labels)
 * - hr -> Separator
 * - p, blockquote -> Description text (unless consumed as labels)
 *
 * @param value - Plate editor content array
 * @returns Array of elements for form rendering
 */
export const transformPlateStateToFormElements = (value: Value): TransformedElement[] => {
  const elements: TransformedElement[] = [];
  let fieldIndex = 0;

  /** Indices of label nodes consumed by a following input — skip when processing static content */
  const consumedIndices = new Set<number>();

  /**
   * Look back at value[i-1] to find a label.
   * If the previous node is in ALLOWED_LABEL_TYPES, extract its text,
   * mark it as consumed, and remove it from elements if it was the last pushed item.
   */
  const lookBackForLabel = (
    i: number,
  ): { labelText: string; labelNode: Record<string, unknown> } | null => {
    if (i <= 0) return null;
    const prev = value[i - 1];
    const prevType = prev.type;
    if (!ALLOWED_LABEL_TYPES.has(prevType)) return null;

    const labelText = extractTextContent(prev.children as Array<{ text?: string }>);
    consumedIndices.add(i - 1);

    // Pop the label from elements if it was the most-recently pushed static item
    if (elements.length > 0) {
      const last = elements[elements.length - 1];
      if ("static" in last && last.static) {
        // Check if the last static element corresponds to this label node
        const lastId = last.id;
        const expectedPrefixes = ["h1_", "h2_", "h3_", "desc_", "empty_"];
        const isStaticLabel = expectedPrefixes.some((p) => lastId.startsWith(p));
        if (isStaticLabel) {
          // For formLabel nodes we always pop; for heading/p/blockquote we check content match
          if (prevType === "formLabel") {
            elements.pop();
          } else {
            const lastContent = "content" in last ? (last as { content: string }).content : "";
            if (lastContent === labelText || labelText === "") {
              elements.pop();
            }
          }
        }
      }
    }

    return { labelText, labelNode: prev as Record<string, unknown> };
  };

  let i = 0;
  while (i < value.length) {
    const node = value[i];
    const nodeType = node.type;

    // formHeader is handled separately
    if (nodeType === "formHeader") {
      i++;
      continue;
    }

    if (INPUT_TYPE_TO_FIELD_TYPE[nodeType]) {
      const label = lookBackForLabel(i);
      const labelText = label?.labelText ?? "";
      const labelNode = label?.labelNode ?? null;
      const isRequired = resolveRequired(node as Record<string, unknown>, labelNode);

      const inputText = extractTextContent(node.children as Array<{ text?: string }>);
      const placeholder = inputText || (node.placeholder as string) || "";
      const minLength = node.minLength as number | undefined;
      const maxLength = node.maxLength as number | undefined;
      const defaultValue = node.defaultValue as string | undefined;

      const stableId =
        (label?.labelNode as { id?: string } | undefined)?.id ?? (node as { id?: string }).id;
      const baseName = slugify(labelText);
      const name = stableId || `${baseName}_${fieldIndex}`;

      const fileUploadFields = nodeType === "formFileUpload" ? extractFileUploadFields(node) : {};

      elements.push({
        id: name,
        name,
        fieldType: INPUT_TYPE_TO_FIELD_TYPE[nodeType] as PlateFormField["fieldType"],
        label: labelText || undefined,
        placeholder: placeholder || undefined,
        required: isRequired,
        minLength,
        maxLength,
        defaultValue,
        ...fileUploadFields,
      } as PlateFormField);
      fieldIndex++;
      i++;
      continue;
    }

    if (nodeType === "formMultiSelectInput") {
      const label = lookBackForLabel(i);
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

      elements.push({
        id: name,
        name,
        fieldType: "MultiSelect",
        label: labelText || undefined,
        required: isRequired,
        options,
      } as PlateFormField);
      fieldIndex++;
      i++;
      continue;
    }

    // Compound field — collect consecutive option items
    if (nodeType === "formOptionItem") {
      const label = lookBackForLabel(i);
      const labelText = label?.labelText ?? "";
      const labelNode = label?.labelNode ?? null;
      const isRequired = resolveRequired(node as Record<string, unknown>, labelNode);

      const variant = (node.variant as string) || "checkbox";

      const options: { value: string; label: string }[] = [];
      let j = i;
      while (j < value.length && value[j].type === "formOptionItem") {
        const optText = extractTextContent(value[j].children as Array<{ text?: string }>);
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

      elements.push({
        id: name,
        name,
        fieldType: VARIANT_TO_FIELD_TYPE[variant] || "Checkbox",
        label: labelText || undefined,
        required: isRequired,
        options,
      } as PlateFormField);
      fieldIndex++;
      i = j; // Advance past all consumed option nodes
      continue;
    }

    if (nodeType === "formButton") {
      const childText = extractTextContent(node.children as Array<{ text?: string }>);
      const btnText =
        (node.label as string | undefined) || childText || (node.buttonText as string | undefined);
      const btnRole = (node.buttonRole as "next" | "previous" | "submit") || "submit";
      const defaultText =
        btnRole === "next" ? "Next" : btnRole === "previous" ? "Previous" : "Submit";
      const name = `button_${fieldIndex}`;
      elements.push({
        id: name,
        name,
        fieldType: "Button",
        buttonText: btnText || defaultText,
        buttonRole: btnRole,
      });
      fieldIndex++;
      i++;
      continue;
    }

    // For headings (h1/h2/h3) and text blocks (p/blockquote): if the NEXT node
    // is a form input type, skip rendering as static — the input will consume
    // this node as its label via lookBackForLabel.
    if (ALLOWED_LABEL_TYPES.has(nodeType) && nodeType !== "formLabel") {
      const nextNode = i + 1 < value.length ? value[i + 1] : null;
      const nextType = nextNode ? nextNode.type : "";
      if (FORM_INPUT_NODE_TYPES.has(nextType)) {
        // Will be consumed as a label by the next input — skip static rendering
        i++;
        continue;
      }

      // Render as static content
      const content = extractTextContent(node.children as Array<{ text?: string }>);
      if (nodeType === "h1" || nodeType === "h2" || nodeType === "h3") {
        if (content) {
          elements.push({
            id: `${nodeType}_${elements.length}`,
            name: `${nodeType}_${elements.length}`,
            fieldType: nodeType.toUpperCase() as "H1" | "H2" | "H3",
            content,
            static: true,
          });
        }
      } else if (content) {
        // p or blockquote with content -> Description
        elements.push({
          id: `desc_${elements.length}`,
          name: `desc_${elements.length}`,
          fieldType: "FieldDescription",
          content,
          static: true,
        });
      } else {
        // Empty p or blockquote -> EmptyBlock
        elements.push({
          id: `empty_${elements.length}`,
          name: `empty_${elements.length}`,
          fieldType: "EmptyBlock",
          static: true,
        });
      }
      i++;
      continue;
    }

    // formLabel: peek ahead — if next is input, skip (input will consume it);
    // otherwise render nothing (bare label without input).
    if (nodeType === "formLabel") {
      const nextNode = i + 1 < value.length ? value[i + 1] : null;
      const nextType = nextNode ? nextNode.type : "";
      if (FORM_INPUT_NODE_TYPES.has(nextType)) {
        // Will be consumed as a label by the next input
        i++;
        continue;
      }
      // Standalone formLabel with no input — skip it (no static rendering for bare labels)
      i++;
      continue;
    }

    if (nodeType === "hr") {
      elements.push({
        id: `sep_${elements.length}`,
        name: `sep_${elements.length}`,
        fieldType: "Separator",
        static: true,
      });
      i++;
      continue;
    }

    if (nodeType === "pageBreak") {
      const isThankYouPage = Boolean(node.isThankYouPage);
      elements.push({
        id: `page_${elements.length}`,
        name: `page_${elements.length}`,
        fieldType: "PageBreak",
        isThankYouPage,
        static: true,
      });
      i++;
      continue;
    }

    if (nodeType === "ul") {
      const items = extractListItems(node);
      if (items.length > 0) {
        elements.push({
          id: `ul_${elements.length}`,
          name: `ul_${elements.length}`,
          fieldType: "UnorderedList",
          items,
          static: true,
        });
      }
      i++;
      continue;
    }

    if (nodeType === "ol") {
      const items = extractListItems(node);
      if (items.length > 0) {
        elements.push({
          id: `ol_${elements.length}`,
          name: `ol_${elements.length}`,
          fieldType: "OrderedList",
          items,
          static: true,
        });
      }
      i++;
      continue;
    }

    if (nodeType === "toggle") {
      const children = node.children as PlateNode[];
      let title = "";
      const contentNodes: PlateNode[] = [];

      if (children && children.length > 0) {
        if (children[0].children) {
          title = extractTextContent(children[0].children);
        } else if (children[0].text) {
          title = children[0].text;
        }
        contentNodes.push(...children.slice(1));
      }

      const toggleContent = transformPlateStateToFormElements(contentNodes as Value);

      elements.push({
        id: `toggle_${elements.length}`,
        name: `toggle_${elements.length}`,
        fieldType: "Toggle",
        title: title || "Toggle",
        children: toggleContent,
        static: true,
      });
      i++;
      continue;
    }

    if (nodeType === "table") {
      const rows = extractTableRows(node);
      if (rows.length > 0) {
        elements.push({
          id: `table_${elements.length}`,
          name: `table_${elements.length}`,
          fieldType: "Table",
          rows,
          static: true,
        });
      }
      i++;
      continue;
    }

    if (nodeType === "callout") {
      const content = extractTextContent(node.children as Array<{ text?: string }>);
      const emoji = node.emoji as string | undefined;
      elements.push({
        id: `callout_${elements.length}`,
        name: `callout_${elements.length}`,
        fieldType: "Callout",
        emoji,
        content: content || "",
        static: true,
      });
      i++;
      continue;
    }

    // Skip unsupported node types (and already-consumed indices)
    i++;
  }

  return elements;
};

export const getEditableFields = (elements: TransformedElement[]): PlateFormField[] =>
  elements.filter((el): el is PlateFormField => !("static" in el) || !el.static);
