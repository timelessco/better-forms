import { useCallback, useRef, useState } from "react";

import { ImageIcon, Loader2Icon, SparklesIcon, XIcon } from "@/components/ui/icons";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

interface AIFormGenBubbleProps {
  onSubmit: (prompt: string, image?: { url: string; name: string } | null) => void;
  onClose: () => void;
  isGenerating: boolean;
  error?: string | null;
  selectionContext?: string | null;
  onRemoveSelection?: () => void;
}

const SELECTION_PREVIEW_MAX = 80;

export const AIFormGenBubble = ({
  onSubmit,
  onClose,
  isGenerating,
  error,
  selectionContext,
  onRemoveSelection,
}: AIFormGenBubbleProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [attachedImage, setAttachedImage] = useState<{ url: string; name: string } | null>(null);

  useMountEffect(() => {
    inputRef.current?.focus();
  });

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_FILE_SIZE) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setAttachedImage({ url: reader.result as string, name: file.name });
    });
    reader.readAsDataURL(file);
  }, []);

  const submitValue = useCallback(() => {
    const trimmed = value.trim();
    if ((trimmed || attachedImage) && !isGenerating) {
      onSubmit(trimmed || "Extract theme from this image", attachedImage);
      setAttachedImage(null);
      setValue("");
    }
  }, [value, attachedImage, isGenerating, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" || (e.key === "k" && (e.metaKey || e.ctrlKey) && e.shiftKey)) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitValue();
      }
    },
    [onClose, submitValue],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "fixed bottom-8 left-1/2 z-50 -translate-x-1/2",
        "flex max-w-[600px] min-w-[400px] flex-col gap-1",
        "rounded-xl border bg-background/80 px-4 py-2 shadow-lg backdrop-blur-sm",
      )}
    >
      {error && <p className="text-xs text-destructive">{error}</p>}
      {selectionContext && (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          <SparklesIcon className="size-3.5 shrink-0" />
          <span className="max-w-[400px] truncate">
            {selectionContext.length > SELECTION_PREVIEW_MAX
              ? `${selectionContext.slice(0, SELECTION_PREVIEW_MAX)}…`
              : selectionContext}
          </span>
          {onRemoveSelection && (
            <button
              type="button"
              onClick={onRemoveSelection}
              className="ml-0.5 rounded p-0.5 hover:bg-muted"
              aria-label="Remove selection context"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </div>
      )}
      {attachedImage && (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" />
          <span className="max-w-[150px] truncate">{attachedImage.name}</span>
          <button
            type="button"
            onClick={() => setAttachedImage(null)}
            className="ml-0.5 rounded p-0.5 hover:bg-muted"
            aria-label="Remove image"
          >
            <XIcon className="size-3" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center text-muted-foreground">
          {isGenerating ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
        </div>

        <input
          ref={inputRef}
          id="ai-form-gen-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder="Describe the form you want to generate..."
          className={cn(
            "flex-1 bg-transparent text-sm outline-none",
            "placeholder:text-muted-foreground/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label="AI form generation prompt"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isGenerating}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Attach image"
        >
          <ImageIcon className="size-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close AI form generator"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
};
