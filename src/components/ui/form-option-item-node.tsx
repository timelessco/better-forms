import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { DndPlugin } from "@platejs/dnd";
import { PlateElement, useEditorRef, useEditorSelector, usePluginOption } from "platejs/react";
import { useLayoutEffect } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { RequiredBadgeButton } from "@/components/ui/required-badge-button";
import { cn } from "@/lib/utils";

type OptionVariant = "checkbox" | "multiChoice" | "multiSelect" | "dropdown";

import { getMultiSelectColor, getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { useFormIsDark } from "@/hooks/use-form-theme";

// Letters/Numbers labels: an ordinal badge in a gray box (Figma nodes 25578:9710 / 25578:9688).
const OptionLabelBadge = ({ text }: { text: string }) => (
  <span className="flex size-4 min-w-4 shrink-0 items-center justify-center rounded-[4px] bg-(--form-input-bg,var(--color-gray-50)) px-0.5 text-[9px] font-semibold text-muted-foreground elevation-sm">
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
  const isDark = useFormIsDark();

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
    case "dropdown":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronDownIcon className="size-3" />
        </span>
      );
    case "multiChoice":
      // Labels "None" → the radio control (Figma node 25458:16773).
      return (
        <span className="flex size-4 shrink-0 rounded-full border border-input bg-card elevation-sm" />
      );
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
  // Default preserves today's look: multiChoice → letter badges, all others → native control.
  const optionLabel =
    (element.optionLabel as OptionLabelStyle | undefined) ??
    (variant === "multiChoice" ? "letters" : "none");
  const editor = useEditorRef();
  const isDark = useFormIsDark();

  // Narrow subscription: re-render only when this option's derived state changes, not on every
  // keystroke. Index by node identity since props.path (useNodePath) doesn't update on reorder
  // (slate-react memoizes by identity). Shallow equality skips re-renders when all 4 are unchanged.
  const { optionIndex, isLastInGroup, isGroupFocused, isStandalone } = useEditorSelector(
    (ed) => {
      const nodes = ed.children as TElement[];
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
      const focusIndex = ed.selection?.focus.path[0];
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
    },
    [element],
    {
      equalityFn: (a, b) =>
        a.optionIndex === b.optionIndex &&
        a.isLastInGroup === b.isLastInGroup &&
        a.isGroupFocused === b.isGroupFocused &&
        a.isStandalone === b.isStandalone,
    },
  );

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
      <div className="flex h-[30px] items-center gap-2 pr-6 pl-0.5">
        <span contentEditable={false} className="pointer-events-none shrink-0 select-none">
          <OptionIcon variant={variant} index={optionIndex} optionLabel={optionLabel} />
        </span>
        <span className="min-w-0 flex-1 text-sm outline-none">{children}</span>
      </div>

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
