import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { PlateElement, useEditorRef } from "platejs/react";
import * as React from "react";

import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  insertParagraphAfterPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";
import { BlockSelection } from "@/components/ui/block-selection";
import { Checkbox } from "@/components/ui/checkbox";
import type { MatrixEntry } from "@/lib/form-schema/form-field-constants";
import { MATRIX_DEFAULTS, MATRIX_MAX } from "@/lib/form-schema/form-field-constants";
import { generateShortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";

const seedEntries = (labels: readonly string[]): MatrixEntry[] =>
  labels.map((label) => ({ id: generateShortId(), label }));

const readEntries = (raw: unknown, fallback: readonly string[]): MatrixEntry[] => {
  const list = Array.isArray(raw) ? (raw as MatrixEntry[]) : [];
  if (list.length === 0) return seedEntries(fallback);
  return list.map((e) => ({ id: e.id || generateShortId(), label: e.label ?? "" }));
};

// Focus-order key for a label input: column headers first (left→right), then rows (top→bottom).
const colKey = (id: string) => `col:${id}`;
const rowKey = (id: string) => `row:${id}`;
// Tab-order also stops on the add-column / add-row buttons before leaving the matrix.
const ADD_COL_KEY = "add:col";
const ADD_ROW_KEY = "add:row";

export const FormMatrixElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const editor = useEditorRef();

  // Local source of truth while authoring (avoids caret jumps on each keystroke);
  // written through to the node so serialization, duplicate, and undo stay in sync.
  const [rows, setRows] = React.useState<MatrixEntry[]>(() =>
    readEntries(element.rows, MATRIX_DEFAULTS.rows),
  );
  const [columns, setColumns] = React.useState<MatrixEntry[]>(() =>
    readEntries(element.columns, MATRIX_DEFAULTS.columns),
  );

  // Holds the label inputs *and* the add-row/add-col buttons so Tab can land on either.
  const focusables = React.useRef(new Map<string, HTMLElement>());
  const pendingFocus = React.useRef<string | null>(null);
  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) focusables.current.set(key, el);
    else focusables.current.delete(key);
  };
  // Focus a key; select() the text when it's an input, plain focus() for the buttons.
  const focusKey = (key: string) => {
    const el = focusables.current.get(key);
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement) el.select();
  };

  // Focus order: column headers → add-column → row labels → add-row, then out to the next block.
  const orderedKeys = React.useMemo(
    () => [
      ...columns.map((c) => colKey(c.id)),
      ADD_COL_KEY,
      ...rows.map((r) => rowKey(r.id)),
      ADD_ROW_KEY,
    ],
    [columns, rows],
  );

  // Focus a key programmatically after a structural change (add/delete re-renders first).
  React.useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    focusKey(pendingFocus.current);
    pendingFocus.current = null;
  });

  const persist = React.useCallback(
    (patch: { rows?: MatrixEntry[]; columns?: MatrixEntry[] }) => {
      const path = editor.api.findPath(element);
      if (!path) return;
      editor.tf.setNodes(patch as Partial<TElement>, { at: path });
    },
    [editor, element],
  );

  const commitRows = (next: MatrixEntry[]) => {
    setRows(next);
    persist({ rows: next });
  };
  const commitColumns = (next: MatrixEntry[]) => {
    setColumns(next);
    persist({ columns: next });
  };

  const renameRow = (id: string, label: string) =>
    commitRows(rows.map((r) => (r.id === id ? { ...r, label } : r)));
  const renameColumn = (id: string, label: string) =>
    commitColumns(columns.map((c) => (c.id === id ? { ...c, label } : c)));

  const addRowAfter = (id: string | null) => {
    if (rows.length >= MATRIX_MAX.rows) return;
    const fresh: MatrixEntry = { id: generateShortId(), label: "" };
    const at = id === null ? rows.length : rows.findIndex((r) => r.id === id) + 1;
    commitRows([...rows.slice(0, at), fresh, ...rows.slice(at)]);
    pendingFocus.current = rowKey(fresh.id);
  };
  const addColumnAfter = (id: string | null) => {
    if (columns.length >= MATRIX_MAX.columns) return;
    const fresh: MatrixEntry = { id: generateShortId(), label: "" };
    const at = id === null ? columns.length : columns.findIndex((c) => c.id === id) + 1;
    commitColumns([...columns.slice(0, at), fresh, ...columns.slice(at)]);
    pendingFocus.current = colKey(fresh.id);
  };

  // Move focus by N steps in the label tab-order, or hand off to the adjacent form field
  // at the edges (Shift+Tab past the first → previous block; Tab past the last → next block).
  const moveFocus = (currentKey: string, delta: 1 | -1) => {
    const idx = orderedKeys.indexOf(currentKey);
    const targetIdx = idx + delta;
    if (idx !== -1 && targetIdx >= 0 && targetIdx < orderedKeys.length) {
      focusKey(orderedKeys[targetIdx]);
      return;
    }
    // Edge → leave the matrix via the editor's field-to-field navigation.
    const path = editor.api.findPath(element);
    if (!path) return;
    const goPrev = delta === -1;
    const target = goPrev
      ? findPrevNonButtonPath(editor, path)
      : findNextNonButtonPath(editor, path);
    if (target) {
      moveToPath(editor, target);
      editor.tf.focus();
      // If the neighbour is another matrix, land inside its inputs (mirrors NavigationPlugin).
      const targetNode = editor.api.node(target)?.[0] as TElement | undefined;
      if (targetNode?.type === "formMatrix") {
        const fieldInputs = editor.api.toDOMNode(targetNode)?.querySelectorAll("input");
        if (fieldInputs && fieldInputs.length > 0) {
          const input = goPrev ? fieldInputs[fieldInputs.length - 1] : fieldInputs[0];
          setTimeout(() => input.focus(), 0);
        }
      }
      return;
    }
    // No next field (matrix is the last block before Submit) → create a new block after it.
    if (!goPrev) {
      const at = insertParagraphAfterPath(editor, path);
      setTimeout(() => {
        editor.tf.select({ offset: 0, path: [...at, 0] });
        editor.tf.focus();
      }, 0);
    }
  };

  // Delete the row/column when its label is empty (mirrors option-row Backspace); keep ≥1 of each.
  const deleteIfEmpty = (kind: "row" | "col", id: string, currentKey: string): boolean => {
    const list = kind === "row" ? rows : columns;
    if (list.length <= 1) return false;
    const idx = orderedKeys.indexOf(currentKey);
    // Focus the previous label in tab-order after removal.
    pendingFocus.current = idx > 0 ? orderedKeys[idx - 1] : null;
    if (kind === "row") commitRows(rows.filter((r) => r.id !== id));
    else commitColumns(columns.filter((c) => c.id !== id));
    return true;
  };

  const handleKeyDown =
    (kind: "row" | "col", entry: MatrixEntry) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = kind === "row" ? rowKey(entry.id) : colKey(entry.id);
      // Keep Plate's editor handlers from hijacking keys typed inside the void node.
      e.stopPropagation();

      if (e.key === "Tab") {
        e.preventDefault();
        moveFocus(key, e.shiftKey ? -1 : 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (kind === "row") addRowAfter(entry.id);
        else addColumnAfter(entry.id);
        return;
      }
      if (e.key === "Backspace" && e.currentTarget.value === "") {
        if (deleteIfEmpty(kind, entry.id, key)) e.preventDefault();
      }
    };

  // Add-row / add-col buttons sit in the tab-order: Enter activates them (native button click
  // adds a row/col and focuses the new label); Tab/Shift+Tab steps to the next label or block.
  const handleButtonKeyDown = (key: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.key === "Tab") {
      e.preventDefault();
      moveFocus(key, e.shiftKey ? -1 : 1);
    }
  };

  const gridTemplateColumns = `minmax(120px, 1.6fr) repeat(${columns.length}, minmax(72px, 1fr))`;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className="relative flex w-full cursor-default items-start rounded-[8px]"
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>

      <div
        contentEditable={false}
        className="flex flex-1 overflow-hidden rounded-lg bg-background elevation-sm dark:border dark:border-border dark:shadow-none"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header: empty label cell + column-header inputs */}
          <div
            className="grid items-center border-b border-(--color-gray-200) bg-muted/30"
            style={{ gridTemplateColumns }}
          >
            <div className="px-3 py-2" />
            {columns.map((col) => (
              <div key={col.id} className="px-2 py-2">
                <input
                  ref={register(colKey(col.id))}
                  value={col.label}
                  onChange={(e) => renameColumn(col.id, e.target.value)}
                  onKeyDown={handleKeyDown("col", col)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Column label"
                  placeholder="Column"
                  className="w-full bg-transparent text-center text-xs font-medium text-muted-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            ))}
          </div>

          {/* Body rows */}
          {rows.map((row, rowIdx) => (
            <div
              key={row.id}
              className={cn(
                "grid items-center",
                rowIdx > 0 && "border-t border-(--color-gray-200)",
              )}
              style={{ gridTemplateColumns }}
            >
              <div className="px-3 py-1.5">
                <input
                  ref={register(rowKey(row.id))}
                  value={row.label}
                  onChange={(e) => renameRow(row.id, e.target.value)}
                  onKeyDown={handleKeyDown("row", row)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Row label"
                  placeholder="Row"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              {columns.map((col) => (
                <div key={col.id} className="flex items-center justify-center py-1.5">
                  <Checkbox disabled />
                </div>
              ))}
            </div>
          ))}

          {/* Add row — bottom-left corner rounds to the card; bottom-right meets the Add-column strip. */}
          <div className="border-t border-(--color-gray-200)">
            <button
              ref={register(ADD_ROW_KEY)}
              type="button"
              onClick={() => addRowAfter(null)}
              onKeyDown={handleButtonKeyDown(ADD_ROW_KEY)}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex w-full items-center gap-1.5 rounded-bl-lg px-3 py-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <PlusGlyph />
              Add row
            </button>
          </div>
        </div>

        {/* Add column — vertical strip that's part of the table surface (shares the card, split
            by a left divider), mirroring the full-width "Add row". Right corners round to the card. */}
        <button
          ref={register(ADD_COL_KEY)}
          type="button"
          onClick={() => addColumnAfter(null)}
          onKeyDown={handleButtonKeyDown(ADD_COL_KEY)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Add column"
          className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-r-lg border-l border-(--color-gray-200) px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <PlusGlyph />
          <span className="[writing-mode:vertical-rl]">Add column</span>
        </button>
      </div>

      {/* BelowRootNodes (incl. BlockSelection) ride with hidden {children}; render explicitly. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};

const PlusGlyph = () => (
  <svg
    className="size-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <title>Add</title>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
