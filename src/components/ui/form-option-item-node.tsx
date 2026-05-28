import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { DndPlugin } from "@platejs/dnd";
import { PlateElement, useEditorRef, useEditorVersion, usePluginOption } from "platejs/react";
import { useLayoutEffect, useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheckIcon } from "@/components/ui/icons";
import { RequiredBadgeButton } from "@/components/ui/required-badge-button";
import { cn } from "@/lib/utils";

type OptionVariant = "checkbox" | "multiChoice" | "multiSelect";

import { getMultiSelectColor, LETTER_LABELS } from "@/components/ui/form-option-item-constants";
import { useFormIsDark } from "@/hooks/use-form-theme";

const OptionIcon = ({ variant, index }: { variant: OptionVariant; index: number }) => {
  const isDark = useFormIsDark();
  switch (variant) {
    case "checkbox":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <Checkbox disabled className="pointer-events-none after:hidden" />
        </span>
      );
    case "multiChoice": {
      const letter = LETTER_LABELS[index % LETTER_LABELS.length];
      return (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-(--form-input-bg,var(--color-gray-50)) text-[9px] font-semibold text-muted-foreground elevation-sm">
          {letter}
        </span>
      );
    }
    case "multiSelect": {
      const color = getMultiSelectColor(index, isDark);
      return (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px]",
            color.bg,
            color.text,
          )}
        >
          <CheckCheckIcon className="size-3" />
        </span>
      );
    }
    default:
      return null;
  }
};

export const FormOptionItemElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const variant = (element.variant as OptionVariant) || "checkbox";
  const editor = useEditorRef();
  const isDark = useFormIsDark();

  // Subscribe to every editor change so optionIndex tracks reorders. props.path (useNodePath)
  // doesn't update on reorder (slate-react memoizes by identity); look up index by node identity.
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
    };
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- version forces recompute on every editor change
  }, [editor, element, focusIndex, version]);

  // Suppress "Add option" ghost during any drag — Plate snapshots the option DOM for the
  // preview and would capture a visible ghost row alongside it.
  const draggingId = usePluginOption(DndPlugin, "draggingId") as string | string[] | undefined;
  const isAnyDragging = Array.isArray(draggingId) ? draggingId.length > 0 : Boolean(draggingId);
  const showGhost = isLastInGroup && isGroupFocused && !isAnyDragging;

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

  const colorStyle = variant === "multiSelect" ? getMultiSelectColor(optionIndex, isDark) : null;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative w-full max-w-116 cursor-text rounded-md caret-current before:top-3.5 before:left-7.5 before:-translate-y-1/2 before:text-sm",
        colorStyle && cn(colorStyle.bg, colorStyle.text),
      )}
      element={element}
      {...rest}
    >
      <div className="flex h-7 items-center gap-2 pr-6 pl-0.5">
        <span contentEditable={false} className="pointer-events-none shrink-0 select-none">
          <OptionIcon variant={variant} index={optionIndex} />
        </span>
        <span className="min-w-0 flex-1 text-sm outline-none">{children}</span>
      </div>

      {showGhost && (
        <div
          contentEditable={false}
          data-bf-drag-ignore="true"
          className="pointer-events-none absolute top-[calc(100%+4px)] right-0 left-0 flex h-7 items-center gap-2 pl-0.5 opacity-40 select-none"
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
