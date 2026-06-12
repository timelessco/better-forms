import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { DndPlugin } from "@platejs/dnd";
import { PlaceholderPlugin } from "@platejs/media/react";
import { createPlatePlugin } from "platejs/react";

import { BlockDraggable, ReadOnlyBlockWrapper } from "@/components/ui/block-draggable";

// DndPlugin is editOnly, so its BlockDraggable wrapper (which emits .slate-blockWrapper) is
// skipped in readOnly — collapsing block spacing in version view. This plugin isn't editOnly and
// re-emits the wrapper in readOnly only (it no-ops in edit mode where BlockDraggable owns it).
const ReadOnlyBlockSpacingPlugin = createPlatePlugin({
  key: "readOnlyBlockSpacing",
  render: { aboveNodes: ReadOnlyBlockWrapper },
});

export const DndKit = [
  DndPlugin.configure({
    options: {
      enableScroller: true,
      onDropFiles: ({ dragItem, editor, target }) => {
        editor
          .getTransforms(PlaceholderPlugin)
          .insert.media(dragItem.files, { at: target, nextBlock: false });
      },
    },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => <DndProvider backend={HTML5Backend}>{children}</DndProvider>,
    },
  }),
  ReadOnlyBlockSpacingPlugin,
];
