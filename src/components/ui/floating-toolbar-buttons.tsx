import { BoldIcon, ItalicIcon, StrikethroughIcon, UnderlineIcon } from "@/components/ui/icons";
import { KEYS } from "platejs";
import { useEditorReadOnly } from "platejs/react";

import { AIToolbarButton } from "./ai-toolbar-button";
import { LinkToolbarButton } from "./link-toolbar-button";
import { MarkToolbarButton } from "./mark-toolbar-button";
import { ToolbarGroup } from "./toolbar";
import { TurnIntoToolbarButton } from "./turn-into-toolbar-button";

export const FloatingToolbarButtons = () => {
  const readOnly = useEditorReadOnly();

  return (
    <>
      {!readOnly && (
        <ToolbarGroup>
          <AIToolbarButton />

          <TurnIntoToolbarButton />

          <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
            <BoldIcon />
          </MarkToolbarButton>

          <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
            <ItalicIcon />
          </MarkToolbarButton>

          <MarkToolbarButton nodeType={KEYS.underline} tooltip="Underline (⌘+U)">
            <UnderlineIcon />
          </MarkToolbarButton>

          <MarkToolbarButton nodeType={KEYS.strikethrough} tooltip="Strikethrough (⌘+⇧+M)">
            <StrikethroughIcon />
          </MarkToolbarButton>
          <LinkToolbarButton />
        </ToolbarGroup>
      )}
    </>
  );
};
