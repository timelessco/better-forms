import { MarkdownPlugin } from "@platejs/markdown";
import { BlockSelectionPlugin } from "@platejs/selection/react";
import { ArrowUpIcon, CornerUpLeftIcon } from "lucide-react";
import { isHotkey } from "platejs";
import { useEditorRef, usePluginOption } from "platejs/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { useFormGenStream } from "@/components/editor/hooks/use-form-gen-stream";
import { AIInputPlugin, hideAIInput } from "@/components/editor/plugins/ai-input-base";
import type { AIInputState } from "@/components/editor/plugins/ai-input-base";
import { IconSwap } from "@/components/transitions/icon-swap";
import { Button } from "@/components/ui/button";
import { CheckIcon, ImageIcon, Loader2Icon, SparklesIcon, XIcon } from "@/components/ui/icons";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

type AttachedImage = { url: string; name: string };

/**
 * Rendered once as the plugin's `afterEditable` slot. Only mounts the popover
 * body when state.open is true — closing unmounts the body, resetting prompt
 * state without leaving any node behind in the editor tree.
 */
export const AIInputOverlay = () => {
  const state = usePluginOption(AIInputPlugin, "ui");
  if (!state.open) return null;
  return <AIInputPopoverBody state={state} />;
};

const AIInputPopoverBody = ({ state }: { state: AIInputState }) => {
  const editor = useEditorRef();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastPromptRef = useRef<{ prompt: string; images: AttachedImage[] }>({
    prompt: "",
    images: [],
  });
  const [hasPendingPreview, setHasPendingPreview] = useState(false);
  const anchorRect = useMemo(
    () =>
      state.anchor
        ? { width: state.anchor.offsetWidth, height: state.anchor.offsetHeight }
        : { width: 0, height: 0 },
    [state.anchor],
  );

  const formId = usePluginOption(AIInputPlugin, "formId");

  const getEditorContent = useCallback((): string => {
    try {
      return editor.getApi(MarkdownPlugin).markdown.serialize();
    } catch {
      return "";
    }
  }, [editor]);

  const getCapturedPath = useCallback((): number[] => state.insertAt, [state.insertAt]);
  const getSelectionContext = useCallback(
    (): string | null => state.selectionContext,
    [state.selectionContext],
  );
  const getSelectedBlockPaths = useCallback(
    (): number[][] => state.selectedPaths,
    [state.selectedPaths],
  );

  const clearBlockSelection = useCallback(() => {
    try {
      editor.getApi(BlockSelectionPlugin).blockSelection.deselect();
    } catch {
      // best-effort
    }
  }, [editor]);

  const hide = useCallback(() => {
    hideAIInput(editor);
    clearBlockSelection();
  }, [editor, clearBlockSelection]);

  const {
    submit: submitFormGen,
    isLoading,
    stop,
    rollback,
    accept,
  } = useFormGenStream({
    editor,
    formId,
    getCapturedPath,
    getEditorContent,
    getSelectionContext,
    getSelectedBlockPaths,
    onFinish: () => {
      setHasPendingPreview(true);
    },
    onError: (message) => {
      setError(message);
      setHasPendingPreview(false);
    },
  });

  const runPrompt = useCallback(
    (prompt: string, images: AttachedImage[]) => {
      setError(null);
      lastPromptRef.current = { prompt, images };
      submitFormGen(prompt, images);
    },
    [submitFormGen],
  );

  useMountEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  });

  const processFile = useCallback(
    (file: File): Promise<AttachedImage | null> =>
      new Promise((resolve) => {
        if (!file.type.startsWith("image/")) return resolve(null);
        if (file.size > MAX_FILE_SIZE) return resolve(null);
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          resolve({ url: reader.result as string, name: file.name });
        });
        reader.readAsDataURL(file);
      }),
    [],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && attachedImages.length === 0) || isLoading) return;
    const prompt = trimmed || "Extract theme from this image";
    runPrompt(prompt, attachedImages);
    setInput("");
    setAttachedImages([]);
  }, [input, attachedImages, isLoading, runPrompt]);

  const discardPreview = useCallback(() => {
    rollback();
    setHasPendingPreview(false);
  }, [rollback]);

  const handleAccept = useCallback(() => {
    accept();
    setHasPendingPreview(false);
    hide();
  }, [accept, hide]);

  const handleReject = useCallback(() => {
    discardPreview();
    hide();
  }, [discardPreview, hide]);

  const handleTryAgain = useCallback(() => {
    discardPreview();
    const { prompt, images } = lastPromptRef.current;
    if (prompt) runPrompt(prompt, images);
  }, [discardPreview, runPrompt]);

  const handleStop = useCallback(() => {
    stop?.();
    discardPreview();
  }, [discardPreview, stop]);

  const onAcceptEvent = useEffectEvent(() => handleAccept());
  const onRejectEvent = useEffectEvent(() => handleReject());
  const onTryAgainEvent = useEffectEvent(() => handleTryAgain());

  // Mirror the previous window-level keybinds so Enter/Cmd+Z/Cmd+R work during a pending preview.
  useEffect(() => {
    if (!hasPendingPreview) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (e.key === "Enter" && !e.shiftKey && !isMod) {
        e.preventDefault();
        e.stopPropagation();
        onAcceptEvent();
      } else if (isMod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        onRejectEvent();
      } else if (isMod && e.key.toLowerCase() === "r") {
        e.preventDefault();
        e.stopPropagation();
        onTryAgainEvent();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [hasPendingPreview]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hide();
        return;
      }
      if (isHotkey("mod+j")(e.nativeEvent)) {
        e.preventDefault();
        hide();
        return;
      }
      if (e.key === "Backspace" && input.length === 0 && attachedImages.length === 0) {
        e.preventDefault();
        hide();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [hide, input, attachedImages, handleSubmit],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;
      const processed = await Promise.all(files.map((f) => processFile(f)));
      const valid = processed.filter((img): img is AttachedImage => img !== null);
      if (valid.length === 0) return;
      setAttachedImages((prev) => [...prev, ...valid]);
      inputRef.current?.focus();
    },
    [processFile],
  );

  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      // While a stream is in flight or a diff preview is pending, block
      // outside-click dismissal — the user must explicitly Stop (in-flight)
      // or Accept/Discard (preview) to close. Losing these silently would
      // kill the generation or drop the pending diff with no indication.
      if (isLoading || hasPendingPreview) return;
      hide();
    },
    [isLoading, hasPendingPreview, hide],
  );

  return (
    <Popover open onOpenChange={handleOpenChange}>
      <PopoverContent
        anchor={state.anchor}
        align="start"
        side="bottom"
        sideOffset={-anchorRect.height}
        className="z-30 p-0"
        style={{ width: anchorRect.width || undefined }}
      >
        <div
          className={cn(
            "animate-in rounded-xl bg-background elevation-lg transition-colors duration-150 fade-in-0 zoom-in-95",
            error && "ring-destructive",
          )}
        >
          {error && <p className="px-3 pt-2 text-xs text-destructive">{error}</p>}

          {state.selectionContext && !hasPendingPreview && (
            <SelectionContextRow
              selectionContext={state.selectionContext}
              selectedPathsCount={state.selectedPaths.length}
            />
          )}

          {attachedImages.length > 0 && !hasPendingPreview && (
            <AttachedImagesRow attachedImages={attachedImages} removeImage={removeImage} />
          )}

          {hasPendingPreview ? (
            <PendingPreviewActions
              handleAccept={handleAccept}
              handleReject={handleReject}
              handleTryAgain={handleTryAgain}
            />
          ) : (
            <PromptInputRow
              inputRef={inputRef}
              input={input}
              setInput={setInput}
              handleKeyDown={handleKeyDown}
              isLoading={isLoading}
              fileInputRef={fileInputRef}
              attachedImagesCount={attachedImages.length}
              handleSubmit={handleSubmit}
              handleStop={handleStop}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface SelectionContextRowProps {
  selectionContext: string;
  selectedPathsCount: number;
}

const SelectionContextRow = ({
  selectionContext,
  selectedPathsCount,
}: SelectionContextRowProps) => (
  <div className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs text-muted-foreground">
    <SparklesIcon className="size-3.5 shrink-0" />
    <span className="max-w-[400px] truncate">
      {selectedPathsCount > 0
        ? `${selectedPathsCount} block${selectedPathsCount > 1 ? "s" : ""} selected`
        : selectionContext.length > 80
          ? `${selectionContext.slice(0, 80)}…`
          : selectionContext}
    </span>
  </div>
);

interface AttachedImagesRowProps {
  attachedImages: AttachedImage[];
  removeImage: (index: number) => void;
}

const AttachedImagesRow = ({ attachedImages, removeImage }: AttachedImagesRowProps) => (
  <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 pb-0.5">
    {attachedImages.map((img, i) => (
      <div
        key={img.url}
        className="group relative inline-flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pr-2 pl-0.5 text-xs text-foreground"
        title={img.name}
      >
        <img src={img.url} alt="" className="size-5 shrink-0 rounded-full object-cover" />
        <span className="max-w-[140px] truncate">{img.name}</span>
        <button
          type="button"
          onClick={() => removeImage(i)}
          className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${img.name}`}
        >
          <XIcon className="size-3" />
        </button>
      </div>
    ))}
  </div>
);

interface PendingPreviewActionsProps {
  handleAccept: () => void;
  handleReject: () => void;
  handleTryAgain: () => void;
}

const PendingPreviewActions = ({
  handleAccept,
  handleReject,
  handleTryAgain,
}: PendingPreviewActionsProps) => (
  <div className="flex items-center gap-1 px-2 py-1.5">
    <button
      type="button"
      onClick={handleAccept}
      className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-muted"
    >
      <CheckIcon className="size-4 text-emerald-600" />
      Accept
      <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:bg-background">
        ↵
      </kbd>
    </button>
    <button
      type="button"
      onClick={handleReject}
      className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-muted"
    >
      <XIcon className="size-4 text-destructive" />
      Discard
      <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:bg-background">
        ⌘Z
      </kbd>
    </button>
    <button
      type="button"
      onClick={handleTryAgain}
      className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-muted"
    >
      <CornerUpLeftIcon className="size-4 text-muted-foreground" />
      Try again
      <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:bg-background">
        ⌘R
      </kbd>
    </button>
  </div>
);

interface PromptInputRowProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  attachedImagesCount: number;
  handleSubmit: () => void;
  handleStop: () => void;
}

const PromptInputRow = ({
  inputRef,
  input,
  setInput,
  handleKeyDown,
  isLoading,
  fileInputRef,
  attachedImagesCount,
  handleSubmit,
  handleStop,
}: PromptInputRowProps) => (
  <div className="flex items-center gap-2 pr-1.5 pl-4">
    <textarea
      ref={inputRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={isLoading}
      rows={1}
      placeholder={isLoading ? "Generating..." : "Ask AI anything..."}
      className={cn(
        "flex field-sizing-content w-full resize-none bg-transparent py-1.5 text-sm outline-none",
        "max-h-40 overflow-y-auto leading-5",
        "placeholder:text-muted-foreground/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
      aria-label="AI prompt"
    />

    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => fileInputRef.current?.click()}
      disabled={isLoading}
      className="rounded-full text-muted-foreground"
      aria-label="Attach image for theme"
      title="Attach image for theme"
    >
      <ImageIcon />
    </Button>

    <Button
      variant={isLoading ? "secondary" : "default"}
      size="icon-xs"
      onClick={isLoading ? handleStop : handleSubmit}
      disabled={!isLoading && !input.trim() && attachedImagesCount === 0}
      className="rounded-full"
      aria-label={isLoading ? "Stop generation" : "Submit prompt"}
    >
      <IconSwap
        state={isLoading ? "b" : "a"}
        iconA={<ArrowUpIcon strokeWidth={2.5} />}
        iconB={<Loader2Icon className="animate-spin" />}
      />
    </Button>
  </div>
);
