import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
import { expandListItemsWithChildren } from "@platejs/list";
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import { GripVertical, GripVerticalIcon, Plus, Settings, Trash2 } from "lucide-react";
import { getPluginByType, isType, KEYS, type TElement } from "platejs";
import {
  MemoizedChildren,
  type PlateEditor,
  type PlateElementProps,
  type RenderNodeWrapper,
  useEditorRef,
  useElement,
  usePluginOption,
  useSelected,
} from "platejs/react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const UNDRAGGABLE_KEYS = [KEYS.column, KEYS.tr, KEYS.td, "formHeader", "formButton", "pageBreak"];

export const BlockDraggable: RenderNodeWrapper = (props) => {
  const { editor, element, path } = props;

  const { isHidden, enabled } = React.useMemo(() => {
    if (editor.dom.readOnly) {
      return { isAfterButton: false, isHidden: false, enabled: false };
    }

    // Check if block is strictly after a form button in the same page section
    // Logic: Find nearest preceding button. If no PageBreak exists between that button and this block, it's invalid.
    let isAfterButton = false;
    let isHidden = false;

    const children = editor.children as TElement[];
    const currentIndex = path[0];

    // Find nearest preceding button (Strictly "Action" buttons: Next or Submit)
    // We ignore "Previous" buttons because they are allowed to be followed by a Next/Submit button.
    let nearestButtonIndex = -1;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const node = children[i];
      if (!node) continue;
      if (node.type === "formButton") {
        const role = (node as any).buttonRole;
        // If role is previous, we don't count it as a "terminator".
        // (We assume the structure [Previous] [Next] is valid, so [Next] is not "after" a terminator)
        if (role === "previous") continue;

        nearestButtonIndex = i;
        break;
      }
    }

    if (nearestButtonIndex !== -1) {
      // Found a preceding button. Check for intervening page breaks.
      const hasPageBreak = children
        .slice(nearestButtonIndex + 1, currentIndex)
        .some((n) => n?.type === "pageBreak");

      if (!hasPageBreak) {
        // No page break between button and this block.
        // This block is "orphaned" after the button.
        isAfterButton = true;
        const node = element;
        const isThankYou = node.type === "pageBreak" && node.isThankYouPage === true;

        // Special case: PageBreak itself is valid immediately after button
        if (node.type === "pageBreak") {
          isHidden = false;
          isAfterButton = false; // PageBreak allows starting new section
        } else if (!isThankYou) {
          isHidden = true;
        }
      }
    }

    if (isHidden) {
      return { isAfterButton: true, isHidden: true, enabled: false };
    }

    let enabled = false;
    if (path.length === 1 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      enabled = true;
    } else if (path.length === 3 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      const block = editor.api.some({
        at: path,
        match: {
          type: editor.getType(KEYS.column),
        },
      });
      if (block) enabled = true;
    } else if (path.length === 4 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      const block = editor.api.some({
        at: path,
        match: {
          type: editor.getType(KEYS.table),
        },
      });
      if (block) enabled = true;
    }

    // If strictly after button (even if thank you), we might want to disable dragging?
    // For now, allow regular logic for ThankYou page, but the earlier check handled the hidden ones.
    if (isAfterButton && !isHidden) {
      // It is a Thank You page. Allow dragging?
      // User: "no single way to do that [add after button]".
      // Moving Thank You page might be allowed.
      // Let's keep 'enabled' as calculated derived from structure.
    }

    return { isAfterButton, isHidden, enabled };
  }, [editor, element, path]);

  if (isHidden) {
    // Use height:0 to keep it in DOM for normalization but invisible to user
    // opacity:0 and pointer-events:none ensures no interaction
    // We avoid display:none to prevent potential selection issues if cursor is forced there
    return (props) => (
      <div className="opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
        {props.children}
      </div>
    );
  }

  if (!enabled) return;

  return (props) => <Draggable {...props} />;
};

function Draggable(props: PlateElementProps) {
  const { children, editor, element, path } = props;
  const blockSelectionApi = editor.getApi(BlockSelectionPlugin).blockSelection;

  const isFormButton = element.type === "formButton";

  const gutterPosition = React.useMemo(() => {
    if (element.gutterPosition) return element.gutterPosition as "center" | "top";

    const plugin = getPluginByType(editor, element.type);
    if (plugin?.options?.gutterPosition) return plugin.options.gutterPosition as "center" | "top";

    if (["formTextarea", KEYS.codeBlock, KEYS.blockquote, KEYS.table].includes(element.type)) {
      return "top";
    }

    return "center";
  }, [editor, element]);

  const buttonLayoutClass = React.useMemo(() => {
    if (isFormButton) {
      const role = (element as any).buttonRole;
      if (role === "previous") return "float-left clear-none";
      return "float-right clear-none"; // next/submit
    }
    return "clear-both";
  }, [isFormButton, element]);

  const { isAboutToDrag, isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    preview: { disable: true },
    onDropHandler: (_, { dragItem }) => {
      const id = (dragItem as { id: string[] | string }).id;

      if (blockSelectionApi) {
        blockSelectionApi.add(id);
      }
      resetPreview();
    },
  });

  const isInColumn = path.length === 3;
  const isInTable = path.length === 4;

  const [previewTop, setPreviewTop] = React.useState(0);
  // Track previous states to detect transitions
  const wasDraggingRef = React.useRef(isDragging);
  const wasAboutToDragRef = React.useRef(isAboutToDrag);

  const resetPreview = React.useCallback(() => {
    const previewEl = previewRef.current;
    if (previewEl) {
      previewEl.replaceChildren();
      previewEl.classList.add("hidden");
    }
  }, [previewRef]);

  // Reset preview only when transitioning from dragging to not dragging
  React.useEffect(() => {
    const justStoppedDragging = !isDragging && wasDraggingRef.current;
    wasDraggingRef.current = isDragging;

    if (justStoppedDragging) {
      resetPreview();
    }
  }, [isDragging, resetPreview]);

  // Show preview only when transitioning to about-to-drag state
  React.useEffect(() => {
    const justStartedAboutToDrag = isAboutToDrag && !wasAboutToDragRef.current;
    wasAboutToDragRef.current = isAboutToDrag;

    if (justStartedAboutToDrag) {
      previewRef.current?.classList.remove("opacity-0");
    }
  }, [isAboutToDrag]);

  React.useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const handleContextMenu = (event: MouseEvent) => {
      editor.getApi(BlockSelectionPlugin).blockSelection.addOnContextMenu({
        element,
        event: event as unknown as React.MouseEvent<HTMLDivElement>,
      });
    };

    node.addEventListener("contextmenu", handleContextMenu);
    return () => {
      node.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [editor, element, nodeRef]);

  return (
    <div
      className={cn(
        "relative",
        buttonLayoutClass,
        isDragging && "opacity-50",
        getPluginByType(editor, element.type)?.node.isContainer ? "group/container" : "group",
      )}
    >
      {!isInTable && !isFormButton && (
        <Gutter gutterPosition={gutterPosition}>
          <div
            className={cn(
              "slate-blockToolbarWrapper",
              "flex items-center gap-0 pointer-events-auto",
              isInColumn && "h-4",
            )}
          >
            {/* Plus Button - Add after (hidden for form buttons) */}
            {!isFormButton && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-auto w-auto rounded-lg has-[>svg]:px-1.5 has-[>svg]:py-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Insert a new paragraph block after the current block
                      const nextPath = [...path];
                      nextPath[nextPath.length - 1] += 1;
                      editor.tf.insertNodes(
                        {
                          type: KEYS.p,
                          children: [{ text: "" }],
                        },
                        { at: nextPath, select: true },
                      );
                    }}
                    data-plate-prevent-deselect
                  >
                    <Plus className="size-4 text-[#52525B] dark:text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Add block below</TooltipContent>
              </Tooltip>
            )}

            {/* Drag Handle or Settings Gear - div to avoid nested button (Tooltip+Button inside) */}
            <div
              ref={isFormButton ? null : handleRef}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-auto w-auto  rounded-lg hover:bg-transparent")}
              data-plate-prevent-deselect
            >
              <DragHandle
                isDragging={isDragging}
                previewRef={previewRef}
                resetPreview={resetPreview}
                setPreviewTop={setPreviewTop}
                isFormButton={isFormButton}
              />
            </div>
          </div>
        </Gutter>
      )}
      <div
        ref={previewRef}
        className={cn("left-0 absolute hidden w-full")}
        style={{ top: `${-previewTop}px` }}
        contentEditable={false}
      />
      <div ref={nodeRef} className="slate-blockWrapper flow-root">
        <MemoizedChildren>{children}</MemoizedChildren>
        <DropLine />
      </div>
    </div>
  );
}

function Gutter({
  children,
  className,
  gutterPosition = "center",
  ...props
}: React.ComponentProps<"div"> & { gutterPosition?: "center" | "top" }) {
  const editor = useEditorRef();
  const element = useElement();
  const isSelectionAreaVisible = usePluginOption(BlockSelectionPlugin, "isSelectionAreaVisible");
  const selected = useSelected();

  return (
    <div
      {...props}
      className={cn(
        "slate-gutterLeft",
        "-translate-x-full absolute h-full z-50 flex cursor-text hover:opacity-100",
        gutterPosition === "top" ? "top-0 items-start pt-1.5" : "top-0 items-center",
        !selected && "sm:opacity-0",
        getPluginByType(editor, element.type)?.node.isContainer
          ? "group-hover/container:opacity-100"
          : "group-hover:opacity-100",
        isSelectionAreaVisible && "hidden",
        selected && "opacity-100",
        className,
      )}
      contentEditable={false}
    >
      {children}
    </div>
  );
}

const DragHandle = React.memo(function DragHandle({
  isDragging,
  previewRef,
  resetPreview,
  setPreviewTop,
  isFormButton,
}: {
  isDragging: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
  resetPreview: () => void;
  setPreviewTop: (top: number) => void;
  isFormButton?: boolean;
}) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <Tooltip>
      <TooltipTrigger asChild className="px-0">
        <button
          className="flex size-full items-center justify-center h-auto hover:bg-transparent has-[>svg]:px-1.5 has-[>svg]:py-1"
          onClick={(e) => {
            // e.preventDefault();
            // e.stopPropagation();

            const api = editor.getApi(BlockMenuPlugin);

            api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
              x: e.clientX,
              y: e.clientY,
            });
          }}
          onMouseDown={(e) => {
            if (isFormButton) return;
            resetPreview();

            if ((e.button !== 0 && e.button !== 2) || e.shiftKey) return;

            const blockSelection = editor
              .getApi(BlockSelectionPlugin)
              .blockSelection.getNodes({ sort: true });

            let selectionNodes =
              blockSelection.length > 0 ? blockSelection : editor.api.blocks({ mode: "highest" });

            // If current block is not in selection, use it as the starting point
            if (!selectionNodes.some(([node]) => node.id === element.id)) {
              selectionNodes = [[element, editor.api.findPath(element)!]];
            }

            // Process selection nodes to include list children
            const blocks = expandListItemsWithChildren(editor, selectionNodes).map(
              ([node]) => node,
            );

            if (blockSelection.length === 0) {
              editor.tf.blur();
              editor.tf.collapse();
            }

            const elements = createDragPreviewElements(editor, blocks);
            previewRef.current?.append(...elements);
            previewRef.current?.classList.remove("hidden");
            previewRef.current?.classList.add("opacity-0");
            editor.setOption(DndPlugin, "multiplePreviewRef", previewRef);

            editor
              .getApi(BlockSelectionPlugin)
              .blockSelection.set(blocks.map((block) => block.id as string));
          }}
          onMouseEnter={() => {
            if (isDragging) return;

            const blockSelection = editor
              .getApi(BlockSelectionPlugin)
              .blockSelection.getNodes({ sort: true });

            let selectedBlocks =
              blockSelection.length > 0 ? blockSelection : editor.api.blocks({ mode: "highest" });

            // If current block is not in selection, use it as the starting point
            if (!selectedBlocks.some(([node]) => node.id === element.id)) {
              selectedBlocks = [[element, editor.api.findPath(element)!]];
            }

            // Process selection to include list children
            const processedBlocks = expandListItemsWithChildren(editor, selectedBlocks);

            const ids = processedBlocks.map((block) => block[0].id as string);

            if (ids.length > 1 && ids.includes(element.id as string)) {
              const previewTop = calculatePreviewTop(editor, {
                blocks: processedBlocks.map((block) => block[0]),
                element,
              });
              setPreviewTop(previewTop);
            } else {
              setPreviewTop(0);
            }
          }}
          onMouseUp={() => {
            resetPreview();
          }}
          data-plate-prevent-deselect
        >
          {isFormButton ? (
            <Settings className="text-muted-foreground" />
          ) : (
            <GripVerticalIcon className="text-[#52525B] dark:text-muted-foreground" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isFormButton ? "Click for settings" : "Drag to move, Click to open menu"}
      </TooltipContent>
    </Tooltip>
  );
});

const DropLine = React.memo(function DropLine({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      {...props}
      className={cn(
        "slate-dropLine",
        "absolute inset-x-0 h-1 opacity-100",
        "bg-brand rounded-full",
        "animate-[drop-line-pulse_1s_ease-in-out_infinite]",
        dropLine === "top" && "-top-0.5",
        dropLine === "bottom" && "-bottom-0.5",
        className,
      )}
    />
  );
});

const createDragPreviewElements = (editor: PlateEditor, blocks: TElement[]): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  const ids: string[] = [];

  /**
   * Remove data attributes from the element to avoid recognized as slate
   * elements incorrectly.
   */
  const removeDataAttributes = (element: HTMLElement) => {
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.startsWith("data-slate") || attr.name.startsWith("data-block-id")) {
        element.removeAttribute(attr.name);
      }
    });

    Array.from(element.children).forEach((child) => {
      removeDataAttributes(child as HTMLElement);
    });
  };

  const resolveElement = (node: TElement, index: number) => {
    const domNode = editor.api.toDOMNode(node)!;
    const newDomNode = domNode.cloneNode(true) as HTMLElement;

    // Apply visual compensation for horizontal scroll
    const applyScrollCompensation = (original: Element, cloned: HTMLElement) => {
      const scrollLeft = original.scrollLeft;

      if (scrollLeft > 0) {
        // Create a wrapper to handle the scroll offset
        const scrollWrapper = document.createElement("div");
        scrollWrapper.style.overflow = "hidden";
        scrollWrapper.style.width = `${original.clientWidth}px`;

        // Create inner container with the full content
        const innerContainer = document.createElement("div");
        innerContainer.style.transform = `translateX(-${scrollLeft}px)`;
        innerContainer.style.width = `${original.scrollWidth}px`;

        // Move all children to the inner container
        while (cloned.firstChild) {
          innerContainer.append(cloned.firstChild);
        }

        // Apply the original element's styles to maintain appearance
        const originalStyles = window.getComputedStyle(original);
        cloned.style.padding = "0";
        innerContainer.style.padding = originalStyles.padding;

        scrollWrapper.append(innerContainer);
        cloned.append(scrollWrapper);
      }
    };

    applyScrollCompensation(domNode, newDomNode);

    ids.push(node.id as string);
    const wrapper = document.createElement("div");
    wrapper.append(newDomNode);
    wrapper.style.display = "flow-root";

    const lastDomNode = blocks[index - 1];

    if (lastDomNode) {
      const lastDomNodeRect = editor.api
        .toDOMNode(lastDomNode)
        ?.parentElement?.getBoundingClientRect();

      const domNodeRect = domNode.parentElement?.getBoundingClientRect();

      if (domNodeRect && lastDomNodeRect) {
        const distance = domNodeRect.top - lastDomNodeRect.bottom;

        // Check if the two elements are adjacent (touching each other)
        if (distance > 15) {
          wrapper.style.marginTop = `${distance}px`;
        }
      }
    }

    removeDataAttributes(newDomNode);
    elements.push(wrapper);
  };

  blocks.forEach((node, index) => {
    resolveElement(node, index);
  });

  editor.setOption(DndPlugin, "draggingId", ids);

  return elements;
};

const calculatePreviewTop = (
  editor: PlateEditor,
  {
    blocks,
    element,
  }: {
    blocks: TElement[];
    element: TElement;
  },
): number => {
  const child = editor.api.toDOMNode(element)!;
  const editable = editor.api.toDOMNode(editor)!;
  const firstSelectedChild = blocks[0];

  const firstDomNode = editor.api.toDOMNode(firstSelectedChild)!;
  // Get editor's top padding
  const editorPaddingTop = Number(window.getComputedStyle(editable).paddingTop.replace("px", ""));

  // Calculate distance from first selected node to editor top
  const firstNodeToEditorDistance =
    firstDomNode.getBoundingClientRect().top -
    editable.getBoundingClientRect().top -
    editorPaddingTop;

  // Get margin top of first selected node
  const firstMarginTopString = window.getComputedStyle(firstDomNode).marginTop;
  const marginTop = Number(firstMarginTopString.replace("px", ""));

  // Calculate distance from current node to editor top
  const currentToEditorDistance =
    child.getBoundingClientRect().top - editable.getBoundingClientRect().top - editorPaddingTop;

  const currentMarginTopString = window.getComputedStyle(child).marginTop;
  const currentMarginTop = Number(currentMarginTopString.replace("px", ""));

  const previewElementsTopDistance =
    currentToEditorDistance - firstNodeToEditorDistance + marginTop - currentMarginTop;

  return previewElementsTopDistance;
};
