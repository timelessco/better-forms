import { DndPlugin, useDraggable, useDropLine } from "@platejs/dnd";
import { expandListItemsWithChildren } from "@platejs/list";
import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import { BlockAddIcon, BlockDeleteIcon, BlockDragIcon, SettingsIcon } from "@/components/ui/icons";
import { getPluginByType, isType, KEYS } from "platejs";
import type { TElement, TIdElement } from "platejs";
import {
  MemoizedChildren,
  useEditorRef,
  useElement,
  usePluginOption,
  useSelected,
} from "platejs/react";
import type { PlateEditor, PlateElementProps, RenderNodeWrapper } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  moveToPath,
} from "@/components/editor/plugins/form-blocks-utils";
import { FORM_INPUT_NODE_TYPES } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

const UNDRAGGABLE_KEYS = [KEYS.column, KEYS.tr, KEYS.td, "formButton"];

// Single-line text blocks whose gutter should center on their line (vs top-align).
// Excludes box inputs and tall blocks (textarea, file upload, options) which keep the
// controls on their first row.
const GUTTER_CENTER_TYPES = new Set<string>([
  "formLabel",
  KEYS.p,
  KEYS.h1,
  KEYS.h2,
  KEYS.h3,
  KEYS.blockquote,
]);

// In readOnly (version view / in-editor preview) the DnD plugin is editOnly, so BlockDraggable
// never runs and `.slate-blockWrapper` is never emitted — block spacing (driven entirely by the
// .slate-blockWrapper CSS rules in styles.css) collapses to 0. This non-DnD wrapper re-emits the
// SAME two-level structure (outer attr div + inner .slate-blockWrapper) for top-level blocks so
// spacing matches the editable editor exactly, minus drag affordances. The two levels matter: the
// heading/paragraph CSS rules are parent-scoped (`parent:has(> .slate-blockWrapper > .slate-h1)
// > .slate-blockWrapper`), so each wrapper needs its OWN parent div — a flat single div makes the
// editor the shared parent and leaks the heading margins onto every sibling. The data-bf-input /
// data-bf-chrome / data-bf-standalone attrs mirror Draggable's outer div (option-collapse + chrome
// exclusion rules read them). Keep this in sync with Draggable's wrapper attrs below.
const ReadOnlyBlock = ({
  editor,
  element,
  path,
  children,
}: {
  editor: PlateEditor;
  element: TElement;
  path: number[];
  children: React.ReactNode;
}) => {
  const isFormInput = FORM_INPUT_NODE_TYPES.has(element.type);
  const chromeAttrs = element.type === "formHeader" ? { "data-bf-chrome": "" } : {};

  const isStandaloneInput = (() => {
    if (!isFormInput) return false;
    if (element.type === "formTextarea" || element.type === "formFileUpload") return false;
    const idx = path[0];
    if (typeof idx !== "number") return false;
    const prev = (editor.children as TElement[])[idx - 1];
    if (!prev) return true;
    if (prev.type === "formLabel") return false;
    if (element.type === "formOptionItem" && prev.type === "formOptionItem") return false;
    return true;
  })();

  const inputAttrs = isFormInput
    ? isStandaloneInput
      ? { "data-bf-input": "true", "data-bf-standalone": "true" }
      : { "data-bf-input": "true" }
    : {};

  return (
    <div className="relative" {...chromeAttrs} {...inputAttrs}>
      <div className="slate-blockWrapper flow-root">{children}</div>
    </div>
  );
};

export const ReadOnlyBlockWrapper: RenderNodeWrapper = ({ editor, element, path }) => {
  if (!editor.dom.readOnly) return; // edit mode: BlockDraggable owns the wrapper
  if (path.length !== 1 || isType(editor, element, UNDRAGGABLE_KEYS)) return;
  return ({ children }) => (
    <ReadOnlyBlock editor={editor} element={element} path={path}>
      {children}
    </ReadOnlyBlock>
  );
};

export const BlockDraggable: RenderNodeWrapper = (props) => {
  const { editor, element, path } = props;

  const { isHidden, enabled } = React.useMemo(() => {
    if (editor.dom.readOnly) {
      return { isAfterButton: false, isHidden: false, enabled: false };
    }

    // Invalid if block sits after nearest preceding button with no PageBreak between them.
    let isAfterButton = false;
    let blockIsHidden = false;

    const children = editor.children as TElement[];
    const currentIndex = path[0];

    // Nearest preceding action button (Next/Submit). Skip Previous — [Previous][Next] is valid.
    let nearestButtonIndex = -1;
    for (let i = currentIndex - 1; i >= 0; i--) {
      const node = children[i];
      if (!node) continue;
      if (node.type === "formButton") {
        const role = (node as TElement & { buttonRole?: string }).buttonRole;
        // Previous isn't a terminator.
        if (role === "previous") continue;

        nearestButtonIndex = i;
        break;
      }
    }

    if (nearestButtonIndex !== -1) {
      // Preceding button found — check for intervening page breaks.
      const hasPageBreak = children
        .slice(nearestButtonIndex + 1, currentIndex)
        .some((n) => n?.type === "pageBreak");

      if (!hasPageBreak) {
        // No page break — block orphaned after button.
        isAfterButton = true;
        const node = element;
        const isThankYou = node.type === "pageBreak" && node.isThankYouPage === true;

        // PageBreak is valid immediately after button.
        if (node.type === "pageBreak") {
          blockIsHidden = false;
          isAfterButton = false; // PageBreak allows starting new section
        } else if (!isThankYou) {
          blockIsHidden = true;
        }
      }
    }

    if (blockIsHidden) {
      return { isAfterButton: true, isHidden: true, enabled: false };
    }

    let isEnabled = false;
    if (path.length === 1 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      isEnabled = true;
    } else if (path.length === 3 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      const block = editor.api.some({
        at: path,
        match: {
          type: editor.getType(KEYS.column),
        },
      });
      if (block) isEnabled = true;
    }

    if (isAfterButton && !blockIsHidden) {
    }

    return { isAfterButton, isHidden: blockIsHidden, enabled: isEnabled };
  }, [editor, element, path]);

  if (isHidden) {
    // height:0 + opacity:0 + pointer-events:none keeps it in DOM for normalization but inert.
    // Avoid display:none — selection issues if cursor forced there.
    return (innerProps) => (
      <div className="pointer-events-none h-0 overflow-hidden opacity-0" aria-hidden="true">
        {innerProps.children}
      </div>
    );
  }

  if (!enabled) {
    return;
  }

  return (innerProps) => <Draggable {...innerProps} />;
};

const Draggable = (props: PlateElementProps) => {
  const { children, editor, element, path } = props;
  const blockSelectionApi = editor.getApi(BlockSelectionPlugin).blockSelection;

  const isFormButton = element.type === "formButton";
  const isFormHeader = element.type === "formHeader";
  const isPageBreak = element.type === "pageBreak";
  // Single-line text blocks are shorter than the 28px control group, so a top-aligned
  // gutter lands the icons below the text. Centering puts the controls on the (single)
  // line. Box inputs and tall blocks (textarea, file upload, options) stay top-aligned
  // so the controls sit on their first row, not floating in the middle.
  const centerGutter = GUTTER_CENTER_TYPES.has(element.type);

  const buttonLayoutClass = React.useMemo(() => {
    if (isFormButton) {
      const role = (element as TElement & { buttonRole?: string }).buttonRole;
      if (role === "previous") return "float-left clear-none";
      return "float-right clear-none"; // next/submit
    }
    return "clear-both";
  }, [isFormButton, element]);

  // Confine non-checkbox option items (multiChoice/multiSelect/ranking) to their
  // run of consecutive formOptionItem siblings — dragging out orphans them.
  // Checkbox variant unrestricted: works standalone as agreement input.
  const canDropNode = React.useCallback(
    ({
      dragEntry,
      dropEntry,
    }: {
      dragEntry: [TElement, number[]];
      dropEntry: [TElement, number[]];
    }) => {
      const [dragNode, dragPath] = dragEntry;
      if (dragNode.type !== "formOptionItem") return true;

      const dragVariant = (dragNode as TElement & { variant?: string }).variant ?? "checkbox";
      if (dragVariant === "checkbox") return true;

      // Group lookup is top-level only; nested (column/table) constrained upstream.
      if (dragPath.length !== 1) return true;
      const [, dropPath] = dropEntry;
      if (dropPath.length !== 1) return true;

      const dragIdx = dragPath[0];
      const dropIdx = dropPath[0];
      if (typeof dragIdx !== "number" || typeof dropIdx !== "number") return true;

      const children = editor.children as TElement[];
      let start = dragIdx;
      while (start > 0 && children[start - 1]?.type === "formOptionItem") start--;
      let end = dragIdx;
      while (end < children.length - 1 && children[end + 1]?.type === "formOptionItem") end++;

      return dropIdx >= start && dropIdx <= end;
    },
    [editor],
  );

  const { isAboutToDrag, isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    canDropNode,
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

  const resetPreview = React.useCallback(() => {
    const el = previewRef.current;
    if (el) {
      el.replaceChildren();
      el.classList.add("hidden");
    }
  }, [previewRef]);

  React.useEffect(() => {
    if (!isDragging) {
      resetPreview();
    }
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- only on isDragging change
  }, [isDragging]);

  // Make preview visible just before drag starts so HTML5 backend can capture it
  // eslint-disable-next-line react-doctor/no-effect-event-handler -- reacts to react-dnd async state transitions; not a discrete user event
  React.useEffect(() => {
    if (isAboutToDrag) {
      previewRef.current?.classList.remove("opacity-0");
    }
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- only on isAboutToDrag change
  }, [isAboutToDrag]);

  // Drag in flight: hide live preview so it doesn't double the HTML5 drag image.
  // Backend publishes isDragging via setTimeout(0) AFTER screenshot, so this can't blank it.
  // eslint-disable-next-line react-doctor/no-effect-event-handler -- reacts to react-dnd async state transitions; not a discrete user event
  React.useEffect(() => {
    if (isDragging) {
      previewRef.current?.classList.add("opacity-0");
    }
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- only on isDragging change
  }, [isDragging]);

  const handleAddBlock = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const nextPath = [...path];
      nextPath[nextPath.length - 1] += 1;
      editor.tf.insertNodes(
        {
          type: KEYS.p,
          children: [{ text: "" }],
        },
        { at: nextPath, select: true },
      );
    },
    [editor.tf, path],
  );

  // Delete this block. Mirrors the block menu's Delete action: select the block, then
  // removeNodes via BlockSelectionPlugin so list/column children are handled consistently.
  const handleDeleteBlock = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor.getApi(BlockSelectionPlugin).blockSelection.set([element.id as string]);
      editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
    },
    [editor, element.id],
  );

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

  const isFormInput = FORM_INPUT_NODE_TYPES.has(element.type);
  const wrapperChromeAttrs = isFormButton || isFormHeader ? { "data-bf-chrome": "" } : {};

  // Standalone = no preceding formLabel; drives padding so stacked label-less inputs don't collide.
  // Inline (O(1)) — memoizing needs editor.children dep, which changes every edit and defeats it.
  const isStandaloneInput = (() => {
    if (!isFormInput) return false;
    if (element.type === "formTextarea" || element.type === "formFileUpload") return false;
    const idx = path[0];
    if (typeof idx !== "number") return false;
    const prev = (editor.children as TElement[])[idx - 1];
    if (!prev) return true;
    if (prev.type === "formLabel") return false;
    // Option items cluster under one label — inherit standalone from first.
    if (element.type === "formOptionItem" && prev.type === "formOptionItem") return false;
    return true;
  })();

  const wrapperInputAttrs = isFormInput
    ? isStandaloneInput
      ? { "data-bf-input": "true", "data-bf-standalone": "true" }
      : { "data-bf-input": "true" }
    : {};

  return (
    <div
      className={cn(
        "relative",
        buttonLayoutClass,
        isDragging && "opacity-50",
        getPluginByType(editor, element.type)?.node.isContainer ? "group/container" : "group",
      )}
      {...wrapperChromeAttrs}
      {...wrapperInputAttrs}
    >
      {!isInTable && !isFormButton && !isFormHeader && !isPageBreak && (
        <Gutter gutterPosition={centerGutter ? "center" : "top"} className="mr-1">
          <div
            className={cn(
              "slate-blockToolbarWrapper",
              "pointer-events-auto mr-1 flex items-center gap-0",
              isInColumn && "h-4",
            )}
            onKeyDownCapture={(e) => {
              // Gutter controls (+, drag) aren't real tab stops — navigate directly
              if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                const target = e.shiftKey
                  ? findPrevNonButtonPath(editor, path)
                  : findNextNonButtonPath(editor, path);
                if (target) {
                  moveToPath(editor, target);
                  editor.tf.focus();
                }
              }
            }}
          >
            {!isFormButton && (
              <Button
                variant="ghost-flat"
                size="icon"
                tabIndex={-1}
                className="flex h-7 w-6 items-center justify-center rounded-lg p-0 hover:bg-secondary"
                onClick={handleDeleteBlock}
                data-plate-prevent-deselect
                aria-label="Delete block"
              >
                <BlockDeleteIcon className="size-4 text-muted-foreground" />
              </Button>
            )}

            {!isFormButton && (
              <Button
                variant="ghost-flat"
                size="icon"
                tabIndex={-1}
                className="flex h-7 w-6 items-center justify-center rounded-lg p-0 hover:bg-secondary"
                onClick={handleAddBlock}
                data-plate-prevent-deselect
                aria-label="Add block below"
              >
                <BlockAddIcon className="size-4 text-muted-foreground" />
              </Button>
            )}

            {/* Drag Handle or Settings Gear — wrapper div carries the drag handleRef; DragHandle is its own button */}
            <div
              ref={isFormButton ? undefined : handleRef}
              className="size-auto cursor-grab"
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
        className={cn("absolute left-0 hidden w-full")}
        style={{ top: `${-previewTop}px` }}
        contentEditable={false}
      />
      <div ref={nodeRef} className="slate-blockWrapper flow-root">
        <MemoizedChildren>{children}</MemoizedChildren>
        <DropLine />
      </div>
    </div>
  );
};

const Gutter = ({
  children,
  className,
  gutterPosition = "center",
  ...props
}: React.ComponentProps<"div"> & { gutterPosition?: "center" | "top" }) => {
  const editor = useEditorRef();
  const element = useElement();
  const isSelectionAreaVisible = usePluginOption(BlockSelectionPlugin, "isSelectionAreaVisible");
  const selected = useSelected();

  // Center the controls on the block's FIRST line, not its full height. A single-line label is
  // shorter than the 28px control group, so centering in h-full lands the controls on the line —
  // but a label/heading that WRAPS to multiple lines would float the controls at the block's
  // vertical middle (between lines). Measure the first line-box so items-center stays on line 1.
  // (Single-line: first-line height == full height, so this is a no-op.) "top" gutters keep h-full.
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const [firstLineH, setFirstLineH] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    if (gutterPosition !== "center") {
      setFirstLineH(null);
      return;
    }
    const content = gutterRef.current?.parentElement?.querySelector(
      ":scope > .slate-blockWrapper",
    )?.firstElementChild;
    if (!content) return;
    const range = document.createRange();
    range.selectNodeContents(content);
    const rect = range.getClientRects()[0];
    setFirstLineH(rect ? rect.height : null);
  }, [element, gutterPosition]);

  const useFullHeight = gutterPosition === "top" || firstLineH == null;

  return (
    <div
      ref={gutterRef}
      {...props}
      className={cn(
        "slate-gutterLeft",
        "absolute z-50 flex -translate-x-full cursor-text hover:opacity-100",
        useFullHeight && "h-full",
        gutterPosition === "top" ? "top-0 items-start" : "top-0 items-center",
        !selected && "sm:opacity-0",
        getPluginByType(editor, element.type)?.node.isContainer
          ? "group-hover/container:opacity-100"
          : "group-hover:opacity-100",
        isSelectionAreaVisible && "hidden",
        selected && "opacity-100",
        className,
      )}
      style={useFullHeight ? props.style : { ...props.style, height: `${firstLineH}px` }}
      contentEditable={false}
    >
      {children}
    </div>
  );
};

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

  const openBlockMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDragging) return;

      const blockSelectionApi = editor.getApi(BlockSelectionPlugin);
      const currentSelection = blockSelectionApi.blockSelection.getNodes();
      if (
        currentSelection.length === 0 ||
        !currentSelection.some(([node]) => node.id === element.id)
      ) {
        blockSelectionApi.blockSelection.set([element.id as string]);
      }

      const api = editor.getApi(BlockMenuPlugin);

      api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
        x: e.clientX,
        y: e.clientY,
      });
    },
    [isDragging, editor, element.id],
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (isFormButton) return;
      resetPreview();

      if ((e.button !== 0 && e.button !== 2) || e.shiftKey) return;

      const blockSelection = editor
        .getApi(BlockSelectionPlugin)
        .blockSelection.getNodes({ sort: true });

      // Drag handle targets ONE block. Use blockSelection only when it contains the clicked
      // block (multi-select); else drag it alone. editor.api.blocks (text-caret range) bleeds
      // the whole range into the preview → "drag the whole editor" giant ghost.
      let selectionNodes: typeof blockSelection;
      if (blockSelection.length > 0 && blockSelection.some(([node]) => node.id === element.id)) {
        selectionNodes = blockSelection;
      } else {
        const currentPath = editor.api.findPath(element);
        if (!currentPath) return;
        selectionNodes = [[element as TIdElement, currentPath]];
      }

      const blocks = expandListItemsWithChildren(editor, selectionNodes).map(([node]) => node);

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
    },
    [isFormButton, resetPreview, editor, element, previewRef],
  );

  const handleMouseEnter = React.useCallback(() => {
    if (isDragging) return;

    const blockSelection = editor
      .getApi(BlockSelectionPlugin)
      .blockSelection.getNodes({ sort: true });

    // Mirror mousedown: honor blockSelection only when it includes the hovered block;
    // else single-block, to avoid a multi-block previewTop offset from an unrelated range.
    let selectedBlocks: typeof blockSelection;
    if (blockSelection.length > 0 && blockSelection.some(([node]) => node.id === element.id)) {
      selectedBlocks = blockSelection;
    } else {
      const currentPath = editor.api.findPath(element);
      if (!currentPath) return;
      selectedBlocks = [[element as TIdElement, currentPath]];
    }

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
  }, [isDragging, editor, element, setPreviewTop]);

  const handleMouseUp = React.useCallback(() => {
    resetPreview();
  }, [resetPreview]);

  return (
    <button
      type="button"
      tabIndex={-1}
      className="flex h-7 w-6 items-center justify-center overflow-hidden rounded-lg p-0 hover:bg-secondary"
      onClick={openBlockMenu}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      data-plate-prevent-deselect
      aria-label={isFormButton ? "Button settings" : "Drag to move or open block menu"}
    >
      {isFormButton ? (
        <SettingsIcon className="text-muted-foreground" />
      ) : (
        <BlockDragIcon className="size-4 text-muted-foreground" />
      )}
    </button>
  );
});

const pathsEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const DropLine = React.memo(function DropLine({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { dropLine } = useDropLine();
  const editor = useEditorRef();
  const element = useElement();
  const draggingId = usePluginOption(DndPlugin, "draggingId") as string | string[] | undefined;

  if (!dropLine) return null;

  // Suppress indicator only on true no-op drops (Plate's onDropNode rejects these):
  // top: dragPath === hovered-1; bottom: dragPath === hovered+1; self: dragPath === hovered.
  // Earlier dropPath formula hid the line dragging UP onto N-1 (only appeared on N-2).
  if (draggingId) {
    const ids = Array.isArray(draggingId) ? draggingId : [draggingId];
    const primaryId = ids[0];
    const elementPath = editor.api.findPath(element);
    const dragEntry = primaryId ? editor.api.node({ id: primaryId, at: [] }) : undefined;
    const dragPath = dragEntry?.[1];

    if (dragPath && elementPath && elementPath.length > 0) {
      if (pathsEqual(dragPath, elementPath)) return null;

      const parent = elementPath.slice(0, -1);
      const last = elementPath[elementPath.length - 1] ?? 0;

      if (dropLine === "top") {
        // Dropping above hovered ⇒ slot at hovered-1.
        const adjacentAbove = [...parent, last - 1];
        if (pathsEqual(dragPath, adjacentAbove)) return null;
      } else if (dropLine === "bottom") {
        // Dropping below hovered ⇒ slot at hovered+1.
        const adjacentBelow = [...parent, last + 1];
        if (pathsEqual(dragPath, adjacentBelow)) return null;
      }
    }
  }

  return (
    <div
      {...props}
      className={cn(
        "slate-dropLine pointer-events-none",
        "absolute inset-x-0 h-1 opacity-100",
        "rounded-full bg-primary",
        "animate-[drop-line-pulse_1s_ease-in-out_infinite]",
        dropLine === "top" && "-top-0.5",
        dropLine === "bottom" && "-bottom-0.5",
        className,
      )}
    />
  );
});

/** Strip data-slate/data-block-id attrs so the clone isn't misread as a slate element. */
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

/**
 * Strip nodes that break the HTML5 drag-image snapshot. Base UI Checkbox/Radio render a
 * position:fixed hidden <input>; cloned for the preview it escapes the clone's box and makes
 * Chromium snapshot a viewport-sized region ("giant preview"). Remove fixed descendants.
 */
const stripDragPreviewArtifacts = (element: HTMLElement) => {
  Array.from(element.querySelectorAll("input")).forEach((input) => {
    input.remove();
  });
  Array.from(element.querySelectorAll<HTMLElement>('[style*="position: fixed"]')).forEach((el) => {
    el.remove();
  });
};

const applyScrollCompensation = (original: Element, cloned: HTMLElement) => {
  const scrollLeft = original.scrollLeft;

  if (scrollLeft > 0) {
    const scrollWrapper = document.createElement("div");
    Object.assign(scrollWrapper.style, {
      overflow: "hidden",
      width: `${original.clientWidth}px`,
    });

    const innerContainer = document.createElement("div");
    Object.assign(innerContainer.style, {
      transform: `translateX(-${scrollLeft}px)`,
      width: `${original.scrollWidth}px`,
    });

    while (cloned.firstChild) {
      innerContainer.append(cloned.firstChild);
    }

    const originalStyles = window.getComputedStyle(original);
    // Two distinct elements (cloned vs innerContainer) — cssText/Object.assign can't batch.
    cloned.style.setProperty("padding", "0");
    innerContainer.style.setProperty("padding", originalStyles.padding);

    scrollWrapper.append(innerContainer);
    cloned.append(scrollWrapper);
  }
};

const createDragPreviewElements = (editor: PlateEditor, blocks: TElement[]): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  const ids: string[] = [];

  const resolveElement = (node: TElement, index: number) => {
    const domNode = editor.api.toDOMNode(node);
    if (!domNode) return;
    const newDomNode = domNode.cloneNode(true) as HTMLElement;

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

        if (distance > 15) {
          wrapper.style.marginTop = `${distance}px`;
        }
      }
    }

    removeDataAttributes(newDomNode);
    stripDragPreviewArtifacts(newDomNode);
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
  const child = editor.api.toDOMNode(element);
  const editable = editor.api.toDOMNode(editor);
  const firstSelectedChild = blocks[0];

  if (!child || !editable || !firstSelectedChild) return 0;

  const firstDomNode = editor.api.toDOMNode(firstSelectedChild);

  if (!firstDomNode) return 0;

  const editorPaddingTop = Number(window.getComputedStyle(editable).paddingTop.replace("px", ""));

  const firstNodeToEditorDistance =
    firstDomNode.getBoundingClientRect().top -
    editable.getBoundingClientRect().top -
    editorPaddingTop;

  const marginTop = Number(window.getComputedStyle(firstDomNode).marginTop.replace("px", ""));

  const currentToEditorDistance =
    child.getBoundingClientRect().top - editable.getBoundingClientRect().top - editorPaddingTop;

  const currentMarginTop = Number(window.getComputedStyle(child).marginTop.replace("px", ""));

  return currentToEditorDistance - firstNodeToEditorDistance + marginTop - currentMarginTop;
};
