import { insertCallout } from "@platejs/callout";
import { insertColumnGroup, toggleColumnGroup } from "@platejs/layout";
import {
  insertAudioPlaceholder,
  insertFilePlaceholder,
  insertMedia,
  insertVideoPlaceholder,
} from "@platejs/media";
import { insertToc } from "@platejs/toc";
import { createLogicBlockNode } from "@/components/ui/logic-block-node";
import { MATRIX_DEFAULTS } from "@/lib/form-schema/form-field-constants";
import { generateShortId } from "@/lib/short-id";
import { KEYS, PathApi } from "platejs";
import type { NodeEntry, Path, TElement } from "platejs";
import type { PlateEditor } from "platejs/react";

const ACTION_THREE_COLUMNS = "action_three_columns";

const scrollSelectionIntoView = (editor: PlateEditor) => {
  requestAnimationFrame(() => {
    const block = editor.api.block();
    if (!block) return;
    const domNode = editor.api.toDOMNode(block[0]);
    domNode?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
};

const insertList = (editor: PlateEditor, type: string) => {
  editor.tf.insertNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    { select: true },
  );
};

const insertBlockMap: Record<string, (editor: PlateEditor, type: string) => void> = {
  logicBlock: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    editor.tf.insertNodes(createLogicBlockNode() as unknown as TElement, {
      at: PathApi.next(block[1]),
      select: true,
    });
  },
  [KEYS.listTodo]: insertList,
  [KEYS.ol]: insertList,
  [KEYS.ul]: insertList,
  [ACTION_THREE_COLUMNS]: (editor) => insertColumnGroup(editor, { columns: 3, select: true }),
  [KEYS.audio]: (editor) => insertAudioPlaceholder(editor, { select: true }),
  [KEYS.callout]: (editor) => insertCallout(editor, { select: true }),
  [KEYS.file]: (editor) => insertFilePlaceholder(editor, { select: true }),
  [KEYS.img]: (editor) =>
    insertMedia(editor, {
      select: true,
      type: KEYS.img,
    }),
  [KEYS.mediaEmbed]: (editor) =>
    insertMedia(editor, {
      select: true,
      type: KEYS.mediaEmbed,
    }),
  [KEYS.toc]: (editor) => insertToc(editor, { select: true }),
  [KEYS.video]: (editor) => insertVideoPlaceholder(editor, { select: true }),
  formInput: (editor) => {
    const block = editor.api.block();
    if (!block) return;

    const [, path] = block;
    const labelPath = PathApi.next(path);

    editor.tf.insertNodes(
      {
        type: "formLabel",
        required: true,
        placeholder: "Type a question",
        children: [{ text: "" }],
      } as TElement,
      { at: labelPath },
    );

    editor.tf.insertNodes(
      {
        type: "formInput",
        placeholder: "Type Placeholder text",
        children: [{ text: "" }],
      } as TElement,
      { at: PathApi.next(labelPath) },
    );

    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
    editor.tf.focus();
  },
  formTextarea: (editor) => {
    const block = editor.api.block();
    if (!block) return;

    const [, path] = block;
    const labelPath = PathApi.next(path);

    editor.tf.insertNodes(
      {
        type: "formLabel",
        required: true,
        placeholder: "Type a question",
        children: [{ text: "" }],
      } as TElement,
      { at: labelPath },
    );

    editor.tf.insertNodes(
      {
        type: "formTextarea",
        placeholder: "Type a placeholder",
        children: [{ text: "" }],
      } as TElement,
      { at: PathApi.next(labelPath) },
    );

    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
    editor.tf.focus();
  },
  formEmail: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formEmail", placeholder: "email@example.com", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formPhone: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formPhone", placeholder: "+1 (555) 000-0000", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formNumber: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formNumber", placeholder: "0", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formLink: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formLink", placeholder: "https://example.com", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formDate: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formDate", placeholder: "Select a date", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formTime: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formTime", placeholder: "Select a time", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formFileUpload: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formFileUpload", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formLinearScale: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        // Settings seed the NPS default (1–10, step 1); the block menu edits them.
        {
          type: "formLinearScale",
          scaleMin: 1,
          scaleMax: 10,
          scaleStep: 1,
          children: [{ text: "" }],
        },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formMatrix: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        // Single-select per row by default; the block menu's "Multiple selection" flips it.
        {
          type: "formMatrix",
          rows: MATRIX_DEFAULTS.rows.map((label) => ({ id: generateShortId(), label })),
          columns: MATRIX_DEFAULTS.columns.map((label) => ({ id: generateShortId(), label })),
          children: [{ text: "" }],
        },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formCheckbox: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formOptionItem", variant: "checkbox", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formMultiChoice: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formOptionItem", variant: "multiChoice", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formDropdown: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formOptionItem", variant: "dropdown", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formMultiSelect: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formMultiSelectInput", options: [], children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formRanking: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formOptionItem", variant: "ranking", children: [{ text: "" }] },
        { type: "p", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formRating: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formRating", starCount: 5, children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  formSignature: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;
    const labelPath = PathApi.next(path);
    editor.tf.insertNodes(
      [
        {
          type: "formLabel",
          required: true,
          placeholder: "Type a question",
          children: [{ text: "" }],
        },
        { type: "formSignature", children: [{ text: "" }] },
      ] as unknown as TElement[],
      { at: labelPath },
    );
    editor.tf.select({ path: [...labelPath, 0], offset: 0 });
  },
  pageBreak: (editor) => {
    const block = editor.api.block();
    if (!block) return;
    const [, path] = block;

    const pageBreakPath = PathApi.next(path);
    editor.tf.insertNodes(
      {
        type: "pageBreak",
        isThankYouPage: false,
        children: [{ text: "" }],
      } as TElement,
      { at: pageBreakPath },
    );

    const paragraphPath = PathApi.next(pageBreakPath);
    editor.tf.insertNodes(
      {
        type: "p",
        children: [{ text: "" }],
      } as TElement,
      { at: paragraphPath, select: true },
    );

    scrollSelectionIntoView(editor);
  },
  pageBreakThankYou: (editor) => {
    // Remove isThankYouPage from all existing pageBreak elements
    for (const [, nodePath] of editor.api.nodes({
      match: { type: "pageBreak" },
    })) {
      editor.tf.setNodes({ isThankYouPage: false }, { at: nodePath });
    }

    // Find existing Submit button - it should exist due to normalization
    const children = editor.children as TElement[];
    const submitIndex = children.findIndex(
      (n) => n.type === "formButton" && n.buttonRole === "submit",
    );

    if (submitIndex === -1) {
      // No Submit button - add one and then the thank-you pageBreak
      const block = editor.api.block();
      if (!block) return;
      const [, path] = block;
      const nextPath = PathApi.next(path);

      editor.tf.insertNodes(
        {
          type: "formButton",
          buttonRole: "submit",
          children: [{ text: "Submit" }],
        } as TElement,
        { at: nextPath },
      );

      const pageBreakPath = PathApi.next(nextPath);
      editor.tf.insertNodes(
        {
          type: "pageBreak",
          isThankYouPage: true,
          children: [{ text: "" }],
        } as TElement,
        { at: pageBreakPath },
      );

      // Insert empty paragraph for content (focus here)
      const paragraphPath = PathApi.next(pageBreakPath);
      editor.tf.insertNodes(
        {
          type: "p",
          children: [{ text: "" }],
        } as TElement,
        { at: paragraphPath, select: true },
      );

      scrollSelectionIntoView(editor);
      return;
    }

    const submitPath: Path = [submitIndex];
    const pageBreakPath = PathApi.next(submitPath);
    editor.tf.insertNodes(
      {
        type: "pageBreak",
        isThankYouPage: true,
        children: [{ text: "" }],
      } as TElement,
      { at: pageBreakPath },
    );

    // Insert empty paragraph for content (focus here)
    const paragraphPath = PathApi.next(pageBreakPath);
    editor.tf.insertNodes(
      {
        type: "p",
        children: [{ text: "" }],
      } as TElement,
      { at: paragraphPath, select: true },
    );

    // No buttons after thank you pageBreak - normalizer will handle cleanup

    scrollSelectionIntoView(editor);
  },
};

type InsertBlockOptions = {
  upsert?: boolean;
};

export const insertBlock = (
  editor: PlateEditor,
  type: string,
  options: InsertBlockOptions = {},
) => {
  const { upsert = false } = options;

  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();

    if (!block) return;

    const [currentNode, path] = block;
    const isCurrentBlockEmpty = editor.api.isEmpty(currentNode);
    const currentBlockType = getBlockType(currentNode);
    const isSameBlockType = type === currentBlockType;

    if (upsert && isCurrentBlockEmpty && isSameBlockType) {
      return;
    }

    if (type in insertBlockMap) {
      insertBlockMap[type](editor, type);
    } else {
      editor.tf.insertNodes(editor.api.create.block({ type }), {
        at: PathApi.next(path),
        select: true,
      });
    }

    if (!isSameBlockType) {
      editor.tf.removeNodes({ previousEmptyBlock: true });
    }
  });
};

const setList = (editor: PlateEditor, type: string, entry: NodeEntry<TElement>) => {
  editor.tf.setNodes(
    editor.api.create.block({
      indent: 1,
      listStyleType: type,
    }),
    {
      at: entry[1],
    },
  );
};

const setBlockMap: Record<
  string,
  (editor: PlateEditor, type: string, entry: NodeEntry<TElement>) => void
> = {
  [KEYS.listTodo]: setList,
  [KEYS.ol]: setList,
  [KEYS.ul]: setList,
  [ACTION_THREE_COLUMNS]: (editor) => toggleColumnGroup(editor, { columns: 3 }),
};

export const setBlockType = (editor: PlateEditor, type: string, { at }: { at?: Path } = {}) => {
  editor.tf.withoutNormalizing(() => {
    const setEntry = (entry: NodeEntry<TElement>) => {
      const [node, path] = entry;

      if (node[KEYS.listType]) {
        editor.tf.unsetNodes([KEYS.listType, "indent"], { at: path });
      }
      if (type in setBlockMap) {
        return setBlockMap[type](editor, type, entry);
      }
      if (node.type !== type) {
        editor.tf.setNodes({ type }, { at: path });
      }
    };

    if (at) {
      const entry = editor.api.node<TElement>(at);

      if (entry) {
        setEntry(entry);

        return;
      }
    }

    const entries = editor.api.blocks({ mode: "lowest" });

    entries.forEach((entry) => {
      setEntry(entry);
    });
  });
};

export const getBlockType = (block: TElement) => {
  if (block[KEYS.listType]) {
    if (block[KEYS.listType] === KEYS.ol) {
      return KEYS.ol;
    }
    if (block[KEYS.listType] === KEYS.listTodo) {
      return KEYS.listTodo;
    }
    return KEYS.ul;
  }

  return block.type;
};
