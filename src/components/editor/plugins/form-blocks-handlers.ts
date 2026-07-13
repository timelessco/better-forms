import type { Path, TElement } from "platejs";
import type { PlateEditor } from "platejs/react";
import { findPrevNonButtonPath, moveToPath } from "@/components/editor/plugins/form-blocks-utils";

export const FORM_FIELD_TYPES = new Set([
  "formInput",
  "formTextarea",
  "formEmail",
  "formPhone",
  "formNumber",
  "formLink",
  "formDate",
  "formTime",
  "formFileUpload",
  "formOptionItem",
  "formLinearScale",
  "formRating",
  "formSignature",
  "formButton",
  "formLabel",
  "pageBreak",
]);

// Button types that should not be deleted
export const PROTECTED_BUTTON_TYPES = new Set(["formButton"]);

export const VOID_FORM_INPUT_TYPES = new Set([
  "formFileUpload",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

export const PAGE_FIELD_TYPES = new Set([
  "formInput",
  "formTextarea",
  "formLabel",
  "formRadioGroup",
  "formCheckbox",
  "formOptionItem",
  "formSelect",
  "formDatePicker",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

export const NON_EDITABLE_BLOCK_TYPES = new Set([
  "formButton",
  "pageBreak",
  "formHeader",
  "formFileUpload",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

export const isFormButton = (node: TElement): boolean => node.type === "formButton";

// Block is only content after a preceding pageBreak → delete both, move cursor to prev content block. Returns true if handled.
export const tryDeletePageBreakWithEmptyBlock = (editor: PlateEditor, blockPath: Path): boolean => {
  const children = editor.children as TElement[];
  const currentIndex = blockPath[0];

  let pageBreakIndex = -1;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prev = children[i];
    if (prev.type === "formButton") continue;
    if (prev.type === "pageBreak") {
      pageBreakIndex = i;
    }
    break;
  }

  if (pageBreakIndex === -1) return false;

  let hasOtherContent = false;
  for (let i = pageBreakIndex + 1; i < children.length; i++) {
    if (i === currentIndex) continue;
    const n = children[i];
    if (n.type === "pageBreak" || n.type === "formButton") break;
    hasOtherContent = true;
    break;
  }

  if (hasOtherContent) return false;

  const prevPath = findPrevNonButtonPath(editor, [pageBreakIndex]);
  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at: blockPath });
    editor.tf.removeNodes({ at: [pageBreakIndex] });
  });
  if (prevPath) {
    const edges = editor.api.edges(prevPath);
    if (edges?.[1]) {
      editor.tf.select(edges[1]);
    }
  }
  return true;
};

// Backspace on form-field blocks: empty-option collapse, page-break cleanup, button protection.
export const handleBackspace = (editor: PlateEditor, event: React.KeyboardEvent): void => {
  if (event.key !== "Backspace") return;

  const block = editor.api.block();
  if (!block || !FORM_FIELD_TYPES.has(block[0].type)) return;

  const [node, path] = block;
  if (!editor.api.isEmpty(node)) return;

  // Empty formOptionItem → delete unless only option.
  if (node.type === "formOptionItem") {
    event.preventDefault();
    event.stopPropagation();

    const children = editor.children as TElement[];
    const prevNode = children[path[0] - 1];
    const nextNode = children[path[0] + 1];
    const isPrevLabel = prevNode?.type === "formLabel";
    const isNextOption = nextNode?.type === "formOptionItem";

    if (isPrevLabel && !isNextOption) {
      editor.tf.setNodes({ type: "p", variant: undefined } as unknown as Partial<TElement>, {
        at: path,
      });
      return;
    }

    const prevPath: Path = [path[0] - 1];
    editor.tf.removeNodes({ at: path });
    const edges = editor.api.edges(prevPath);
    if (edges?.[1]) {
      editor.tf.select(edges[1]);
    }
    return;
  }

  if (PROTECTED_BUTTON_TYPES.has(node.type)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (tryDeletePageBreakWithEmptyBlock(editor, path)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  editor.tf.removeNodes({ at: path });
};

// Enter on form-field: insert paragraph below + move cursor, don't split label. formOptionItem excluded (own plugin continues option list).
export const handleFormFieldEnter = (editor: PlateEditor, event: React.KeyboardEvent): boolean => {
  if (event.key !== "Enter" || event.shiftKey) return false;

  const block = editor.api.block();
  if (!block) return false;

  const [node, path] = block;
  if (!FORM_FIELD_TYPES.has(node.type)) return false;
  if (node.type === "formOptionItem") return false;
  if (node.type === "formButton" || node.type === "pageBreak") {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();

  // Label directly above void form field: land paragraph after the whole label+input group, else no way to escape past trailing void input (e.g. file upload).
  let insertIndex = path[0] + 1;
  if (node.type === "formLabel") {
    const siblings = editor.children as TElement[];
    const next = siblings[insertIndex];
    // Option-based field (checkbox/multi-choice/dropdown/ranking): drop the caret into the first
    // option to fill it, instead of splitting a stray paragraph between the label and its options.
    if (next?.type === "formOptionItem") {
      moveToPath(editor, [insertIndex]);
      return true;
    }
    if (next && VOID_FORM_INPUT_TYPES.has(next.type)) {
      insertIndex += 1;
    }
  }
  const nextPath = [insertIndex];
  editor.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, {
    at: nextPath,
  });
  moveToPath(editor, nextPath);
  return true;
};
