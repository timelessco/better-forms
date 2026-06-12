import type { TElement, Value } from "platejs";
import { createFormButtonNode } from "@/components/ui/form-button-node";
import { createFormHeaderNode } from "@/components/ui/form-header-node";
import { normalizeOptionNodes } from "@/lib/editor/normalize-option-nodes";

/** Ensure content has a formHeader at index 0 + a submit button. Shared by
 * authenticated and landing (local) editors. */
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

  result = normalizeOptionNodes(result);

  return result;
};
