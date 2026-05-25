import type { TElement, Value } from "platejs";
import { createFormButtonNode } from "@/components/ui/form-button-node";
import { createFormHeaderNode } from "@/components/ui/form-header-node";

/**
 * Ensure saved editor content has a formHeader at index 0 and a submit button.
 * Shared between the authenticated editor and the landing (local) editor.
 */
export const migrateEditorContent = (
  content: Value,
  metadata?: { title?: string | null; icon?: string | null; cover?: string | null },
): Value => {
  let result = content;

  if (result.length === 0 || result[0]?.type !== "formHeader") {
    result = [
      createFormHeaderNode({
        title: metadata?.title || "",
        icon: metadata?.icon || null,
        cover: metadata?.cover || null,
      }) as unknown as TElement,
      ...result,
    ];
  }

  const hasSubmitButton = result.some(
    (node: TElement) => node.type === "formButton" && node.buttonRole === "submit",
  );
  if (!hasSubmitButton) {
    const thankYouIndex = result.findIndex(
      (node: TElement) => node.type === "pageBreak" && node.isThankYouPage === true,
    );
    const insertIndex = thankYouIndex !== -1 ? thankYouIndex : result.length;
    result = [
      ...result.slice(0, insertIndex),
      createFormButtonNode("submit") as unknown as TElement,
      ...result.slice(insertIndex),
    ];
  }

  result = migrateMultiSelectOptions(result);

  return result;
};

/**
 * Convert consecutive formOptionItem nodes with variant="multiSelect"
 * into a single formMultiSelectInput node with options as a string array.
 */
const migrateMultiSelectOptions = (content: Value): Value => {
  const result: TElement[] = [];
  let i = 0;

  while (i < content.length) {
    const node = content[i];
    if (node.type === "formOptionItem" && node.variant === "multiSelect") {
      const options: string[] = [];
      while (
        i < content.length &&
        content[i].type === "formOptionItem" &&
        content[i].variant === "multiSelect"
      ) {
        const text = (content[i].children as Array<{ text?: string }>)
          .map((c) => c.text ?? "")
          .join("")
          .trim();
        if (text) options.push(text);
        i++;
      }
      result.push({
        type: "formMultiSelectInput",
        options,
        children: [{ text: "" }],
      } as unknown as TElement);
      // Add trailing paragraph if next node isn't one (matches what transforms.ts inserts for new fields)
      const nextNode = content[i];
      if (!nextNode || nextNode.type !== "p") {
        result.push({ type: "p", children: [{ text: "" }] } as unknown as TElement);
      }
    } else {
      result.push(node);
      i++;
    }
  }

  return result;
};
