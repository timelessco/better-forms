import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { PlateElement, useEditorRef } from "platejs/react";
import * as React from "react";

import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";
import { BlockSelection } from "@/components/ui/block-selection";
import { Checkbox } from "@/components/ui/checkbox";
import { IconMatrix } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

  const inputs = React.useRef(new Map<string, HTMLInputElement | null>());
  const pendingFocus = React.useRef<string | null>(null);
  const registerInput = (key: string) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(key, el);
    else inputs.current.delete(key);
  };

  // Focus order: every column header, then every row label.
  const orderedKeys = React.useMemo(
    () => [...columns.map((c) => colKey(c.id)), ...rows.map((r) => rowKey(r.id))],
    [columns, rows],
  );

  // Focus a key programmatically after a structural change (add/delete re-renders first).
  React.useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const el = inputs.current.get(pendingFocus.current);
    pendingFocus.current = null;
    if (el) {
      el.focus();
      el.select();
    }
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
      inputs.current.get(orderedKeys[targetIdx])?.focus();
      inputs.current.get(orderedKeys[targetIdx])?.select();
      return;
    }
    // Edge → leave the matrix via the editor's field-to-field navigation.
    const path = editor.api.findPath(element);
    if (!path) return;
    const next =
      delta === 1 ? findNextNonButtonPath(editor, path) : findPrevNonButtonPath(editor, path);
    if (next) moveToPath(editor, next);
    editor.tf.focus();
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

  const gridTemplateColumns = `minmax(120px, 1.6fr) repeat(${columns.length}, minmax(72px, 1fr))`;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className="relative flex w-full cursor-default items-start gap-2 rounded-[8px]"
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>

      <div
        contentEditable={false}
        className="flex-1 overflow-hidden rounded-lg bg-background elevation-sm dark:border dark:border-border dark:shadow-none"
      >
        {/* Header: empty label cell + column-header inputs */}
        <div
          className="grid items-center border-b border-(--color-gray-200) bg-muted/30"
          style={{ gridTemplateColumns }}
        >
          <div className="px-3 py-2" />
          {columns.map((col) => (
            <div key={col.id} className="px-2 py-2">
              <input
                ref={registerInput(colKey(col.id))}
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
            className={cn("grid items-center", rowIdx > 0 && "border-t border-(--color-gray-200)")}
            style={{ gridTemplateColumns }}
          >
            <div className="px-3 py-1.5">
              <input
                ref={registerInput(rowKey(row.id))}
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

        {/* Add row */}
        <div className="border-t border-(--color-gray-200)">
          <button
            type="button"
            onClick={() => addRowAfter(null)}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <PlusGlyph />
            Add row
          </button>
        </div>
      </div>

      {/* Add column + type badge */}
      <div contentEditable={false} className="flex shrink-0 flex-col items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => addColumnAfter(null)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Add column"
                className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              />
            }
          >
            <PlusGlyph />
          </TooltipTrigger>
          <TooltipContent side="left">Add column</TooltipContent>
        </Tooltip>
        <span className="flex items-center justify-center text-muted-foreground select-none">
          <IconMatrix className="size-3.5" />
        </span>
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
