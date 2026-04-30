import { useEditorRef } from "platejs/react";
import type * as React from "react";

import { triggerAIInput } from "@/components/editor/plugins/ai-input-kit";
import { SparklesIcon } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { ToolbarButton } from "@/components/ui/toolbar";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<typeof ToolbarButton>, "onClick" | "onMouseDown">;

export const AIToolbarButton = ({ className, ...props }: Props) => {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      {...props}
      tooltip="Ask AI"
      onClick={() => triggerAIInput(editor)}
      onMouseDown={(e) => e.preventDefault()}
      className={cn("gap-1.5 px-2 text-primary", className)}
    >
      <SparklesIcon className="size-4" />
      <span className="text-sm font-medium">Ask AI</span>
      <Kbd>⌘J</Kbd>
    </ToolbarButton>
  );
};
