import { extractTextContent, isFormInputType } from "@/lib/editor/transform-plate-to-form";
import { MAX_OG_DESCRIPTION_LENGTH, clampOgText } from "@/lib/og/limits";

const MAX_PARAGRAPHS = 2;
const MAX_INSPECTED = 5;

type PlateNode = {
  type?: string;
  children?: Array<{ text?: string; children?: unknown }>;
};

/** Up to 2 leading description paragraphs from a Plate tree. Skips `formHeader`.
 * A `p` directly before a form-input is that field's label (consumed by
 * transformPlateStateToFormElements), not a description. Only `p` counts (h1-3
 * are headings). `""` if none. */
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
  return clampOgText(collected.join(" "), MAX_OG_DESCRIPTION_LENGTH);
};
