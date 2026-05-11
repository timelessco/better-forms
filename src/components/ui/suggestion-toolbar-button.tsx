import { SuggestionPlugin } from "@platejs/suggestion/react";
import { PencilLineIcon } from "@/components/ui/icons";
import { useEditorPlugin, usePluginOption } from "platejs/react";
import { useCallback } from "react";
import type React from "react";

import { cn } from "@/lib/utils";

import { ToolbarButton } from "./toolbar";

const preventDefault = (e: React.MouseEvent) => e.preventDefault();

export const SuggestionToolbarButton = () => {
  const { setOption } = useEditorPlugin(SuggestionPlugin);
  const isSuggesting = usePluginOption(SuggestionPlugin, "isSuggesting");

  const toggleSuggesting = useCallback(
    () => setOption("isSuggesting", !isSuggesting),
    [setOption, isSuggesting],
  );

  return (
    <ToolbarButton
      className={cn(isSuggesting && "text-brand/80 hover:text-brand/80")}
      onClick={toggleSuggesting}
      onMouseDown={preventDefault}
      tooltip={isSuggesting ? "Turn off suggesting" : "Suggestion edits"}
    >
      <PencilLineIcon />
    </ToolbarButton>
  );
};
