import { PathApi } from "platejs";
import type { Path, TElement } from "platejs";
import type { PlateEditor } from "platejs/react";
import {
  isFormButton,
  NON_EDITABLE_BLOCK_TYPES,
  PAGE_FIELD_TYPES,
  tryDeletePageBreakWithEmptyBlock,
  VOID_FORM_INPUT_TYPES,
} from "@/components/editor/plugins/form-blocks-handlers";
import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
} from "@/components/editor/plugins/form-blocks-utils";

// Per-editor selection-redirect bookkeeping. Was stashed on the editor via `editor as any`
// (__redirectingSelection / __lastBlockIndex); a WeakMap keys it typed and off the instance.
type ButtonSelectionState = {
  redirectingSelection: boolean;
  lastBlockIndex: number | undefined;
};

const buttonSelectionStates = new WeakMap<PlateEditor, ButtonSelectionState>();

const getButtonSelectionState = (editor: PlateEditor): ButtonSelectionState => {
  let state = buttonSelectionStates.get(editor);
  if (!state) {
    state = { redirectingSelection: false, lastBlockIndex: undefined };
    buttonSelectionStates.set(editor, state);
  }
  return state;
};

// FormButton onChange: redirect selection away from buttons/page-breaks. Last-block-index infers
// direction (forward across button vs backward).
export const formButtonOnChange = (editor: PlateEditor): void => {
  const state = getButtonSelectionState(editor);
  if (state.redirectingSelection) return;

  const { selection } = editor;
  if (!selection) return;

  const blockIndex = selection.anchor.path[0];
  const lastIndex = state.lastBlockIndex;
  state.lastBlockIndex = blockIndex;

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

  state.redirectingSelection = true;
  try {
    editor.tf.select(point);
  } finally {
    state.redirectingSelection = false;
  }
  state.lastBlockIndex = target[0];
};

// Non-pageBreak content inserted right after a button → redirect before the button.
// Returns the corrected top-level index, or null to keep the requested position.
// Button at index 0 → returns 0: content lands before the button (correct); the root normalizer
// then keeps an empty paragraph at index 0. insertIndex 0 can't reach here (no prev node).
export const redirectInsertBeforeButton = (
  children: TElement[],
  insertIndex: number,
  nodes: TElement | TElement[],
): number | null => {
  const prevNode = children[insertIndex - 1];
  if (!prevNode || !isFormButton(prevNode)) return null;

  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];
  // Only PageBreaks are allowed to sit immediately after a button.
  const allPageBreaks = nodeArray.every((n) => (n as Record<string, unknown>).type === "pageBreak");
  if (allPageBreaks) return null;

  return insertIndex - 1;
};

// Wires FormButton's editor overrides: backspace/forward/fragment deletion guards, button-safe
// removeNodes/select/insertNodes/moveNodes, and the page-break + button-enforcement normalizer.
// eslint-disable-next-line typescript-eslint/no-explicit-any
export const extendFormButtonEditor = ({ editor }: { editor: any }) => {
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
      const redirect = redirectInsertBeforeButton(children, insertPath[0], nodes);
      if (redirect !== null) {
        return originalInsertNodes(nodes, {
          ...options,
          at: [redirect],
        });
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
};
