import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { DndPlugin } from "@platejs/dnd";
import { PlateElement, useEditorRef, useEditorVersion, usePluginOption } from "platejs/react";
import { useLayoutEffect, useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheckIcon, ChevronsUpDownIcon } from "@/components/ui/icons";
import { RequiredBadgeButton } from "@/components/ui/required-badge-button";
import { cn } from "@/lib/utils";

type OptionVariant = "checkbox" | "multiChoice" | "multiSelect" | "ranking";

import { LETTER_LABELS, MULTI_SELECT_COLORS } from "@/components/ui/form-option-item-constants";

const OptionIcon = ({ variant, index }: { variant: OptionVariant; index: number }) => {
  switch (variant) {
    case "checkbox":
      return (
        <span className="flex size-5 shrink-0 items-center justify-center">
          <Checkbox disabled className="pointer-events-none after:hidden" />
        </span>
      );
    case "multiChoice": {
      const letter = LETTER_LABELS[index % LETTER_LABELS.length];
      return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[var(--color-gray-50)] text-[11px] font-semibold text-muted-foreground shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)]">
          {letter}
        </span>
      );
    }
    case "multiSelect": {
      const color = MULTI_SELECT_COLORS[index % MULTI_SELECT_COLORS.length];
      return (
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded",
            color.bg,
            color.text,
          )}
        >
          <CheckCheckIcon className="size-3.5" />
        </span>
      );
    }
    case "ranking":
      return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded border border-border/50 text-muted-foreground">
          <ChevronsUpDownIcon className="size-3.5" />
        </span>
      );
    default:
      return null;
  }
};

export const FormOptionItemElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const variant = (element.variant as OptionVariant) || "checkbox";
  const editor = useEditorRef();

  // Subscribe to every editor change so optionIndex follows position after reorder.
  // props.path is computed by useNodePath which does NOT update on sibling reorder
  // (slate-react memoizes elements by identity), so we look up the current index
  // by node identity in editor.children each render.
  const version = useEditorVersion();
  const focusIndex = editor.selection?.focus.path[0];

  const { optionIndex, isLastInGroup, isGroupFocused, isStandalone } = useMemo(() => {
    const nodes = editor.children as TElement[];
    const pathIdx = nodes.indexOf(element);
    if (pathIdx < 0)
      return {
        optionIndex: 0,
        isLastInGroup: false,
        isGroupFocused: false,
        isStandalone: false,
      };

    let idx = 0;
    for (let i = pathIdx - 1; i >= 0; i--) {
      if (nodes[i]?.type === "formOptionItem") idx++;
      else break;
    }

    const nextNode = nodes[pathIdx + 1];
    const isLast = !nextNode || nextNode.type !== "formOptionItem";

    // Standalone = no formLabel above AND no sibling option (above or below).
    // Used to decide whether to anchor the required badge inline on this row,
    // since a grouped option's badge already floats over the formLabel.
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
    };
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- version forces recompute on every editor change
  }, [editor, element, focusIndex, version]);

  // Suppress the "Add option" ghost while any drag is in progress — Plate
  // snapshots the option's DOM for the drag preview, and a visible ghost
  // row would be captured alongside it.
  const draggingId = usePluginOption(DndPlugin, "draggingId") as string | string[] | undefined;
  const isAnyDragging = Array.isArray(draggingId) ? draggingId.length > 0 : Boolean(draggingId);
  const showGhost = isLastInGroup && isGroupFocused && !isAnyDragging;

  // When the ghost is visible, push the NEXT block (pageBreak / formButton / etc.)
  // down so the ghost doesn't overlap it. We walk up to the block-draggable
  // wrapper and add margin-top to its next sibling instead of expanding this
  // element, which would displace the drag-handle gutter (h-full of the block
  // wrapper).
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
      // Ghost is 28px tall, offset 4px below option (top-[calc(100%+4px)]),
      // plus another 4px gap after the ghost → total 36px margin.
      nextSibling.style.marginTop = "36px";
    } else {
      nextSibling.style.marginTop = "";
    }
    return () => {
      nextSibling.style.marginTop = "";
    };
  }, [editor, element, showGhost]);

  const colorStyle =
    variant === "multiSelect"
      ? MULTI_SELECT_COLORS[optionIndex % MULTI_SELECT_COLORS.length]
      : null;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative w-full max-w-[464px] cursor-text rounded-md caret-current before:top-[14px] before:left-[30px] before:-translate-y-1/2 before:text-sm",
        colorStyle && cn(colorStyle.bg, colorStyle.text),
      )}
      element={element}
      {...rest}
    >
      <div className="flex h-7 items-center gap-2 pr-6 pl-[2px]">
        <span contentEditable={false} className="pointer-events-none shrink-0 select-none">
          <OptionIcon variant={variant} index={optionIndex} />
        </span>
        <span className="min-w-0 flex-1 text-sm outline-none">{children}</span>
      </div>

      {showGhost && (
        <div
          contentEditable={false}
          data-bf-drag-ignore="true"
          className="pointer-events-none absolute top-[calc(100%+4px)] right-0 left-0 flex h-7 items-center gap-2 pl-[2px] opacity-40 select-none"
        >
          <OptionIcon variant={variant} index={optionIndex + 1} />
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
