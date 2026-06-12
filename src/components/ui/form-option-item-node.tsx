import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { DndPlugin } from "@platejs/dnd";
import {
  PlateElement,
  useEditorRef,
  useEditorSelector,
  useEditorVersion,
  useFocused,
  usePluginOption,
} from "platejs/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";
import { BlockSelection } from "@/components/ui/block-selection";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDownIcon,
  Loader2Icon,
  PhotoIcon,
  RankDragHandleIcon,
  TagIcon,
  XIcon,
} from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUploadFile } from "@/hooks/use-upload-file";
import { RequiredBadgeButton } from "@/components/ui/required-badge-button";
import { useFormIsDark } from "@/hooks/use-form-theme";
import { cn } from "@/lib/utils";

type OptionVariant = "checkbox" | "multiChoice" | "ranking";

import { getMultiSelectColor, getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";

// Letters/Numbers labels: an ordinal badge in a gray box (Figma nodes 25578:9710 / 25578:9688) —
// gray-100 fill, dark gray-900 text @ 12px Medium, flat (no shadow). Pin gray-100 (not the form's
// --form-input-bg, which themed forms remap to white → invisible badge).
const OptionLabelBadge = ({ text }: { text: string }) => (
  <span className="flex size-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] bg-gray-100 px-0.5 text-[12px] font-medium text-gray-900">
    {text}
  </span>
);

const OptionIcon = ({
  variant,
  index,
  optionLabel,
}: {
  variant: OptionVariant;
  index: number;
  optionLabel: OptionLabelStyle;
}) => {
  // Letters/Numbers override the native control with an ordinal badge, regardless of variant.
  if (optionLabel === "letters" || optionLabel === "numbers") {
    return <OptionLabelBadge text={getOptionOrdinal(optionLabel, index)} />;
  }

  switch (variant) {
    case "checkbox":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Checkbox disabled className="pointer-events-none after:hidden" />
        </span>
      );
    case "ranking":
      // Reorder handle (Figma 26153-13884): "=" two-bar drag glyph left of each rankable option.
      return (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <RankDragHandleIcon className="size-4" />
        </span>
      );
    case "multiChoice":
      // Labels "None" → the radio control (Figma node 25458:16773). size-4 to match the
      // letter/number badge column (and the published OptionRadioMark), so the label x stays
      // put when the label style changes between None and Letters/Numbers.
      return (
        <span className="flex size-4 shrink-0 rounded-full border border-input bg-card elevation-sm" />
      );
    default:
      return null;
  }
};

// Per-option image (Figma 25755:3987): 144×60 rounded thumbnail below the label. Empty slot uploads
// on click; filled slot offers replace/remove on hover.
const OptionImageSlot = ({
  image,
  uploading,
  onPick,
  onRemove,
}: {
  image?: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = () => inputRef.current?.click();
  return (
    <div contentEditable={false} className="mt-1.5 pl-6 select-none">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="group/img relative aspect-[4/3] w-[200px] overflow-hidden rounded-lg bg-gray-100">
          {/* Fixed-aspect cover crop — matches the live picture-choice tile, so a tall screenshot
              renders as a clean thumbnail instead of a 280px-wide column. */}
          <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/50 text-xs text-white group-hover/img:flex">
            <button
              type="button"
              onClick={open}
              className="rounded px-1.5 py-0.5 hover:bg-white/20"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded px-1.5 py-0.5 hover:bg-white/20"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={uploading}
          className="flex aspect-[4/3] w-[200px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-input bg-gray-100 text-xs text-muted-foreground hover:bg-gray-200 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <>
              <PhotoIcon className="size-4" />
              Add image
            </>
          )}
        </button>
      )}
    </div>
  );
};

const nodeText = (n: TElement | undefined): string =>
  ((n?.children as Array<{ text?: string }>) ?? []).map((c) => c.text ?? "").join("");

/** Editor control for an option group with "Show as dropdown" on — the chips input (revived from
 * the old formMultiSelectInput node). Chips mirror the sibling option nodes: × or Backspace
 * removes a node, Enter in the inline input appends one. Group flags (showAsDropdown, required,
 * selection limits…) live on the FIRST option node, so removing chip 0 pulls the next text up and
 * drops the next node instead of removing the flag-holder. Checkbox groups (multi answer) get the
 * multi-select colored chips; multiChoice groups (single answer) get neutral gray chips + a
 * chevron badge so the two dropdown kinds read apart at a glance. */
const OptionChipsRow = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const editor = useEditorRef();
  const isDark = useFormIsDark();
  // element is the group's first node — its variant decides the chip treatment.
  const variant = (element.variant as string) || "checkbox";
  const colored = variant === "checkbox";
  // Re-render on every content change so chips track sibling node edits/removals.
  useEditorVersion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [focusedChipIndex, setFocusedChipIndex] = useState<number | null>(null);

  // Fresh group span + chips on every call — node indices shift under edits.
  const collect = useCallback(() => {
    const nodes = editor.children as TElement[];
    const start = nodes.indexOf(element);
    let end = start;
    while (end >= 0 && nodes[end + 1]?.type === "formOptionItem") end++;
    const chips: { text: string; nodeIdx: number }[] = [];
    if (start >= 0) {
      for (let i = start; i <= end; i++) {
        const t = nodeText(nodes[i]).trim();
        if (t) chips.push({ text: t, nodeIdx: i });
      }
    }
    return { nodes, start, end, chips };
  }, [editor, element]);

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
    [(element as { id?: string }).id],
  );

  // Caret landing in this block (its text is hidden) → hand focus to the inline input.
  useEffect(() => {
    if (isSelected && focused) inputRef.current?.focus();
  }, [isSelected, focused]);

  // Empty sibling nodes render no chip and would be unreachable (and emit phantom "Option N"
  // entries in the live dropdown) — drop them. The first node may stay empty: it holds the flags.
  useEffect(() => {
    const { nodes, start, end } = collect();
    if (start < 0 || end === start) return;
    const empties: number[] = [];
    for (let i = end; i > start; i--) {
      if (!nodeText(nodes[i]).trim()) empties.push(i);
    }
    if (empties.length === 0) return;
    editor.tf.withoutNormalizing(() => {
      for (const i of empties) editor.tf.removeNodes({ at: [i] });
    });
  });

  // Replace a node's text in place, preserving every other prop (the first node carries the flags).
  const setNodeTextAt = useCallback(
    (at: number, text: string) => {
      const node = (editor.children as TElement[])[at];
      if (!node) return;
      const { children: _children, ...nodeProps } = node;
      editor.tf.withoutNormalizing(() => {
        editor.tf.removeNodes({ at: [at] });
        editor.tf.insertNodes({ ...nodeProps, children: [{ text }] } as TElement, { at: [at] });
      });
    },
    [editor],
  );

  const addOption = (text: string) => {
    const { nodes, start, end } = collect();
    if (start < 0) return;
    // Fresh group: a single empty node — fill it instead of appending a phantom sibling.
    if (end === start && !nodeText(nodes[start]).trim()) {
      setNodeTextAt(start, text);
      return;
    }
    editor.tf.insertNodes(
      { type: "formOptionItem", variant, children: [{ text }] } as unknown as TElement,
      { at: [end + 1] },
    );
  };

  const removeOption = (chipIdx: number) => {
    const { nodes, start, chips } = collect();
    const target = chips[chipIdx];
    if (!target) return;
    if (target.nodeIdx !== start) {
      editor.tf.removeNodes({ at: [target.nodeIdx] });
      return;
    }
    const next = nodes[start + 1];
    if (next?.type === "formOptionItem") {
      setNodeTextAt(start, nodeText(next));
      editor.tf.removeNodes({ at: [start + 1] });
    } else {
      setNodeTextAt(start, "");
    }
  };

  // Backspace on an empty input with no chips → delete the whole field, caret to previous block.
  const deleteGroup = () => {
    const { start, end } = collect();
    if (start < 0) return;
    inputRef.current?.blur();
    editor.tf.withoutNormalizing(() => {
      for (let i = end; i >= start; i--) editor.tf.removeNodes({ at: [i] });
    });
    if (start > 0) {
      const prevPath = findPrevNonButtonPath(editor, [start]);
      if (prevPath) {
        const edges = editor.api.edges(prevPath);
        if (edges?.[1]) editor.tf.select(edges[1]);
        editor.tf.focus();
      }
    }
  };

  const bridgeToBlock = (goPrev: boolean) => {
    const { start, end } = collect();
    if (start < 0) return;
    inputRef.current?.blur();
    const target = goPrev
      ? findPrevNonButtonPath(editor, [start])
      : findNextNonButtonPath(editor, [end]);
    if (target) {
      moveToPath(editor, target);
      editor.tf.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { chips, end } = collect();
    // Chip-navigation mode: arrows move between chips, Backspace/Delete removes focused chip.
    if (focusedChipIndex !== null) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedChipIndex(Math.max(0, focusedChipIndex - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedChipIndex(focusedChipIndex >= chips.length - 1 ? null : focusedChipIndex + 1);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeOption(focusedChipIndex);
        const remaining = chips.length - 1;
        setFocusedChipIndex(remaining <= 0 ? null : Math.min(focusedChipIndex, remaining - 1));
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
      chips.length > 0
    ) {
      e.preventDefault();
      setFocusedChipIndex(chips.length - 1);
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
        const at = [end + 1];
        editor.tf.insertNodes({ type: "p", children: [{ text: "" }] } as TElement, { at });
        moveToPath(editor, at);
        editor.tf.focus();
        return;
      }

      if (chips.some((c) => c.text === trimmed)) return;
      addOption(trimmed);
      setInputValue("");
    } else if (e.key === "Backspace" && inputValue === "") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (chips.length > 0) removeOption(chips.length - 1);
      else deleteGroup();
    } else if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Left/Right navigate the input natively; Up/Down and Tab bridge to block navigation.
      e.preventDefault();
      e.stopPropagation();
      bridgeToBlock(e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey));
    }
  };

  const { chips } = collect();

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative flex min-h-7 w-full max-w-116 cursor-default items-center rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2 py-1 text-sm elevation-sm",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
      element={element}
      {...rest}
    >
      {/* This node's own text is chip 0 — rendered via the chips below, kept here for Slate. */}
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
            bridgeToBlock(e.shiftKey);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.focus();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {chips.map((chip, chipIdx) => {
          // Single-select chips stay neutral — the multi-select colors are its visual signature.
          const color = colored
            ? getMultiSelectColor(chipIdx, isDark)
            : { bg: "bg-gray-100", text: "text-gray-900" };
          const isChipFocused = focusedChipIndex === chipIdx;
          return (
            <span
              key={`${chip.nodeIdx}-${chip.text}`}
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                color.bg,
                color.text,
                isChipFocused && "ring-2 ring-ring",
              )}
            >
              {chip.text}
              <button
                type="button"
                tabIndex={-1}
                className="ml-1 inline-flex size-3 items-center justify-center rounded-full hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(chipIdx);
                }}
                aria-label={`Remove ${chip.text}`}
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
          placeholder={chips.length === 0 ? "Type and press Enter to add options" : "Add option..."}
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
          {colored ? <TagIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
        </TooltipTrigger>
        <TooltipContent side="left">
          {colored ? "Multi-select dropdown" : "Dropdown"}
        </TooltipContent>
      </Tooltip>
      {/* Plate passes BelowRootNodes (which includes BlockSelection) as a sibling of `children`,
          so wrapping {children} in `display:none` above also hides the highlight. Render it
          explicitly instead. */}
      <BlockSelection {...props} />
      <RequiredBadgeButton required={Boolean(element.required)} path={props.path} />
    </PlateElement>
  );
};

export const FormOptionItemElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const variant = (element.variant as OptionVariant) || "checkbox";
  // Default preserves today's look: multiChoice → letter badges, all others → native control.
  const optionLabel =
    (element.optionLabel as OptionLabelStyle | undefined) ??
    (variant === "multiChoice" ? "letters" : "none");
  const editor = useEditorRef();

  // Subscribe to every editor change so optionIndex tracks reorders. props.path (useNodePath)
  // doesn't update on reorder (slate-react memoizes by identity); look up index by node identity.
  const version = useEditorVersion();
  // Reactive focus index: useEditorVersion bumps on CONTENT only, not selection — read the focus via
  // useEditorSelector so moving the caret into an option re-renders and shows the "Add option" ghost.
  const focusIndex = useEditorSelector((ed) => ed.selection?.focus.path[0], []);

  const { optionIndex, isLastInGroup, isGroupFocused, isStandalone, chipsMode } = useMemo(() => {
    const nodes = editor.children as TElement[];
    const pathIdx = nodes.indexOf(element);
    if (pathIdx < 0)
      return {
        optionIndex: 0,
        isLastInGroup: false,
        isGroupFocused: false,
        isStandalone: false,
        chipsMode: false,
      };

    let idx = 0;
    for (let i = pathIdx - 1; i >= 0; i--) {
      if (nodes[i]?.type === "formOptionItem") idx++;
      else break;
    }

    // Group shown as dropdown → the whole group collapses into the chips control
    // (flags live on the group's first node; ranking has no dropdown mode).
    const first = nodes[pathIdx - idx] as
      | (TElement & { variant?: string; showAsDropdown?: boolean })
      | undefined;
    const firstVariant = first?.variant || "checkbox";
    const chips =
      first?.type === "formOptionItem" &&
      (firstVariant === "checkbox" || firstVariant === "multiChoice") &&
      first.showAsDropdown === true;

    const nextNode = nodes[pathIdx + 1];
    const isLast = !nextNode || nextNode.type !== "formOptionItem";

    // Standalone = no formLabel above AND no sibling option — decides whether to anchor the
    // required badge inline (grouped options' badge floats over the formLabel instead).
    const prevNode = pathIdx > 0 ? nodes[pathIdx - 1] : null;
    const standalone = idx === 0 && isLast && prevNode?.type !== "formLabel";

    let groupFocused = false;
    if (focusIndex !== undefined) {
      const focusNode = nodes[focusIndex];
      if (focusNode?.type === "formOptionItem") {
        let groupStart = pathIdx;
        while (groupStart > 0 && nodes[groupStart - 1]?.type === "formOptionItem") groupStart--;
        let groupEnd = pathIdx;
        while (groupEnd < nodes.length - 1 && nodes[groupEnd + 1]?.type === "formOptionItem")
          groupEnd++;
        groupFocused = focusIndex >= groupStart && focusIndex <= groupEnd;
      }
    }

    return {
      optionIndex: idx,
      isLastInGroup: isLast,
      isGroupFocused: groupFocused,
      isStandalone: standalone,
      chipsMode: chips,
    };
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- version forces recompute on every editor change
  }, [editor, element, focusIndex, version]);

  // Suppress "Add option" ghost during any drag — Plate snapshots the option DOM for the
  // preview and would capture a visible ghost row alongside it.
  const draggingId = usePluginOption(DndPlugin, "draggingId") as string | string[] | undefined;
  const isAnyDragging = Array.isArray(draggingId) ? draggingId.length > 0 : Boolean(draggingId);
  const showGhost = isLastInGroup && isGroupFocused && !isAnyDragging && !chipsMode;

  // When ghost is visible, push the next block down so it doesn't overlap. Add margin-top to the
  // block-draggable wrapper's next sibling, not this element — expanding here displaces the gutter.
  useLayoutEffect(() => {
    let domNode: HTMLElement | null = null;
    try {
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      domNode = (editor.api as any).toDOMNode?.(element) ?? null;
    } catch {
      domNode = null;
    }
    if (!domNode) return;
    const blockWrapper = domNode.closest(".slate-blockWrapper");
    const draggableWrapper = blockWrapper?.parentElement;
    const nextSibling = draggableWrapper?.nextElementSibling as HTMLElement | null;
    if (!nextSibling) return;
    if (showGhost) {
      // Ghost is 30px tall, offset 4px below option (top-[calc(100%+4px)]),
      // plus another 4px gap after the ghost → total 38px margin.
      nextSibling.style.marginTop = "38px";
    } else {
      nextSibling.style.marginTop = "";
    }
    return () => {
      nextSibling.style.marginTop = "";
    };
  }, [editor, element, showGhost]);

  // Per-option image (group "Image" toggle sets showImage on every sibling). Upload via the shared
  // editor-media uploader, then store the URL on this option node.
  const showImage = element.showImage === true;
  const image = element.image as string | undefined;
  const { uploadFile, isUploading } = useUploadFile();
  const handleImagePick = useCallback(
    async (file: File) => {
      const uploaded = await uploadFile(file);
      if (!uploaded?.url) return;
      const idx = (editor.children as TElement[]).indexOf(element);
      if (idx >= 0) editor.tf.setNodes({ image: uploaded.url } as Partial<TElement>, { at: [idx] });
    },
    [uploadFile, editor, element],
  );
  const handleImageRemove = useCallback(() => {
    const idx = (editor.children as TElement[]).indexOf(element);
    if (idx >= 0) editor.tf.unsetNodes(["image"], { at: [idx] });
  }, [editor, element]);

  // Checkbox-as-dropdown group: first node renders the chips control, siblings collapse
  // (their text still mounts for Slate, just invisible).
  if (chipsMode) {
    if (optionIndex === 0) return <OptionChipsRow {...props}>{children}</OptionChipsRow>;
    return (
      <PlateElement
        attributes={{ ...attributes, "aria-hidden": "true" }}
        className="h-0 overflow-hidden"
        element={element}
        {...rest}
      >
        {children}
      </PlateElement>
    );
  }

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className="relative w-full max-w-116 cursor-text rounded-md caret-current before:top-3.5 before:left-7.5 before:-translate-y-1/2 before:text-sm"
      element={element}
      {...rest}
    >
      <div className="flex h-[30px] items-center gap-2 pr-6 pl-0.5">
        <span contentEditable={false} className="pointer-events-none shrink-0 select-none">
          <OptionIcon variant={variant} index={optionIndex} optionLabel={optionLabel} />
        </span>
        <span className="min-w-0 flex-1 text-sm outline-none">{children}</span>
      </div>

      {showImage && (
        <OptionImageSlot
          image={image}
          uploading={isUploading}
          onPick={handleImagePick}
          onRemove={handleImageRemove}
        />
      )}

      {showGhost && (
        <div
          contentEditable={false}
          data-bf-drag-ignore="true"
          className="pointer-events-none absolute top-[calc(100%+4px)] right-0 left-0 flex h-[30px] items-center gap-2 pl-0.5 opacity-40 select-none"
        >
          <OptionIcon variant={variant} index={optionIndex + 1} optionLabel={optionLabel} />
          <span className="text-sm text-muted-foreground">Add option</span>
        </div>
      )}
      <RequiredBadgeButton
        required={Boolean(element.required)}
        path={props.path}
        showWithoutLabel={isStandalone}
      />
    </PlateElement>
  );
};
