import { Redo2Icon, Undo2Icon } from "@/components/ui/icons";
import { useEditorRef, useEditorSelector } from "platejs/react";
import { useCallback } from "react";
import type * as React from "react";

import { ToolbarButton } from "./toolbar";

// eslint-disable-next-line typescript-eslint/no-explicit-any
const redoDisabledSelector = (editor: any) => editor.history.redos.length === 0;
// eslint-disable-next-line typescript-eslint/no-explicit-any
const undoDisabledSelector = (editor: any) => editor.history.undos.length === 0;
const preventDefault = (e: React.MouseEvent) => e.preventDefault();

export const RedoToolbarButton = (props: React.ComponentProps<typeof ToolbarButton>) => {
  const editor = useEditorRef();
  const disabled = useEditorSelector(redoDisabledSelector, []);

  const redo = useCallback(() => editor.redo(), [editor]);

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={redo}
      onMouseDown={preventDefault}
      tooltip="Redo"
    >
      <Redo2Icon />
    </ToolbarButton>
  );
};

export const UndoToolbarButton = (props: React.ComponentProps<typeof ToolbarButton>) => {
  const editor = useEditorRef();
  const disabled = useEditorSelector(undoDisabledSelector, []);

  const undo = useCallback(() => editor.undo(), [editor]);

  return (
    <ToolbarButton
      {...props}
      disabled={disabled}
      onClick={undo}
      onMouseDown={preventDefault}
      tooltip="Undo"
    >
      <Undo2Icon />
    </ToolbarButton>
  );
};
