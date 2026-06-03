import {
  BLOCK_CONTEXT_MENU_ID,
  BlockMenuPlugin,
  BlockSelectionPlugin,
} from "@platejs/selection/react";
import { KEYS } from "platejs";
import type { PlateEditor } from "platejs/react";
import { useEditorPlugin, usePlateState, usePluginOption } from "platejs/react";
import * as React from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useIsTouchDevice } from "@/hooks/use-is-touch-device";

type _Value = "askAI" | null;

type OptionNode = { type?: string; variant?: string };

/** Walk back to the first formOptionItem in the consecutive run — `shuffle` is read
 * off the group's anchor node by the plate→form transform. */
const getGroupStartPath = (editor: PlateEditor, path: number[]): number[] => {
  let current = path;
  while (current[current.length - 1] > 0) {
    const prevPath = [...current];
    prevPath[prevPath.length - 1] -= 1;
    try {
      const prev = editor.api.node(prevPath);
      if ((prev?.[0] as OptionNode | undefined)?.type === "formOptionItem") {
        current = prevPath;
        continue;
      }
    } catch {
      // out of range
    }
    break;
  }
  return current;
};

/** Anchor path of a selected single-select Dropdown field, or null. Matches a selected
 * dropdown option row, or a formLabel whose next sibling is one. */
const findDropdownAnchorPath = (editor: PlateEditor): number[] | null => {
  const nodes = editor.getApi(BlockSelectionPlugin).blockSelection.getNodes();
  for (const [node, path] of nodes) {
    const n = node as OptionNode;
    if (n.type === "formOptionItem" && n.variant === "dropdown") {
      return getGroupStartPath(editor, path);
    }
    if (n.type === "formLabel") {
      const nextPath = [...path];
      nextPath[nextPath.length - 1] += 1;
      try {
        const next = editor.api.node(nextPath);
        const nn = next?.[0] as OptionNode | undefined;
        if (nn?.type === "formOptionItem" && nn.variant === "dropdown") return nextPath;
      } catch {
        // no next sibling
      }
    }
  }
  return null;
};

export const BlockContextMenu = ({ children }: { children: React.ReactNode }) => {
  const { api, editor } = useEditorPlugin(BlockMenuPlugin);
  const [_value, setValue] = React.useState<_Value>(null);
  const isTouch = useIsTouchDevice();
  const [readOnly] = usePlateState("readOnly");
  const openId = usePluginOption(BlockMenuPlugin, "openId");
  const isOpen = openId === BLOCK_CONTEXT_MENU_ID;

  const handleTurnInto = React.useCallback(
    (type: string) => {
      editor
        .getApi(BlockSelectionPlugin)
        .blockSelection.getNodes()
        .forEach(([node, path]) => {
          if (node[KEYS.listType]) {
            editor.tf.unsetNodes([KEYS.listType, "indent"], {
              at: path,
            });
          }

          editor.tf.toggleBlock(type, { at: path });
        });
    },
    [editor],
  );

  const handleAlign = React.useCallback(
    (align: "center" | "left" | "right") => {
      editor.getTransforms(BlockSelectionPlugin).blockSelection.setNodes({ align });
    },
    [editor],
  );

  const selectedNodes = editor.getApi(BlockSelectionPlugin).blockSelection.getNodes();
  const hasFormLabel = selectedNodes.some(([node]) => node.type === "formLabel");
  // Read required from the next sibling input node (not the label)
  const isRequired = selectedNodes.some(([node, path]) => {
    if (node.type !== "formLabel") return false;
    const nextPath = [...path];
    nextPath[nextPath.length - 1] += 1;
    try {
      const next = editor.api.node(nextPath);
      return next ? Boolean(next[0]?.required) : false;
    } catch {
      return false;
    }
  });

  // Single-select Dropdown fields expose a "Shuffle options" toggle (Figma node 25578:10632).
  const dropdownAnchorPath = findDropdownAnchorPath(editor);
  const isShuffled = (() => {
    if (!dropdownAnchorPath) return false;
    try {
      const anchor = editor.api.node(dropdownAnchorPath);
      return Boolean((anchor?.[0] as { shuffle?: boolean } | undefined)?.shuffle);
    } catch {
      return false;
    }
  })();

  const handleShuffleToggle = React.useCallback(() => {
    const anchorPath = findDropdownAnchorPath(editor);
    if (!anchorPath) return;
    try {
      const anchor = editor.api.node(anchorPath);
      const current = Boolean((anchor?.[0] as { shuffle?: boolean } | undefined)?.shuffle);
      editor.tf.setNodes({ shuffle: !current }, { at: anchorPath });
    } catch {
      // node removed
    }
  }, [editor]);

  const handleRequiredToggle = React.useCallback(() => {
    editor
      .getApi(BlockSelectionPlugin)
      .blockSelection.getNodes()
      .forEach(([node, path]) => {
        if (node.type === "formLabel") {
          // Write required to the next sibling input node
          const nextPath = [...path];
          nextPath[nextPath.length - 1] += 1;
          try {
            const next = editor.api.node(nextPath);
            if (next) {
              editor.tf.setNodes({ required: !next[0]?.required }, { at: nextPath });
            }
          } catch {
            // No next sibling
          }
        }
      });
  }, [editor]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        api.blockMenu.hide();
      }
    },
    [api.blockMenu],
  );

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      const dataset = (event.target as HTMLElement).dataset;
      const disabled =
        dataset?.slateEditor === "true" || readOnly || dataset?.plateOpenContextMenu === "false";

      if (disabled) return event.preventDefault();

      setTimeout(() => {
        api.blockMenu.show(BLOCK_CONTEXT_MENU_ID, {
          x: event.clientX,
          y: event.clientY,
        });
      }, 0);
    },
    [api.blockMenu, readOnly],
  );

  const handleAskAI = React.useCallback(() => {
    setValue("askAI");
  }, []);

  const handleDelete = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.removeNodes();
    editor.tf.focus();
  }, [editor]);

  const handleDuplicate = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
  }, [editor]);

  const handleTurnIntoParagraph = React.useCallback(() => handleTurnInto(KEYS.p), [handleTurnInto]);
  const handleTurnIntoH1 = React.useCallback(() => handleTurnInto(KEYS.h1), [handleTurnInto]);
  const handleTurnIntoH2 = React.useCallback(() => handleTurnInto(KEYS.h2), [handleTurnInto]);
  const handleTurnIntoH3 = React.useCallback(() => handleTurnInto(KEYS.h3), [handleTurnInto]);
  const handleTurnIntoBlockquote = React.useCallback(
    () => handleTurnInto(KEYS.blockquote),
    [handleTurnInto],
  );

  const handleIndent = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(1);
  }, [editor]);

  const handleOutdent = React.useCallback(() => {
    editor.getTransforms(BlockSelectionPlugin).blockSelection.setIndent(-1);
  }, [editor]);

  const handleAlignLeft = React.useCallback(() => handleAlign("left"), [handleAlign]);
  const handleAlignCenter = React.useCallback(() => handleAlign("center"), [handleAlign]);
  const handleAlignRight = React.useCallback(() => handleAlign("right"), [handleAlign]);

  if (isTouch) {
    return children;
  }

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger render={<div className="w-full" />} onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      {isOpen && (
        <ContextMenuContent className="w-64">
          <ContextMenuGroup>
            <ContextMenuItem onClick={handleAskAI}>Ask AI</ContextMenuItem>
            {hasFormLabel && (
              <ContextMenuItem onClick={handleRequiredToggle}>
                {isRequired ? "Unmark Required" : "Mark Required"}
              </ContextMenuItem>
            )}
            {dropdownAnchorPath && (
              <ContextMenuItem onClick={handleShuffleToggle}>
                {isShuffled ? "Don't shuffle options" : "Shuffle options"}
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={handleDelete}>Delete</ContextMenuItem>
            <ContextMenuItem onClick={handleDuplicate}>Duplicate</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Turn into</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem onClick={handleTurnIntoParagraph}>Paragraph</ContextMenuItem>

                <ContextMenuItem onClick={handleTurnIntoH1}>Heading 1</ContextMenuItem>
                <ContextMenuItem onClick={handleTurnIntoH2}>Heading 2</ContextMenuItem>
                <ContextMenuItem onClick={handleTurnIntoH3}>Heading 3</ContextMenuItem>
                <ContextMenuItem onClick={handleTurnIntoBlockquote}>Blockquote</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>

          <ContextMenuGroup>
            <ContextMenuItem onClick={handleIndent}>Indent</ContextMenuItem>
            <ContextMenuItem onClick={handleOutdent}>Outdent</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Align</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                <ContextMenuItem onClick={handleAlignLeft}>Left</ContextMenuItem>
                <ContextMenuItem onClick={handleAlignCenter}>Center</ContextMenuItem>
                <ContextMenuItem onClick={handleAlignRight}>Right</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuGroup>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
};
