import { PathApi } from "platejs";
import type { Path, TElement } from "platejs";
import type { PlateEditor } from "platejs/react";
import { createPlatePlugin } from "platejs/react";
import { FormButtonElement } from "@/components/ui/form-button-node";
import { FormFieldElement } from "@/components/ui/form-field-node";
import { FormLabelElement } from "@/components/ui/form-label-node";
import { FormTextareaElement } from "@/components/ui/form-textarea-node";
import { LogicBlockElement } from "@/components/ui/logic-block-node";
import { PageBreakElement } from "@/components/ui/page-break-node";
import { FormFileUploadElement } from "@/components/ui/form-file-upload-node";
import { FormLinearScaleElement } from "@/components/ui/form-linear-scale-node";
import { FormMatrixElement } from "@/components/ui/form-matrix-node";
import { FormRatingElement } from "@/components/ui/form-rating-node";
import { FormSignatureElement } from "@/components/ui/form-signature-node";
import { FormOptionItemElement } from "@/components/ui/form-option-item-node";
import {
  findNextFocusTarget,
  findNextNonButtonPath,
  findPrevFocusTarget,
  findPrevNonButtonPath,
  goToFocusTarget,
  insertParagraphAfterPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";

const FORM_FIELD_TYPES = new Set([
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
const PROTECTED_BUTTON_TYPES = new Set(["formButton"]);

const VOID_FORM_INPUT_TYPES = new Set([
  "formFileUpload",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

const PAGE_FIELD_TYPES = new Set([
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
const NON_EDITABLE_BLOCK_TYPES = new Set([
  "formButton",
  "pageBreak",
  "formHeader",
  "formFileUpload",
  "formLinearScale",
  "formRating",
  "formMatrix",
  "formSignature",
]);

// Block is only content after a preceding pageBreak → delete both, move cursor to prev content block. Returns true if handled.
const tryDeletePageBreakWithEmptyBlock = (editor: PlateEditor, blockPath: Path): boolean => {
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
const handleBackspace = (editor: PlateEditor, event: React.KeyboardEvent): void => {
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
const handleFormFieldEnter = (editor: PlateEditor, event: React.KeyboardEvent): boolean => {
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

export const FormLabelPlugin = createPlatePlugin({
  key: "formLabel",
  node: { isElement: true, component: FormLabelElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormInputPlugin = createPlatePlugin({
  key: "formInput",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

const isFormButton = (node: TElement): boolean => node.type === "formButton";

export const FormButtonPlugin = createPlatePlugin({
  key: "formButton",
  node: {
    isElement: true,
    isVoid: true,
    isSelectable: false,
    component: FormButtonElement,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
    onChange: ({ editor }) => {
      // Redirect selection away from buttons/page-breaks. Last-block-index infers direction (forward across button vs backward).
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const editorRef = editor as any;
      if (editorRef.__redirectingSelection) return;

      const { selection } = editor;
      if (!selection) return;

      const blockIndex = selection.anchor.path[0];
      const lastIndex: number | undefined = editorRef.__lastBlockIndex;
      editorRef.__lastBlockIndex = blockIndex;

      const children = editor.children as TElement[];
      const currentNode = children[blockIndex];
      if (!currentNode) return;

      if (currentNode.type !== "formButton" && currentNode.type !== "pageBreak") return;

      const goForward = lastIndex !== undefined && lastIndex < blockIndex;
      const target = goForward
        ? findNextNonButtonPath(editor, [blockIndex])
        : findPrevNonButtonPath(editor, [blockIndex]);
      if (!target) return;

      const edges = editor.api.edges(target);
      const point = goForward ? edges?.[0] : edges?.[1];
      if (!point) return;

      editorRef.__redirectingSelection = true;
      try {
        editor.tf.select(point);
      } finally {
        editorRef.__redirectingSelection = false;
      }
      editorRef.__lastBlockIndex = target[0];
    },
  },
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  extendEditor: ({ editor }: any) => {
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    const editorRef = editor;
    const { deleteBackward, deleteForward, deleteFragment } = editorRef;

    // Prevent backspace from deleting any form button + handle pageBreak cleanup
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteBackward = (unit: any) => {
      const block = editorRef.api.block();
      if (block) {
        const [node, path] = block;
        const selection = editorRef.selection;
        const isAtStart =
          selection &&
          editorRef.api.isCollapsed(selection) &&
          (() => {
            // eslint-disable-next-line typescript-eslint/no-explicit-any
            const edges = editorRef.api.edges(path);
            const start = edges?.[0];
            return (
              start &&
              PathApi.equals(selection.anchor.path, start.path) &&
              selection.anchor.offset === start.offset
            );
          })();

        if (isAtStart && path && path[0] > 0) {
          const children = editorRef.children as TElement[];
          const currentIndex = path[0];
          const prevNode = children[currentIndex - 1];

          // Block backspace from merging into a formButton
          if (prevNode && isFormButton(prevNode)) {
            return;
          }

          // Empty paragraph after void form input (file upload, multi-select): Plate's default merge dangles selection in trailing paragraph. Remove empty block ourselves, park cursor at end of nearest editable above.
          const isVoidFormInput = prevNode && VOID_FORM_INPUT_TYPES.has(prevNode.type);
          if (isVoidFormInput && editorRef.api.isEmpty(node)) {
            editorRef.tf.removeNodes({ at: path });
            for (let i = currentIndex - 2; i >= 0; i--) {
              const n = children[i];
              if (!n) continue;
              if (NON_EDITABLE_BLOCK_TYPES.has(n.type)) continue;
              const edges = editorRef.api.edges([i]);
              if (edges?.[1]) editorRef.tf.select(edges[1]);
              break;
            }
            return;
          }

          if (editorRef.api.isEmpty(node) && tryDeletePageBreakWithEmptyBlock(editorRef, path)) {
            return;
          }
        }
      }
      deleteBackward(unit);
    };

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteForward = (unit: any) => {
      const block = editorRef.api.block();
      if (block) {
        const [_node, path] = block;
        if (path) {
          const nextIndex = path[0] + 1;
          const nextNode = editorRef.children[nextIndex] as TElement;
          if (nextNode && isFormButton(nextNode)) {
            const selection = editorRef.selection;
            if (selection && editorRef.api.isCollapsed(selection)) {
              // eslint-disable-next-line typescript-eslint/no-explicit-any
              const edges = editorRef.api.edges(path);
              const end = edges?.[1];
              if (
                end &&
                PathApi.equals(selection.anchor.path, end.path) &&
                selection.anchor.offset === end.offset
              ) {
                return;
              }
            }
          }
        }
      }
      deleteForward(unit);
    };

    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.deleteFragment = (direction: any) => {
      const { selection } = editorRef;
      if (!selection) {
        deleteFragment(direction);
        return;
      }
      const selectedNodes = Array.from(
        editorRef.api.nodes({
          at: selection,
          match: (n: TElement) => isFormButton(n),
        }),
      );
      if (selectedNodes.length > 0) return;
      deleteFragment(direction);
    };

    const originalRemoveNodes = editorRef.tf.removeNodes.bind(editorRef.tf);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.tf.removeNodes = (options: any = {}) => {
      const selection = options.at || editorRef.selection;
      if (!selection) return originalRemoveNodes(options);
      const selectedNodes = Array.from(
        editorRef.api.nodes({
          at: selection,
          match: (n: TElement) => isFormButton(n),
        }),
      );
      if (selectedNodes.length > 0) return;
      return originalRemoveNodes(options);
    };

    const originalInsertText = editorRef.tf.insertText.bind(editorRef.tf);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.tf.insertText = (text: string, options?: any) => originalInsertText(text, options);

    const originalSelect = editorRef.tf.select.bind(editorRef.tf);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.tf.select = (target: any) => {
      // Target on form button/pageBreak → redirect. Direction inferred from current selection vs target.
      if (target && typeof target === "object") {
        let targetPath: Path | null = null;
        if ("path" in target) {
          targetPath = target.path;
        } else if ("anchor" in target && target.anchor?.path) {
          targetPath = target.anchor.path;
        }

        if (targetPath && targetPath.length > 0) {
          const blockIndex = targetPath[0];
          const children = editorRef.children as TElement[];
          const targetNode = children[blockIndex];

          if (targetNode && (targetNode.type === "formButton" || targetNode.type === "pageBreak")) {
            const currentIdx = editorRef.selection?.anchor.path[0];
            const goForward = currentIdx !== undefined && currentIdx < blockIndex;
            const redirectTarget = goForward
              ? findNextNonButtonPath(editorRef, [blockIndex])
              : findPrevNonButtonPath(editorRef, [blockIndex]);
            if (!redirectTarget) return;

            const edges = editorRef.api.edges(redirectTarget);
            const point = goForward ? edges?.[0] : edges?.[1];
            if (point) return originalSelect(point);
            return;
          }
        }
      }
      return originalSelect(target);
    };

    const originalInsertNodes = editorRef.tf.insertNodes.bind(editorRef.tf);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.tf.insertNodes = (nodes: any, options: any = {}) => {
      const children = editorRef.children as TElement[];
      let insertPath = options.at;
      if (!insertPath && editorRef.selection) {
        insertPath = editorRef.selection.anchor?.path;
      }

      if (insertPath && Array.isArray(insertPath) && insertPath.length > 0) {
        const insertIndex = insertPath[0];

        // Validate insertion relative to buttons
        const prevNode = children[insertIndex - 1];
        if (prevNode && isFormButton(prevNode)) {
          const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

          // Only allow PageBreaks after a button
          const allPageBreaks = nodeArray.every(
            (n: Record<string, unknown>) => n.type === "pageBreak",
          );

          if (!allPageBreaks) {
            return originalInsertNodes(nodes, {
              ...options,
              at: [insertIndex - 1], // this might be wrong if button is at 0?
            });
          }
        }
      }

      return originalInsertNodes(nodes, options);
    };

    const originalMoveNodes = editorRef.moveNodes.bind(editorRef);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.moveNodes = (options: any) => {
      const { to, at } = options;
      const children = editorRef.children as TElement[];

      let targetIndex = -1;
      if (Array.isArray(to)) targetIndex = to[0];

      if (targetIndex > 0) {
        const prevNode = children[targetIndex - 1];
        if (prevNode && isFormButton(prevNode)) {
          // Moving to after a button. PageBreaks may stay right after a button.
          if (at) {
            const entry = editorRef.api.node(at);
            if (entry) {
              const [node] = entry;
              if (node.type === "pageBreak") {
                return originalMoveNodes(options);
              }
            }
          }
          // Else redirect drop to first position of NEXT page (after trailing pageBreak).
          let pageBreakIndex = -1;
          for (let i = targetIndex; i < children.length; i++) {
            if (children[i]?.type === "pageBreak") {
              pageBreakIndex = i;
              break;
            }
            if (children[i]?.type !== "formButton") break;
          }
          if (pageBreakIndex !== -1) {
            return originalMoveNodes({ ...options, to: [pageBreakIndex + 1] });
          }
          // No pageBreak ahead: redirect before button, not silent no-op (which snaps back despite valid drop indicator).
          return originalMoveNodes({ ...options, to: [targetIndex - 1] });
        }
      }

      return originalMoveNodes(options);
    };
    const originalNormalizeNode = editorRef.normalizeNode.bind(editorRef);
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    editorRef.normalizeNode = (entry: any) => {
      const [_node, path] = entry;

      if (path.length === 0) {
        // Access children directly from editor to ensure fresh state
        const getChildren = () => editorRef.children as TElement[];

        // 1. Ensure empty P at 0 if first block is Button
        if (getChildren().length > 0 && isFormButton(getChildren()[0])) {
          editorRef.tf.insertNodes({ type: "p", children: [{ text: "" }] }, { at: [0] });
          return;
        }

        // 2. Only one thank-you pageBreak allowed. Multiple (paste/undo/load) → keep LAST, demote rest.
        const thankYouIndices: number[] = [];
        const rootChildren = getChildren();
        for (let i = 0; i < rootChildren.length; i++) {
          const n = rootChildren[i];
          if (n?.type === "pageBreak" && (n as Record<string, unknown>).isThankYouPage === true) {
            thankYouIndices.push(i);
          }
        }
        if (thankYouIndices.length > 1) {
          const lastThankYou = thankYouIndices[thankYouIndices.length - 1];
          for (const idx of thankYouIndices) {
            if (idx !== lastThankYou) {
              editorRef.tf.setNodes({ isThankYouPage: false }, { at: [idx] });
            }
          }
          return; // Restart normalization
        }

        const { insertNodes: tfInsertNodes, moveNodes: tfMoveNodes } = editorRef.tf;
        let pageStartIndex = 0;
        for (let i = 0; i <= getChildren().length; i++) {
          const node = getChildren()[i];
          const isPageBreak = node?.type === "pageBreak";
          const isEnd = i === getChildren().length;

          if (isPageBreak || isEnd) {
            // Process Section [pageStartIndex, i-1]
            const pageEndIndex = i; // exclusive
            const isFirstPage = pageStartIndex === 0;
            // isLastPage = true if at document end OR next section is thank you page
            const isLastPage =
              isEnd || (isPageBreak && (node as Record<string, unknown>).isThankYouPage === true);

            let isThankYouSection = false;
            let precedingBreakIndex = -1;
            if (!isFirstPage) {
              const prevBreak = getChildren()[pageStartIndex - 1];
              precedingBreakIndex = pageStartIndex - 1;
              if (
                prevBreak?.type === "pageBreak" &&
                (prevBreak as Record<string, unknown>).isThankYouPage
              ) {
                isThankYouSection = true;
              }
            }

            // Scan for buttons and fields in this section
            const actionButtonIndices: number[] = []; // Track ALL action buttons (next/submit)
            const previousButtonIndices: number[] = []; // Track ALL previous buttons
            let hasFields = false;

            for (let j = pageStartIndex; j < pageEndIndex; j++) {
              const n = getChildren()[j];

              if (PAGE_FIELD_TYPES.has(n.type)) {
                hasFields = true;
              }

              if (n.type === "formButton") {
                const role = (n as Record<string, unknown>).buttonRole || "submit";
                if (role === "previous") {
                  previousButtonIndices.push(j);
                } else {
                  // Next or Submit - collect ALL of them
                  actionButtonIndices.push(j);
                }
              }
            }

            // Remove duplicate Previous buttons (keep only the last one)
            if (previousButtonIndices.length > 1) {
              const indexToRemove = previousButtonIndices[0]; // Remove the first one
              originalRemoveNodes({ at: [indexToRemove] });
              return; // Restart normalization
            }

            // Remove duplicate action buttons (keep only the last one)
            if (actionButtonIndices.length > 1) {
              const indexToRemove = actionButtonIndices[0]; // Remove the first one
              originalRemoveNodes({ at: [indexToRemove] });
              return; // Restart normalization
            }

            const actionButtonIndex = actionButtonIndices.length > 0 ? actionButtonIndices[0] : -1;
            const previousButtonIndex =
              previousButtonIndices.length > 0 ? previousButtonIndices[0] : -1;

            if (precedingBreakIndex !== -1) {
              const prevBreak = getChildren()[precedingBreakIndex] as Record<string, unknown>;
              const currentHasData = prevBreak.hasFormFields === true;
              if (currentHasData !== hasFields) {
                editorRef.tf.setNodes({ hasFormFields: hasFields }, { at: [precedingBreakIndex] });
                return; // Restart normalization to apply change
              }
            }

            if (isThankYouSection) {
              // Thank-you must be FINAL pageBreak. Trailing pageBreak → remove; next iteration absorbs + cleans its content.
              if (isPageBreak) {
                originalRemoveNodes({ at: [i] });
                return; // Restart normalization
              }

              // Thank-you section forbids form fields/buttons/pageBreaks (text/headings/lists OK for the message). Iterate end→start so removal doesn't shift unvisited indices.
              for (let j = pageEndIndex - 1; j >= pageStartIndex; j--) {
                const n = getChildren()[j];
                if (!n) continue;
                const t = n.type;
                const isForbidden =
                  t === "formButton" ||
                  t === "pageBreak" ||
                  (typeof t === "string" && t.startsWith("form"));
                if (isForbidden) {
                  originalRemoveNodes({ at: [j] });
                  return; // Restart normalization
                }
              }

              // Clean thank-you section - skip button enforcement.
              pageStartIndex = i + 1;
              continue;
            }

            // Second pass: orphaned content AFTER action button (Submit on thank-you pages).
            if (actionButtonIndex !== -1) {
              for (let j = actionButtonIndex + 1; j < pageEndIndex; j++) {
                const n = getChildren()[j];
                // Allow empty trailing paragraph
                if (j === pageEndIndex - 1 && n.type === "p" && editorRef.api.isEmpty(n)) {
                  continue;
                }
                // Allow previous button after action button (will be repositioned later)
                if (n.type === "formButton") {
                  continue;
                }

                // Orphaned content after action button → move before button ("Type to Add"; holds for thank-you too).
                tfMoveNodes({ at: [j], to: [actionButtonIndex] });
                return;
              }
            }

            // --- Button Enforcement (Normal Pages) ---

            // 1. First Page: Remove Previous Button if present
            if (isFirstPage && previousButtonIndex !== -1) {
              originalRemoveNodes({ at: [previousButtonIndex] });
              return;
            }

            // 2. Ensure Action Button Exists
            if (actionButtonIndex === -1) {
              const role = isLastPage ? "submit" : "next";
              const labelText = role === "next" ? "Next" : "Submit";
              tfInsertNodes(
                {
                  type: "formButton",
                  buttonRole: role,
                  label: labelText,
                  children: [{ text: "" }],
                },
                { at: [pageEndIndex] },
              );
              return;
            }

            // 3. Validate action button role/text. Smart-update: only if role wrong. Read fresh from editor.
            const actionBtn = getChildren()[actionButtonIndex];
            const currentRole = (actionBtn as Record<string, unknown>).buttonRole || "submit";
            const expectedRole = isLastPage ? "submit" : "next";

            if (currentRole !== expectedRole) {
              // Check if we should update label (if it matches the OLD default)
              const oldDefault = currentRole === "submit" ? "Submit" : "Next";
              // Re-read button - check label property first, fallback to children for backwards compat
              const btn = getChildren()[actionButtonIndex];
              const currentLabel =
                (btn as Record<string, unknown>).label ??
                (btn?.children?.[0] as Record<string, unknown>)?.text;
              const newLabel =
                currentLabel === oldDefault
                  ? expectedRole === "submit"
                    ? "Submit"
                    : "Next"
                  : currentLabel;

              // Replace the entire button node (use originalRemoveNodes to bypass override)
              originalRemoveNodes({ at: [actionButtonIndex] });
              tfInsertNodes(
                {
                  type: "formButton",
                  buttonRole: expectedRole,
                  label: newLabel,
                  children: [{ text: "" }],
                },
                { at: [actionButtonIndex] },
              );
              return;
            }

            // 4. Ensure Previous Button (Non-First Page)
            if (!isFirstPage && previousButtonIndex === -1) {
              tfInsertNodes(
                {
                  type: "formButton",
                  buttonRole: "previous",
                  label: "Previous",
                  children: [{ text: "" }],
                },
                { at: [actionButtonIndex] },
              );
              return;
            }

            // 5. Previous button must sit immediately before action button.
            if (
              !isFirstPage &&
              previousButtonIndex !== -1 &&
              previousButtonIndex !== actionButtonIndex - 1
            ) {
              tfMoveNodes({
                at: [previousButtonIndex],
                to: [actionButtonIndex],
              });
              return;
            }

            pageStartIndex = i + 1;
          }
        }
      }

      return originalNormalizeNode(entry);
    };

    return editorRef;
  },
});

export const FormTextareaPlugin = createPlatePlugin({
  key: "formTextarea",
  node: { isElement: true, component: FormTextareaElement },
  options: { gutterPosition: "top" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const PageBreakPlugin = createPlatePlugin({
  key: "pageBreak",
  node: {
    isElement: true,
    isVoid: true,
    isSelectable: true,
    component: PageBreakElement,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const LogicBlockPlugin = createPlatePlugin({
  key: "logicBlock",
  node: {
    isElement: true,
    isVoid: true,
    isSelectable: true,
    component: LogicBlockElement,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormEmailPlugin = createPlatePlugin({
  key: "formEmail",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormPhonePlugin = createPlatePlugin({
  key: "formPhone",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormNumberPlugin = createPlatePlugin({
  key: "formNumber",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormLinkPlugin = createPlatePlugin({
  key: "formLink",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormDatePlugin = createPlatePlugin({
  key: "formDate",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormTimePlugin = createPlatePlugin({
  key: "formTime",
  node: { isElement: true, component: FormFieldElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormFileUploadPlugin = createPlatePlugin({
  key: "formFileUpload",
  node: { isElement: true, isVoid: true, component: FormFileUploadElement },
  options: { gutterPosition: "top" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormLinearScalePlugin = createPlatePlugin({
  key: "formLinearScale",
  node: { isElement: true, isVoid: true, component: FormLinearScaleElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormRatingPlugin = createPlatePlugin({
  key: "formRating",
  node: { isElement: true, isVoid: true, component: FormRatingElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormMatrixPlugin = createPlatePlugin({
  key: "formMatrix",
  node: { isElement: true, isVoid: true, component: FormMatrixElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormSignaturePlugin = createPlatePlugin({
  key: "formSignature",
  node: { isElement: true, isVoid: true, component: FormSignatureElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
});

export const FormOptionItemPlugin = createPlatePlugin({
  key: "formOptionItem",
  node: { isElement: true, component: FormOptionItemElement },
  options: { gutterPosition: "center" },
  handlers: {
    onKeyDown: ({ editor, event }) => handleBackspace(editor, event),
  },
}).overrideEditor(({ editor, tf: { insertBreak } }) => ({
  transforms: {
    insertBreak: () => {
      const block = editor.api.block();
      if (block && block[0].type === "formOptionItem") {
        const [node, path] = block;

        // Empty option → convert to paragraph (exit list). Enter twice escapes option group to add a field.
        if (editor.api.isEmpty(node)) {
          editor.tf.setNodes({ type: "p", variant: undefined } as unknown as Partial<TElement>, {
            at: path,
          });
          return;
        }

        const nextPath = PathApi.next(path);
        editor.tf.insertNodes(
          {
            type: "formOptionItem",
            variant: node.variant || "checkbox",
            // Inherit the group's label style (letters/numbers/none) — else a new option reverts to
            // the "letters" default and mismatches siblings the user switched to "off".
            ...(node.optionLabel ? { optionLabel: node.optionLabel } : {}),
            children: [{ text: "" }],
          } as TElement,
          { at: nextPath },
        );
        moveToPath(editor, nextPath);
        return;
      }
      insertBreak();
    },
  },
}));

// Global Tab/Shift+Tab nav (skips buttons, page-breaks, header) + Enter-on-form-field (inserts paragraph, doesn't split label; formOptionItem handled by its own insertBreak).
const NavigationPlugin = createPlatePlugin({
  key: "navigation",
  priority: 1000, // Runs before IndentPlugin's Tab handler
  handlers: {
    onKeyDown: ({ editor, event }) => {
      if (handleFormFieldEnter(editor, event)) return;

      const isLogicBlockNavigation =
        event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp";
      if (!isLogicBlockNavigation) return;

      const block = editor.api.block();
      if (!block) return;
      const [node, path] = block;
      const isLogicBlock = node.type === "logicBlock";
      if (!isLogicBlock && event.key !== "Tab") return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      const goPrev = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
      // Focus targets INCLUDE form buttons now (editable label) — Tab from the last field lands on
      // the page's button(s) before crossing to the next page; goToFocusTarget focuses a button's
      // native input or a field's Slate caret (matrix void → first/last input).
      const target = goPrev
        ? findPrevFocusTarget(editor, path[0])
        : findNextFocusTarget(editor, path[0]);

      if (target) {
        goToFocusTarget(editor, target, goPrev);
        return;
      }

      if (isLogicBlock && !goPrev) {
        const at = insertParagraphAfterPath(editor, path);
        setTimeout(() => {
          editor.tf.select({ offset: 0, path: [...at, 0] });
          editor.tf.focus();
        }, 0);
      }
    },
  },
});

// Register AFTER IndentPlugin (ListKit/ToggleKit) so this tab override wraps outermost and short-circuits before indent.
export const TabGuardPlugin = createPlatePlugin({
  key: "tabGuard",
}).overrideEditor(({ editor, tf: { tab } }) => ({
  transforms: {
    // eslint-disable-next-line typescript-eslint/no-explicit-any
    tab: (options: any) => {
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const event = (editor as any).dom?.currentKeyboardEvent;

      if (event?.defaultPrevented) return;

      return tab(options);
    },
  },
}));

export const FormBlocksKit = [
  NavigationPlugin,
  FormLabelPlugin,
  FormInputPlugin,
  FormButtonPlugin,
  FormTextareaPlugin,
  FormEmailPlugin,
  FormPhonePlugin,
  FormNumberPlugin,
  FormLinkPlugin,
  FormDatePlugin,
  FormTimePlugin,
  FormFileUploadPlugin,
  FormLinearScalePlugin,
  FormRatingPlugin,
  FormMatrixPlugin,
  FormSignaturePlugin,
  FormOptionItemPlugin,
  PageBreakPlugin,
  LogicBlockPlugin,
];
