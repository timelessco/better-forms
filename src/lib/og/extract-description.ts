import { extractTextContent, isFormInputType } from "@/lib/editor/transform-plate-to-form";

const MAX_LENGTH = 180;
const MAX_PARAGRAPHS = 2;
const MAX_INSPECTED = 5;

type PlateNode = {
  type?: string;
  children?: Array<{ text?: string; children?: unknown }>;
};

const truncateAtWordBoundary = (text: string, max: number): string => {
  if (text.length <= max) return text;
  // Reserve 2 chars for a space + the ellipsis.
  const slice = text.slice(0, max - 2);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut} …`;
};

/**
 * Extract up to two leading description paragraphs from a Plate.js content
 * tree. Skips the leading `formHeader` block. A `p` whose immediate next
 * block is a form-input type is consumed as that field's label by
 * `transformPlateStateToFormElements` (see `transform-plate-to-form.ts`)
 * and is NOT a description.
 *
 * Returns an empty string when no qualifying paragraph exists. Only `p`
 * blocks count — h1/h2/h3 are static headings, not prose.
 */
export const extractOgDescription = (content: unknown): string => {
  if (!Array.isArray(content)) return "";

  let start = 0;
  if ((content[0] as PlateNode | undefined)?.type === "formHeader") start = 1;

  const collected: string[] = [];
  for (
    let i = start;
    i < content.length && i - start < MAX_INSPECTED && collected.length < MAX_PARAGRAPHS;
    i++
  ) {
    const node = content[i] as PlateNode;
    if (node?.type !== "p") break;

    const next = content[i + 1] as PlateNode | undefined;
    if (isFormInputType(next?.type)) break;

    const text = extractTextContent((node.children ?? []) as Array<{ text?: string }>).trim();
    if (!text) continue;

    collected.push(text);
  }

  if (collected.length === 0) return "";
  return truncateAtWordBoundary(collected.join(" "), MAX_LENGTH);
};
