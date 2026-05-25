import {
  FloatingMedia as FloatingMediaPrimitive,
  FloatingMediaStore,
  useFloatingMediaValue,
  useImagePreviewValue,
} from "@platejs/media/react";
import { cva } from "class-variance-authority";
import { LinkIcon, Trash2Icon } from "@/components/ui/icons";
import type { WithRequiredKey } from "platejs";
import {
  useEditorRef,
  useEditorSelector,
  useElement,
  useFocusedLast,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
} from "platejs/react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { CaptionButton } from "./caption";

const inputVariants = cva(
  "flex h-[28px] w-full rounded-md border-none bg-transparent px-1.5 py-1 text-base placeholder:text-muted-foreground focus-visible:ring-transparent focus-visible:outline-none md:text-sm",
);

export const MediaToolbar = ({
  children,
  plugin,
}: {
  children: React.ReactNode;
  plugin: WithRequiredKey;
}) => {
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const selected = useSelected();
  const isFocusedLast = useFocusedLast();
  const selectionCollapsed = useEditorSelector((ed) => !ed.api.isExpanded(), []);
  const isImagePreviewOpen = useImagePreviewValue("isOpen", editor.id);
  const open = isFocusedLast && !readOnly && selected && selectionCollapsed && !isImagePreviewOpen;
  const isEditing = useFloatingMediaValue("isEditing");
  const element = useElement();
  const { props: buttonProps } = useRemoveNodeButton({ element });

  return (
    <Popover
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          FloatingMediaStore.set("isEditing", false);
        }
      }}
      modal={false}
    >
      <PopoverAnchor>{children}</PopoverAnchor>

      <PopoverContent className="w-auto p-1">
        {isEditing ? (
          <div className="flex w-[330px] flex-col">
            <div className="flex items-center">
              <div className="flex items-center pr-1 pl-2 text-muted-foreground">
                <LinkIcon className="size-4" />
              </div>

              <FloatingMediaPrimitive.UrlInput
                className={inputVariants()}
                placeholder="Paste the embed link..."
                options={{ plugin }}
              />
            </div>
          </div>
        ) : (
          <div className="box-content flex items-center">
            <FloatingMediaPrimitive.EditButton
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              Edit link
            </FloatingMediaPrimitive.EditButton>

            <CaptionButton size="sm" variant="ghost">
              Caption
            </CaptionButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <Button size="sm" variant="ghost" aria-label="Remove media" {...buttonProps}>
              <Trash2Icon />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
