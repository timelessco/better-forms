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

// ── Focus-target traversal: like findNext/PrevNonButtonPath but buttons ARE stops (their native
// label input). Fields/content are Slate-caret stops. Used by Tab navigation so the editable
// button blocks join the tab order. ──

export type FocusTarget = { kind: "button" | "field"; path: Path };

// Pure-void display fields: no editable caret or sub-input, so landing on them via Tab only
// block-selects (jarring "Ask AI" pop). Tab nav skips them like upload; click/arrow still reach
// them. formMatrix is NOT here — it has editable row/col cells goToFocusTarget focuses.
const SKIP_FOCUS_TYPES = new Set([
  "formFileUpload",
  "formLinearScale",
  "formRating",
  "formSignature",
]);

const isActionButton = (node: TElement | undefined): boolean =>
  node?.type === "formButton" &&
  ((node as Record<string, unknown>).buttonRole || "submit") !== "previous";

// Next focusable target after currentIndex. Buttons traverse in document order (normalize keeps
// Previous immediately before the action button, so forward = Previous → Submit/Next). From an
// action button, same-page trailing content is skipped — only the next page (or a thank-you page)
// is a stop, so the final Submit is the last tab stop unless a page follows it.
export const findNextFocusTarget = (
  editor: PlateEditor,
  currentIndex: number,
): FocusTarget | null => {
  const children = editor.children as TElement[];
  const fromAction = isActionButton(children[currentIndex]);
  let crossedBreak = false;
  for (let i = currentIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;
    if (node.type === "formHeader") continue;
    if (node.type === "pageBreak") {
      crossedBreak = true;
      continue;
    }
    if (node.type === "formButton") return { kind: "button", path: [i] };
    if (fromAction && !crossedBreak) continue; // trailing same-page content after Submit isn't a stop
    if (SKIP_FOCUS_TYPES.has(node.type)) continue; // void display field → skip, not a tab stop
    return { kind: "field", path: [i] };
  }
  return null;
};

// Previous focusable target before currentIndex (buttons included).
export const findPrevFocusTarget = (
  editor: PlateEditor,
  currentIndex: number,
): FocusTarget | null => {
  const children = editor.children as TElement[];
  for (let i = currentIndex - 1; i >= 0; i--) {
    const node = children[i];
    if (!node) continue;
    if (node.type === "formHeader") continue;
    if (node.type === "pageBreak") continue;
    if (node.type === "formButton") return { kind: "button", path: [i] };
    if (SKIP_FOCUS_TYPES.has(node.type)) continue; // void display field → skip, not a tab stop
    return { kind: "field", path: [i] };
  }
  return null;
};

// Focus a target: button → its native label input (deferred so the editor's own focus settles
// first); field → Slate caret, landing inside a matrix void node's first/last input like before.
export const goToFocusTarget = (
  editor: PlateEditor,
  target: FocusTarget,
  goPrev: boolean,
): void => {
  const node = editor.api.node(target.path)?.[0] as TElement | undefined;
  if (target.kind === "button") {
    const input = node ? editor.api.toDOMNode(node)?.querySelector("input") : null;
    if (input instanceof HTMLInputElement) {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    }
    return;
  }
  moveToPath(editor, target.path);
  editor.tf.focus();
  if (node?.type === "formMatrix") {
    const inputs = editor.api.toDOMNode(node)?.querySelectorAll("input");
    if (inputs && inputs.length > 0) {
      const input = goPrev ? inputs[inputs.length - 1] : inputs[0];
      setTimeout(() => input.focus(), 0);
    }
  }
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
