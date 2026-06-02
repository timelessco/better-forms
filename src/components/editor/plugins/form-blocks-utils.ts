import type { Path, TElement } from "platejs";
import type { PlateEditor } from "platejs/react";

export const moveToPath = (editor: PlateEditor, path: Path): boolean => {
  const node = editor.api.node(path);
  if (node) {
    editor.tf.select({ path: [...path, 0], offset: 0 });
    return true;
  }
  return false;
};

// Next block after path, skipping buttons/page-breaks. Submit button (last page) → null (stay); next/previous → first element after page break.
export const findNextNonButtonPath = (editor: PlateEditor, currentPath: Path): Path | null => {
  const children = editor.children as TElement[];
  const currentIndex = currentPath[0];

  for (let i = currentIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;

    if (node.type === "formButton") {
      const buttonRole = (node as Record<string, unknown>).buttonRole || "submit";

      if (buttonRole === "submit") {
        let hasThankYouPage = false;
        for (let j = i + 1; j < children.length; j++) {
          const nextNode = children[j];
          if (
            nextNode.type === "pageBreak" &&
            (nextNode as Record<string, unknown>).isThankYouPage
          ) {
            hasThankYouPage = true;
            break;
          }
        }
        if (!hasThankYouPage) {
          return null;
        }
        continue;
      }

      continue;
    }

    if (node.type === "pageBreak") {
      continue;
    }

    // Skip form header (shouldn't navigate into it)
    if (node.type === "formHeader") {
      continue;
    }

    return [i];
  }

  return null;
};

export const insertParagraphAfterPath = (editor: PlateEditor, path: Path): Path => {
  const at = [path[0] + 1];
  editor.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, { at });
  return at;
};

export const findPrevNonButtonPath = (editor: PlateEditor, currentPath: Path): Path | null => {
  const children = editor.children as TElement[];
  const currentIndex = currentPath[0];

  for (let i = currentIndex - 1; i >= 0; i--) {
    const node = children[i];
    if (!node) continue;

    if (node.type === "formButton") continue;
    if (node.type === "pageBreak") continue;
    if (node.type === "formHeader") continue;

    return [i];
  }

  return null;
};
