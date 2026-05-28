import { flip, offset, useVirtualFloating } from "@platejs/floating";
import { useBlockSelectionNodes } from "@platejs/selection/react";
import { useEditorRef } from "platejs/react";
import { useEffect } from "react";

import { AIToolbarButton } from "./ai-toolbar-button";
import { Toolbar, ToolbarGroup } from "./toolbar";

const EMPTY_RECT = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };

/** Floating toolbar for block selection (no text range) — Plate's built-in only fires on text selection. */
export const BlockSelectionFloatingToolbar = () => {
  const editor = useEditorRef();
  const selectedNodes = useBlockSelectionNodes();
  const hasSelection = selectedNodes.length > 0;

  const getBoundingClientRect = () => {
    const firstEntry = selectedNodes[0];
    if (!firstEntry) return EMPTY_RECT;
    try {
      return editor.api.toDOMNode(firstEntry[0])?.getBoundingClientRect() ?? EMPTY_RECT;
    } catch {
      return EMPTY_RECT;
    }
  };

  const { refs, floatingStyles, update } = useVirtualFloating({
    getBoundingClientRect,
    middleware: [
      offset(12),
      flip({
        fallbackPlacements: ["top-start", "top-end", "bottom-start", "bottom-end"],
        padding: 12,
      }),
    ],
    open: hasSelection,
    placement: "top",
  });

  // eslint-disable-next-line react-doctor/no-effect-event-handler -- reacts to floating-ui virtual selection changes from editor; not a discrete user event
  useEffect(() => {
    if (hasSelection) update?.();
  }, [hasSelection, selectedNodes, update]);

  if (!hasSelection) return null;

  return (
    <div ref={refs.setFloating} style={floatingStyles} className="z-50">
      <Toolbar className="max-w-[80vw] scrollbar-none overflow-x-auto rounded-md bg-popover p-1 whitespace-nowrap opacity-100 elevation-lg print:hidden">
        <ToolbarGroup>
          <AIToolbarButton />
        </ToolbarGroup>
      </Toolbar>
    </div>
  );
};
