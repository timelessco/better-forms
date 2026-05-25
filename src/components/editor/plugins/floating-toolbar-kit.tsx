import { createPlatePlugin } from "platejs/react";

import { BlockSelectionFloatingToolbar } from "@/components/ui/block-selection-floating-toolbar";
import { FloatingToolbar } from "@/components/ui/floating-toolbar";
import { FloatingToolbarButtons } from "@/components/ui/floating-toolbar-buttons";

export const FloatingToolbarKit = [
  createPlatePlugin({
    key: "floating-toolbar",
    render: {
      afterEditable: () => (
        <>
          <FloatingToolbar>
            <FloatingToolbarButtons />
          </FloatingToolbar>
          <BlockSelectionFloatingToolbar />
        </>
      ),
    },
  }),
];
