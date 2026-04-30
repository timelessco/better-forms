import {
  PreviewImage,
  useImagePreview,
  useImagePreviewValue,
  useScaleInput,
} from "@platejs/media/react";
import { cva } from "class-variance-authority";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "@/components/ui/icons";
import { useEditorRef } from "platejs/react";
import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const buttonVariants = cva("rounded bg-[rgba(0,0,0,0.5)] px-1", {
  defaultVariants: {
    variant: "default",
  },
  variants: {
    variant: {
      default: "text-white",
      disabled: "cursor-not-allowed text-gray-400",
    },
  },
});

const SCROLL_SPEED = 4;

export const MediaPreviewDialog = () => {
  const editor = useEditorRef();
  const isOpen = useImagePreviewValue("isOpen", editor.id);
  const scale = useImagePreviewValue("scale");
  const isEditingScale = useImagePreviewValue("isEditingScale");
  const {
    closeProps,
    currentUrlIndex,
    maskLayerProps,
    nextDisabled,
    nextProps,
    prevDisabled,
    prevProps,
    scaleTextProps,
    zommOutProps,
    zoomInDisabled,
    zoomInProps,
    zoomOutDisabled,
  } = useImagePreview({ scrollSpeed: SCROLL_SPEED });

  const previewMaskRef = React.useRef<HTMLDivElement | null>(null);

  useMountEffect(() => {
    const node = previewMaskRef.current;
    if (!node) return;

    const stopContextMenu = (event: MouseEvent) => {
      event.stopPropagation();
    };

    node.addEventListener("contextmenu", stopContextMenu);
    return () => {
      node.removeEventListener("contextmenu", stopContextMenu);
    };
  });

  return (
    <div
      ref={previewMaskRef}
      className={cn(
        "fixed top-0 left-0 z-50 h-screen w-screen overscroll-contain select-none",
        !isOpen && "hidden",
      )}
    >
      <div className="absolute inset-0 size-full bg-black opacity-30" />
      <div className="absolute inset-0 size-full bg-black opacity-30" />
      <Button
        variant="ghost"
        {...maskLayerProps}
        className="absolute inset-0 z-10 h-auto rounded-none bg-transparent hover:bg-transparent"
        aria-label="Close media preview"
      >
        <span className="sr-only">Close preview</span>
      </Button>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex max-h-screen w-full items-center">
          <PreviewImage
            className={cn(
              "mx-auto block max-h-[calc(100vh-4rem)] w-auto object-contain transition-transform",
            )}
          />
          <section
            className="absolute bottom-0 left-1/2 z-40 flex w-fit -translate-x-1/2 justify-center gap-4 p-2 text-center text-white"
            aria-label="Media preview controls"
          >
            <div className="flex gap-1">
              <Button
                variant="ghost"
                {...prevProps}
                className={cn(
                  buttonVariants({
                    variant: prevDisabled ? "disabled" : "default",
                  }),
                  "h-auto",
                )}
                aria-label="Previous image"
              >
                <ArrowLeftIcon />
              </Button>
              {(currentUrlIndex ?? 0) + 1}
              <Button
                variant="ghost"
                {...nextProps}
                className={cn(
                  buttonVariants({
                    variant: nextDisabled ? "disabled" : "default",
                  }),
                  "h-auto",
                )}
                aria-label="Next image"
              >
                <ArrowRightIcon />
              </Button>
            </div>
            <div className="flex">
              <Button
                variant="ghost"
                className={cn(
                  buttonVariants({
                    variant: zoomOutDisabled ? "disabled" : "default",
                  }),
                  "h-auto",
                )}
                aria-label="Zoom out"
                {...zommOutProps}
              >
                <MinusIcon className="size-4" />
              </Button>
              <div className="mx-px">
                {isEditingScale ? (
                  <>
                    <ScaleInput
                      className="w-10 rounded px-1 text-slate-500 outline"
                      aria-label="Zoom level"
                    />
                    <span>%</span>
                  </>
                ) : (
                  <span {...scaleTextProps}>{`${scale * 100}%`}</span>
                )}
              </div>
              <Button
                variant="ghost"
                className={cn(
                  buttonVariants({
                    variant: zoomInDisabled ? "disabled" : "default",
                  }),
                  "h-auto",
                )}
                aria-label="Zoom in"
                {...zoomInProps}
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
            {/* TODO: downLoad the image */}
            <Button
              variant="ghost"
              className={cn(buttonVariants(), "h-auto")}
              aria-label="Download"
            >
              <DownloadIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              {...closeProps}
              className={cn(buttonVariants(), "h-auto")}
              aria-label="Close preview"
            >
              <XIcon className="size-4" />
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
};

const ScaleInput = (props: React.ComponentProps<"input">) => {
  const { props: scaleInputProps, ref } = useScaleInput();

  return <input {...scaleInputProps} {...props} ref={ref} />;
};
