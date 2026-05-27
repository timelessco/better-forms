import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { EditorStatic } from "@/components/ui/editor-static";
import { createSlateEditor } from "platejs";
import type { Value } from "platejs";
import { useMemo } from "react";

// Render Plate nodes statically via PlateStatic. Memoized editor w/ BaseEditorKit so all static components (headings, blockquotes, code, tables, lists) render at full fidelity.
export const StaticContentBlock = ({ nodes }: { nodes: Value }) => {
  const editor = useMemo(
    () => createSlateEditor({ plugins: BaseEditorKit, value: nodes }),
    [nodes],
  );

  return (
    <EditorStatic
      editor={editor}
      variant="none"
      className="!mx-0 !my-0 overflow-x-visible! !p-0 text-base [&_.slate-p]:m-0 [&_.slate-p]:px-0"
    />
  );
};
