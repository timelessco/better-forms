import { AIFormGenPlugin } from "@/components/editor/plugins/ai-form-gen-kit";
import { useEditorPlugin } from "platejs/react";
import { useCallback } from "react";

import { ToolbarButton } from "./toolbar";

export const AIFormGenToolbarButton = (props: React.ComponentProps<typeof ToolbarButton>) => {
  const { editor } = useEditorPlugin(AIFormGenPlugin);

  const toggleAIFormGen = useCallback(() => {
    const current = editor.getOption(AIFormGenPlugin, "isOpen");
    editor.setOption(AIFormGenPlugin, "isOpen", !current);
  }, [editor]);

  const preventMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return <ToolbarButton {...props} onClick={toggleAIFormGen} onMouseDown={preventMouseDown} />;
};
