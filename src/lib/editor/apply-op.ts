import type { PlateEditor } from "platejs/react";
import type { TElement } from "platejs";

import { buildFormBlockNodes, buildFormSectionNodes } from "@/lib/editor/ai-form-nodes";
import { matchIcon } from "@/lib/editor/ai-icon-matcher";
import type {
  AddFieldOp,
  AddPageBreakOp,
  AddSectionOp,
  Op,
  ReplaceFieldOp,
  SetHeaderOp,
  SetThemeOp,
} from "@/lib/ai/ops-schema";

export type AppliedOp =
  | {
      kind: "add-field";
      path: number[];
      nodeCount: number;
      snapshot: AddFieldOp;
    }
  | {
      kind: "add-section";
      path: number[];
      nodeCount: number;
      snapshot: AddSectionOp;
    }
  | {
      kind: "set-header";
      snapshot: SetHeaderOp;
    }
  | {
      kind: "set-theme";
      snapshot: SetThemeOp;
    }
  | {
      kind: "replace-field";
      path: number[];
      snapshot: ReplaceFieldOp;
    }
  | {
      kind: "add-page-break";
      path: number[];
      nodeCount: number;
      snapshot: AddPageBreakOp;
    };

export type ApplyContext = {
  editor: PlateEditor;
  /** Initial cursor position captured when generation started */
  initialPathRef: { current: number[] };
  /** Whether any op has been applied yet; first op uses initialPath, rest use tail */
  firstOpRef: { current: boolean };
  /** Edit mode: insert sequentially at the original selection, not appended to end.
   *  Set when replacing a selection. */
  editMode: boolean;
  /** Create mode: form started empty. Used to refuse leading page-breaks. */
  createMode: boolean;
  /** Sequential insert path for edit mode; advanced after each insert */
  nextInsertPathRef: { current: number[] };
  /** Form ID for theme updates; empty when not applicable */
  formId: string;
  /** Count of nodes inserted; used for undo rollback */
  insertedCountRef: { current: number };
  /** Set to true once a thank-you page-break has been applied */
  thankYouEmittedRef: { current: boolean };
  /** Set after first add-field/add-section. Refuses leading add-page-break in create mode. */
  firstContentSeenRef: { current: boolean };
};

const pathNext = (path: number[]): number[] => {
  const next = [...path];
  next[next.length - 1] = (next[next.length - 1] ?? 0) + 1;
  return next;
};

/** Next insertion path: just before trailing Submit button, else at end.
 * Self-healing against normalization injecting nav buttons between inserts. */
const computeInsertPath = (ctx: ApplyContext): number[] => {
  if (ctx.firstOpRef.current) {
    ctx.firstOpRef.current = false;
    ctx.nextInsertPathRef.current = [...ctx.initialPathRef.current];
    return [...ctx.initialPathRef.current];
  }
  if (ctx.editMode) {
    return [...ctx.nextInsertPathRef.current];
  }
  const children = ctx.editor.children as Array<Record<string, unknown>>;
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i];
    if (node?.type === "formButton" && node.buttonRole === "submit") {
      return [i];
    }
  }
  return [children.length];
};

const advanceNextInsert = (ctx: ApplyContext, by: number) => {
  if (!ctx.editMode) return;
  const path = ctx.nextInsertPathRef.current;
  const last = (path[path.length - 1] ?? 0) + by;
  ctx.nextInsertPathRef.current = [...path.slice(0, -1), last];
};

const insertContentNodes = <K extends "add-field" | "add-section">(
  kind: K,
  op: K extends "add-field" ? AddFieldOp : AddSectionOp,
  nodes: TElement[],
  ctx: ApplyContext,
): AppliedOp => {
  const startPath = computeInsertPath(ctx);
  let at = [...startPath];
  for (const node of nodes) {
    ctx.editor.tf.insertNodes(node, { at });
    at = pathNext(at);
    ctx.insertedCountRef.current++;
  }
  advanceNextInsert(ctx, nodes.length);
  ctx.firstContentSeenRef.current = true;
  return { kind, path: startPath, nodeCount: nodes.length, snapshot: op } as AppliedOp;
};

const applyAddField = (op: AddFieldOp, ctx: ApplyContext): AppliedOp =>
  insertContentNodes("add-field", op, buildFormBlockNodes(op), ctx);

const applyAddSection = (op: AddSectionOp, ctx: ApplyContext): AppliedOp =>
  insertContentNodes(
    "add-section",
    op,
    buildFormSectionNodes({ title: op.title, level: op.level }),
    ctx,
  );

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const applySetHeader = (op: SetHeaderOp, ctx: ApplyContext): AppliedOp | null => {
  const header = ctx.editor.children[0] as TElement | undefined;
  if (header?.type !== "formHeader") return null;

  const updates: Record<string, unknown> = {};
  if (op.title) updates.title = op.title;
  if (op.iconKeyword) {
    const iconName = matchIcon(op.iconKeyword);
    if (iconName) updates.icon = iconName;
  }
  if (op.coverColor && HEX_COLOR_PATTERN.test(op.coverColor)) {
    updates.cover = op.coverColor;
  }

  if (Object.keys(updates).length > 0) {
    ctx.editor.tf.setNodes(updates, { at: [0] });
  }

  return { kind: "set-header", snapshot: op };
};

const applySetTheme = (op: SetThemeOp, ctx: ApplyContext): AppliedOp | null => {
  if (!ctx.formId) return null;

  // Fire-and-forget dynamic import; op counts as applied synchronously
  // (return now, avoid apply-loop races).
  void (async () => {
    const collectionsModule = await import("@/collections");
    const localModule = await import("@/collections/local/form");
    const { mergeSetThemeOpIntoCustomization } = await import("@/lib/editor/merge-theme");

    const updateDraft = (draft: { customization?: unknown; updatedAt?: string }) => {
      const current = (draft.customization ?? {}) as Record<string, string>;
      draft.customization = mergeSetThemeOpIntoCustomization(current, op);
      draft.updatedAt = new Date().toISOString();
    };

    // Try cloud form listings first, fall back to local drafts.
    const cloud = collectionsModule.getFormListings();
    if (cloud.get(ctx.formId)) {
      cloud.update(ctx.formId, updateDraft as never);
      return;
    }
    if (localModule.localFormCollection.get(ctx.formId)) {
      localModule.localFormCollection.update(ctx.formId, updateDraft as never);
    }
  })();

  return { kind: "set-theme", snapshot: op };
};

const applyAddPageBreak = (op: AddPageBreakOp, ctx: ApplyContext): AppliedOp => {
  const startPath = computeInsertPath(ctx);
  const node = {
    type: "pageBreak",
    isThankYouPage: op.isThankYou ?? false,
    children: [{ text: "" }],
  } as unknown as TElement;
  ctx.editor.tf.insertNodes(node, { at: startPath });
  ctx.insertedCountRef.current++;
  advanceNextInsert(ctx, 1);
  if (op.isThankYou) {
    ctx.thankYouEmittedRef.current = true;
  }
  return {
    kind: "add-page-break",
    path: startPath,
    nodeCount: 1,
    snapshot: op,
  };
};

const applyReplaceField = (op: ReplaceFieldOp, ctx: ApplyContext): AppliedOp | null => {
  const path = ctx.initialPathRef.current;
  if (path.length === 0) return null;

  const updates: Record<string, unknown> = {};
  if (op.placeholder) updates.placeholder = op.placeholder;
  // label/fieldType/options need structural edits beyond setNodes; only placeholder
  // is live-patchable, caller handles structural replace.

  if (Object.keys(updates).length > 0) {
    ctx.editor.tf.setNodes(updates, { at: path });
  }

  return { kind: "replace-field", path, snapshot: op };
};

export const applyOp = (op: Op, ctx: ApplyContext): AppliedOp | null => {
  // Defense: after thank-you page-break, only allow body ops (sections/fields);
  // block another page-break or new form structures.
  if (ctx.thankYouEmittedRef.current && op.type === "add-page-break") {
    return null;
  }

  // Defense: CREATE mode refuses leading add-page-break (first page implicit, break wastes Page 1).
  if (op.type === "add-page-break" && ctx.createMode && !ctx.firstContentSeenRef.current) {
    return null;
  }

  switch (op.type) {
    case "add-field":
      return applyAddField(op, ctx);
    case "add-section":
      return applyAddSection(op, ctx);
    case "set-header":
      return applySetHeader(op, ctx);
    case "set-theme":
      return applySetTheme(op, ctx);
    case "replace-field":
      return applyReplaceField(op, ctx);
    case "add-page-break":
      return applyAddPageBreak(op, ctx);
    default:
      return null;
  }
};

/** Node at path, or null if out of bounds. Validates a stored path still points to
 * the expected node before mutating (normalization may have shifted nodes). */
const nodeAt = (editor: PlateEditor, path: number[]): Record<string, unknown> | null => {
  if (path.length !== 1) return null;
  const idx = path[0];
  const children = editor.children as Array<Record<string, unknown>>;
  return children[idx] ?? null;
};

export const liveUpdateOp = (op: Op, prev: AppliedOp, editor: PlateEditor): AppliedOp => {
  if (op.type === "add-field" && prev.kind === "add-field") {
    if (op.label && op.label !== prev.snapshot.label) {
      const labelPath = prev.path;
      const stored = nodeAt(editor, labelPath);
      // Mutate only if path still points to our formLabel; if shifted, skip silently
      // (snapshot still updates, so we don't loop).
      if (stored?.type === "formLabel") {
        editor.tf.setNodes(
          { required: op.required ?? prev.snapshot.required ?? false },
          { at: labelPath },
        );
        editor.tf.removeNodes({ at: [...labelPath, 0] });
        editor.tf.insertNodes({ text: op.label }, { at: [...labelPath, 0] });
      }
    }
    return { ...prev, snapshot: { ...prev.snapshot, ...op } };
  }

  if (op.type === "add-section" && prev.kind === "add-section") {
    if (op.title && op.title !== prev.snapshot.title) {
      const path = prev.path;
      const stored = nodeAt(editor, path);
      if (stored && typeof stored.type === "string" && /^h[1-3]$/.test(stored.type)) {
        editor.tf.removeNodes({ at: [...path, 0] });
        editor.tf.insertNodes({ text: op.title }, { at: [...path, 0] });
      }
    }
    return { ...prev, snapshot: { ...prev.snapshot, ...op } };
  }

  if (op.type === "set-header" && prev.kind === "set-header") {
    const header = editor.children[0] as TElement | undefined;
    if (header?.type === "formHeader") {
      const updates: Record<string, unknown> = {};
      if (op.title && op.title !== prev.snapshot.title) {
        updates.title = op.title;
      }
      if (op.iconKeyword && op.iconKeyword !== prev.snapshot.iconKeyword) {
        const iconName = matchIcon(op.iconKeyword);
        if (iconName) updates.icon = iconName;
      }
      if (
        op.coverColor &&
        HEX_COLOR_PATTERN.test(op.coverColor) &&
        op.coverColor !== prev.snapshot.coverColor
      ) {
        updates.cover = op.coverColor;
      }
      if (Object.keys(updates).length > 0) {
        editor.tf.setNodes(updates, { at: [0] });
      }
    }
    return { ...prev, snapshot: { ...prev.snapshot, ...op } };
  }

  return prev;
};

/** True if op is still live-updatable (non-structural changes only). */
export const canLiveUpdate = (op: Op, prev: AppliedOp): boolean => {
  if (op.type === "add-field" && prev.kind === "add-field") {
    return op.label !== prev.snapshot.label || op.required !== prev.snapshot.required;
  }
  if (op.type === "add-section" && prev.kind === "add-section") {
    return op.title !== prev.snapshot.title;
  }
  if (op.type === "set-header" && prev.kind === "set-header") {
    return (
      op.title !== prev.snapshot.title ||
      op.iconKeyword !== prev.snapshot.iconKeyword ||
      op.coverColor !== prev.snapshot.coverColor
    );
  }
  return false;
};
