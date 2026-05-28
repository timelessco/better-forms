import { BlockSelectionPlugin } from "@platejs/selection/react";
import { isHotkey, KEYS, NodeApi, PathApi } from "platejs";
import type { SlateEditor, TElement } from "platejs";
import { createPlatePlugin } from "platejs/react";

import { AI_DIFF_KEY } from "@/components/editor/plugins/ai-diff-kit";

const isEmptyParagraph = (editor: SlateEditor): boolean => {
  const block = editor.api.block();
  if (!block) return false;
  const [node, path] = block;
  if (node.type !== KEYS.p || NodeApi.string(node).length !== 0) return false;
  // Skip the trailing normalization paragraph that sits after a submit/next button.
  const blockIndex = path[0];
  if (blockIndex > 0) {
    const prev = (editor.children as TElement[])[blockIndex - 1];
    if (prev?.type === "formButton") return false;
  }
  return true;
};

export type AIInputState = {
  open: boolean;
  /** DOM node the popover is anchored to (a block element). */
  anchor: HTMLElement | null;
  /** Path where the first AI-generated block should land. */
  insertAt: number[];
  /** Selected text/blocks snapshot at the time of invocation. */
  selectionContext: string | null;
  selectedPaths: number[][];
};

const INITIAL_STATE: AIInputState = {
  open: false,
  anchor: null,
  insertAt: [],
  selectionContext: null,
  selectedPaths: [],
};

type CaptureResult = Omit<AIInputState, "open" | "anchor"> & { anchorPath: number[] | null };

const captureContext = (editor: SlateEditor): CaptureResult => {
  let selectionContext: string | null = null;
  let selectedPaths: number[][] = [];
  let insertAt: number[] = [];
  let anchorPath: number[] | null = null;

  const blockSelectionNodes = editor
    .getApi(BlockSelectionPlugin)
    .blockSelection.getNodes({ selectionFallback: false, sort: true });

  if (blockSelectionNodes && blockSelectionNodes.length > 0) {
    selectedPaths = blockSelectionNodes.map((entry: [unknown, number[]]) => [...entry[1]]);
    const lastPath = selectedPaths[selectedPaths.length - 1];
    anchorPath = lastPath;
    insertAt = PathApi.next(lastPath);

    const parts: string[] = [];
    for (const entry of blockSelectionNodes) {
      try {
        const text = NodeApi.string(entry[0] as TElement).trim();
        if (text) parts.push(text);
      } catch {
        // skip
      }
    }
    if (parts.length > 0) selectionContext = parts.join("\n");
    return { selectionContext, selectedPaths, insertAt, anchorPath };
  }

  const block = editor.api.block();
  if (editor.selection && editor.api.isExpanded()) {
    try {
      const text = editor.api.string(editor.selection).trim();
      if (text) selectionContext = text;
    } catch {
      // skip
    }
    anchorPath = block ? [...block[1]] : null;
    insertAt = block ? PathApi.next(block[1]) : [editor.children.length];
    return { selectionContext, selectedPaths, insertAt, anchorPath };
  }

  if (block) {
    anchorPath = [...block[1]];
    // Empty paragraph: let AI insert in its place (pushes the empty p down).
    if (isEmptyParagraph(editor)) {
      insertAt = [...block[1]];
    } else {
      insertAt = PathApi.next(block[1]);
    }
  } else {
    insertAt = [editor.children.length];
  }

  return { selectionContext, selectedPaths, insertAt, anchorPath };
};

const resolveAnchor = (editor: SlateEditor, anchorPath: number[] | null): HTMLElement | null => {
  if (!anchorPath) return null;
  try {
    const entry = editor.api.node(anchorPath);
    if (!entry) return null;
    const dom = editor.api.toDOMNode(entry[0]);
    return (dom as HTMLElement) ?? null;
  } catch {
    return null;
  }
};

export const triggerAIInput = (editor: SlateEditor) => {
  const { anchorPath, ...rest } = captureContext(editor);
  const anchor = resolveAnchor(editor, anchorPath);
  editor.setOption(AIInputPlugin, "ui", { ...rest, anchor, open: true });
};

export const hideAIInput = (editor: SlateEditor) => {
  // Safety net: strip lingering aiDiff marks if a close path skipped accept/rollback. Usually no-op.
  const diffEntries = Array.from(
    editor.api.nodes({
      at: [],
      match: (n) => Boolean((n as Record<string, unknown>)[AI_DIFF_KEY]),
    }),
  ) as Array<[unknown, number[]]>;
  if (diffEntries.length > 0) {
    editor.tf.withoutNormalizing(() => {
      for (const [, path] of diffEntries) {
        editor.tf.unsetNodes(AI_DIFF_KEY, { at: path });
      }
    });
  }
  editor.setOption(AIInputPlugin, "ui", INITIAL_STATE);
  // Return focus to the editor so Escape doesn't leave focus on <body>.
  editor.tf.focus();
};

export const toggleAIInput = (editor: SlateEditor) => {
  const current = editor.getOption(AIInputPlugin, "ui");
  if (current.open) {
    hideAIInput(editor);
    return;
  }
  triggerAIInput(editor);
};

export const AIInputPlugin = createPlatePlugin({
  key: "ai_input",
  options: {
    formId: "" as string,
    ui: INITIAL_STATE,
  },
  handlers: {
    onKeyDown: ({ editor, event }) => {
      if (isHotkey("mod+j")(event)) {
        event.preventDefault();
        toggleAIInput(editor);
        return;
      }
      if (event.key === " " && isEmptyParagraph(editor)) {
        event.preventDefault();
        triggerAIInput(editor);
      }
    },
  },
});
