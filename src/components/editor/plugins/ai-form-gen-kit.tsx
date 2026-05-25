"use client";

import { MarkdownPlugin } from "@platejs/markdown";
import { useBlockSelectionNodes } from "@platejs/selection/react";
import { NodeApi, PathApi } from "platejs";
import { createPlatePlugin, useEditorRef, usePluginOption } from "platejs/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AIFormGenBubble } from "@/components/ui/ai-form-gen-bubble";
import { SparklesIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormGenStream } from "@/components/editor/hooks/use-form-gen-stream";

export const AIFormGenPlugin = createPlatePlugin({
  key: "aiFormGen",
  options: { isOpen: false as boolean, formId: "" as string },
  render: {
    afterEditable: () => <AIFormGenMenu />,
  },
});

const AIFormGenMenu = () => {
  const editor = useEditorRef();
  const isOpen = usePluginOption(AIFormGenPlugin, "isOpen");
  const formId = usePluginOption(AIFormGenPlugin, "formId");
  const [generationError, setGenerationError] = useState<string | null>(null);

  const getEditorContent = useCallback((): string => {
    try {
      return editor.getApi(MarkdownPlugin).markdown.serialize();
    } catch {
      return "";
    }
  }, [editor]);

  const capturedPathRef = useRef<number[] | null>(null);
  const [selectionContext, setSelectionContext] = useState<string | null>(null);
  const blockSelectionNodes = useBlockSelectionNodes();

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      capturedPathRef.current = null;
      setSelectionContext(null);
      setGenerationError(null);
    } else if (!capturedPathRef.current) {
      const block = editor.api.block();
      if (block) {
        const [, path] = block;
        capturedPathRef.current = PathApi.next(path);
      } else {
        capturedPathRef.current = [editor.children.length];
      }

      // Priority 1: multi-block selection via drag-handle — show chip
      if (blockSelectionNodes.length > 0) {
        const lastSelectedPath = blockSelectionNodes[blockSelectionNodes.length - 1]?.[1];
        if (lastSelectedPath && lastSelectedPath.length > 0) {
          capturedPathRef.current = PathApi.next(lastSelectedPath);
        }

        if (blockSelectionNodes.length === 1) {
          try {
            const text = NodeApi.string(blockSelectionNodes[0]?.[0]).trim();
            setSelectionContext(text || "1 block selected");
          } catch {
            setSelectionContext("1 block selected");
          }
        } else {
          let preview = "";
          try {
            preview = NodeApi.string(blockSelectionNodes[0]?.[0]).trim();
          } catch {
            preview = "";
          }
          const label = `${blockSelectionNodes.length} blocks selected`;
          setSelectionContext(preview ? `${label} — ${preview}` : label);
        }
      } else {
        // Priority 2: highlighted text range — show chip
        const selection = editor.selection;
        let captured = false;
        if (selection && editor.api.isExpanded()) {
          try {
            const selectedText = editor.api.string(selection).trim();
            if (selectedText) {
              setSelectionContext(selectedText);
              captured = true;
            }
          } catch {
            // fall through to no-chip case
          }
        }
        if (!captured) {
          setSelectionContext(null);
        }
      }
    }
  }

  const getCapturedPath = useCallback(
    (): number[] => capturedPathRef.current ?? [editor.children.length],
    [editor],
  );

  const getSelectionContext = useCallback((): string | null => {
    // For multi-block selections, send the full text of every selected block
    // to the server, not just the short preview we show in the chip.
    if (blockSelectionNodes.length > 0) {
      const parts: string[] = [];
      for (const entry of blockSelectionNodes) {
        try {
          const text = NodeApi.string(entry[0]).trim();
          if (text) parts.push(text);
        } catch {
          // skip unreadable node
        }
      }
      if (parts.length > 0) return parts.join("\n");
    }
    return selectionContext;
  }, [blockSelectionNodes, selectionContext]);

  const getSelectedBlockPaths = useCallback(
    (): number[][] => blockSelectionNodes.map((entry) => entry[1]),
    [blockSelectionNodes],
  );

  const { submit, isLoading } = useFormGenStream({
    editor,
    formId,
    getCapturedPath,
    getEditorContent,
    getSelectionContext,
    getSelectedBlockPaths,
    onFinish: () => {
      editor.setOption(AIFormGenPlugin, "isOpen", false);
    },
    onError: (message) => {
      setGenerationError(message);
    },
  });

  const handleSubmit = useCallback(
    (prompt: string, image?: { url: string; name: string } | null) => {
      setGenerationError(null);
      submit(prompt, image ? [image] : undefined);
    },
    [submit],
  );

  const handleRemoveSelection = useCallback(() => {
    setSelectionContext(null);
  }, []);

  const handleClose = useCallback(() => {
    editor.setOption(AIFormGenPlugin, "isOpen", false);
    // Plate preserves editor.selection even when DOM focus leaves the editor.
    setTimeout(() => {
      editor.tf.focus();
    }, 0);
  }, [editor]);

  // Global shortcut: ⌘⇧K / Ctrl+⇧K — works regardless of focus (title textarea, body, etc.)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const current = editor.getOption(AIFormGenPlugin, "isOpen");
        editor.setOption(AIFormGenPlugin, "isOpen", !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const handleToggle = useCallback(() => {
    editor.setOption(AIFormGenPlugin, "isOpen", !isOpen);
  }, [editor, isOpen]);

  return (
    <>
      {!isOpen && (
        <div className="fixed right-6 bottom-6 z-40">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleToggle}
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex size-8 items-center justify-center rounded-full bg-background shadow-lg transition-colors hover:bg-background/90"
                  aria-label="AI Form Generator"
                />
              }
            >
              <SparklesIcon className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>AI Form Generator</p>
              <p className="text-xs text-muted-foreground">⌘⇧K</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      {isOpen && (
        <AIFormGenBubble
          onSubmit={handleSubmit}
          onClose={handleClose}
          isGenerating={isLoading}
          error={generationError}
          selectionContext={selectionContext}
          onRemoveSelection={handleRemoveSelection}
        />
      )}
    </>
  );
};

export const AIFormGenKit = [AIFormGenPlugin];
