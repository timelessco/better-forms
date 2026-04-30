import { flip, offset } from "@platejs/floating";
import type { UseVirtualFloatingOptions } from "@platejs/floating";
import { getLinkAttributes } from "@platejs/link";
import {
  FloatingLinkUrlInput,
  useFloatingLinkEdit,
  useFloatingLinkEditState,
  useFloatingLinkInsert,
  useFloatingLinkInsertState,
} from "@platejs/link/react";
import type { LinkFloatingToolbarState } from "@platejs/link/react";
import { cva } from "class-variance-authority";
import { ExternalLinkIcon, LinkIcon, TextIcon, UnlinkIcon } from "@/components/ui/icons";
import type { TLinkElement } from "platejs";
import { KEYS } from "platejs";
import { useEditorRef, useFormInputProps, usePluginOption } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const popoverVariants = cva(
  "z-50 w-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden",
);

const inputVariants = cva(
  "flex h-[28px] w-full rounded-md border-none bg-transparent px-1.5 py-1 text-base placeholder:text-muted-foreground focus-visible:ring-transparent focus-visible:outline-none md:text-sm",
);

export const LinkFloatingToolbar = ({ state }: { state?: LinkFloatingToolbarState }) => {
  const activeCommentId = usePluginOption({ key: KEYS.comment }, "activeId");
  const activeSuggestionId = usePluginOption({ key: KEYS.suggestion }, "activeId");

  const floatingOptions: UseVirtualFloatingOptions = React.useMemo(
    () => ({
      middleware: [
        offset(8),
        flip({
          fallbackPlacements: ["bottom-end", "top-start", "top-end"],
          padding: 12,
        }),
      ],
      placement: activeSuggestionId || activeCommentId ? "top-start" : "bottom-start",
    }),
    [activeCommentId, activeSuggestionId],
  );

  const insertState = useFloatingLinkInsertState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    hidden,
    props: insertProps,
    ref: insertRef,
    textInputProps,
  } = useFloatingLinkInsert(insertState);

  const editState = useFloatingLinkEditState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    editButtonProps,
    props: editProps,
    ref: editRef,
    unlinkButtonProps,
  } = useFloatingLinkEdit(editState);
  const inputProps = useFormInputProps({
    preventDefaultOnEnterKeydown: true,
  });

  if (hidden) return null;

  const input = (
    <div className="flex w-[330px] flex-col" {...inputProps}>
      <div className="flex items-center">
        <div className="flex items-center pr-1 pl-2 text-muted-foreground">
          <LinkIcon className="size-4" />
        </div>

        <FloatingLinkUrlInput
          className={inputVariants()}
          placeholder="Paste link"
          data-plate-focus
          aria-label="Link URL"
        />
      </div>
      <Separator className="my-1" />
      <div className="flex items-center">
        <div className="flex items-center pr-1 pl-2 text-muted-foreground">
          <TextIcon className="size-4" />
        </div>
        <input
          className={inputVariants()}
          placeholder="Text to display"
          data-plate-focus
          aria-label="Link text"
          {...textInputProps}
        />
      </div>
    </div>
  );

  const editContent = editState.isEditing ? (
    input
  ) : (
    <div className="box-content flex items-center">
      <Button variant="ghost" size="sm" {...editButtonProps}>
        Edit link
      </Button>

      <Separator orientation="vertical" />

      <LinkOpenButton />

      <Separator orientation="vertical" />

      <Button variant="ghost" size="sm" aria-label="Remove link" {...unlinkButtonProps}>
        <UnlinkIcon width={18} />
      </Button>
    </div>
  );

  return (
    <>
      <div ref={insertRef} className={popoverVariants()} {...insertProps}>
        {input}
      </div>

      <div ref={editRef} className={popoverVariants()} {...editProps}>
        {editContent}
      </div>
    </>
  );
};

const LinkOpenButton = () => {
  const editor = useEditorRef();

  const attributes = React.useMemo(
    () => {
      const entry = editor.api.node({
        match: { type: editor.getType(KEYS.link) },
      });
      if (!entry) {
        return {};
      }
      const [element] = entry as [TLinkElement, unknown];
      return getLinkAttributes(editor, element);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor],
  );

  const href = attributes.href;
  const safeTarget = attributes.target ?? "_blank";
  const handleOpenLink = React.useCallback(() => {
    if (!href || typeof window === "undefined") return;
    const newWindow = window.open(href, safeTarget, "noopener,noreferrer");
    if (newWindow) {
      newWindow.opener = null;
    }
  }, [href, safeTarget]);

  const stopPropagationInteraction = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleOpenLink}
      onMouseOver={stopPropagationInteraction}
      onFocus={stopPropagationInteraction}
      aria-label="Open link in a new tab"
    >
      <ExternalLinkIcon width={18} />
    </Button>
  );
};
