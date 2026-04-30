import { PathApi } from "platejs";
import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { PlateElement, useEditorRef, useEditorSelector, useFocused } from "platejs/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-kit";
import { BlockSelection } from "@/components/ui/block-selection";
import { TagIcon, XIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { MULTI_SELECT_COLORS } from "./form-option-item-constants";

export const FormMultiSelectInputElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const editor = useEditorRef();
  const options = (element.options as string[]) ?? [];
  const elementId = (element as { id?: string }).id;
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);

  const focused = useFocused();
  const isSelected = useEditorSelector(
    (ed) => {
      if (!ed.selection) return false;
      const path = ed.api.findPath(element);
      if (!path) return false;
      const focusPath = ed.selection.focus.path;
      if (focusPath.length < path.length) return false;
      for (let i = 0; i < path.length; i++) {
        if (focusPath[i] !== path[i]) return false;
      }
      return true;
    },
    [elementId],
  );

  // Auto-focus internal input when Plate selects this void node
  useEffect(() => {
    if (isSelected && focused) {
      inputRef.current?.focus();
    }
  }, [isSelected, focused]);

  const setNodeOptions = useCallback(
    (newOptions: string[]) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ options: newOptions }, { at: path });
      }
    },
    [editor, element],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Chip-navigation mode: arrows move between chips, Backspace/Delete removes focused chip.
    if (focusedChipIndex !== null) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedChipIndex(Math.max(0, focusedChipIndex - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (focusedChipIndex >= options.length - 1) {
          setFocusedChipIndex(null);
        } else {
          setFocusedChipIndex(focusedChipIndex + 1);
        }
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        const newOptions = options.filter((_, i) => i !== focusedChipIndex);
        setNodeOptions(newOptions);
        if (newOptions.length === 0) {
          setFocusedChipIndex(null);
        } else {
          setFocusedChipIndex(Math.min(focusedChipIndex, newOptions.length - 1));
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setFocusedChipIndex(null);
        return;
      }
      // Any other key — exit chip-nav mode and let the input process it
      setFocusedChipIndex(null);
    }

    // ArrowLeft at input start with existing chips → enter chip-navigation mode
    if (
      e.key === "ArrowLeft" &&
      inputRef.current?.selectionStart === 0 &&
      inputRef.current?.selectionEnd === 0 &&
      options.length > 0
    ) {
      e.preventDefault();
      setFocusedChipIndex(options.length - 1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      const trimmed = inputValue.trim();

      // Empty input → create a new paragraph below (same as Enter on any form field)
      if (!trimmed) {
        inputRef.current?.blur();
        const path = editor.api.findPath(element);
        if (!path) return;
        const nextPath = PathApi.next(path);
        editor.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, {
          at: nextPath,
        });
        moveToPath(editor, nextPath);
        editor.tf.focus();
        return;
      }

      if (options.includes(trimmed)) return;
      setNodeOptions([...options, trimmed]);
      setInputValue("");
    } else if (e.key === "Backspace" && inputValue === "") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (options.length > 0) {
        setNodeOptions(options.slice(0, -1));
      } else {
        inputRef.current?.blur();
        const path = editor.api.findPath(element);
        if (path) {
          editor.tf.select(path);
          editor.tf.removeNodes({ at: path });
          if (path[0] > 0) {
            const prevPath = findPrevNonButtonPath(editor, path);
            if (prevPath) {
              const edges = editor.api.edges(prevPath);
              if (edges?.[1]) {
                editor.tf.select(edges[1]);
              }
            }
          }
        }
      }
    } else if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      // ArrowLeft/Right should navigate within the input natively; Up/Down and Tab
      // bridge to block-level navigation.
      const goPrev = e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey);
      e.preventDefault();
      e.stopPropagation();
      inputRef.current?.blur();
      const path = editor.api.findPath(element);
      if (!path) return;
      const target = goPrev
        ? findPrevNonButtonPath(editor, path)
        : findNextNonButtonPath(editor, path);
      if (target) {
        moveToPath(editor, target);
        editor.tf.focus();
      }
    }
  };

  const handleRemoveOption = (index: number) => {
    setNodeOptions(options.filter((_, i) => i !== index));
  };

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative flex min-h-7 w-full max-w-[464px] cursor-default items-center rounded-[8px] border-0 bg-[var(--color-gray-50)] px-2 py-1 text-sm shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)]",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      <div
        contentEditable={false}
        role="group"
        className="flex flex-1 flex-wrap items-center gap-1"
        onClick={() => inputRef.current?.focus()}
        onKeyDownCapture={(e) => {
          // Catch Tab from any child (including chip × buttons) before browser moves focus
          if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            inputRef.current?.blur();
            const path = editor.api.findPath(element);
            if (!path) return;
            const target = e.shiftKey
              ? findPrevNonButtonPath(editor, path)
              : findNextNonButtonPath(editor, path);
            if (target) {
              moveToPath(editor, target);
              editor.tf.focus();
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.focus();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {options.map((opt, optIndex) => {
          const color = MULTI_SELECT_COLORS[optIndex % MULTI_SELECT_COLORS.length];
          const isChipFocused = focusedChipIndex === optIndex;
          return (
            <span
              key={opt}
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                color.bg,
                color.text,
                isChipFocused && "ring-2 ring-ring",
              )}
            >
              {opt}
              <button
                type="button"
                tabIndex={-1}
                className="ml-1 inline-flex size-3 items-center justify-center rounded-full hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveOption(optIndex);
                }}
                aria-label={`Remove ${opt}`}
              >
                <XIcon className="size-2.5" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocusedChipIndex(null)}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && e.currentTarget.closest('[data-bf-input="true"]')?.contains(next)) {
              return;
            }
            if (editor.selection) {
              editor.tf.deselect();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={
            options.length === 0 ? "Type and press Enter to add options" : "Add option..."
          }
          className="min-w-[80px] flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              contentEditable={false}
              className="mr-1 ml-1 flex shrink-0 items-center justify-center text-muted-foreground select-none"
            />
          }
        >
          <TagIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="left">Multi-select</TooltipContent>
      </Tooltip>
      {/* Plate passes BelowRootNodes (which includes BlockSelection) as a
          sibling of `children`, so wrapping {children} in `display:none`
          above also hides the highlight. Render it explicitly instead. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
