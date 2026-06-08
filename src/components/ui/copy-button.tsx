"use client";

import { CheckIcon, CircleXIcon, CopyIcon } from "@/components/ui/icons";
import type { HTMLMotionProps, Variants } from "motion/react";
import { AnimatePresence, domMax, LazyMotion, m } from "motion/react";
import { useCallback } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { TextSwap } from "@/components/transitions/text-swap";
import type { CopyState } from "@/hooks/use-copy-to-clipboard";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

export const motionIconVariants: Variants = {
  initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
};

export const motionIconProps: HTMLMotionProps<"span"> = {
  variants: motionIconVariants,
  initial: "initial",
  animate: "animate",
  exit: "exit",
  transition: { type: "spring", duration: 0.25, bounce: 0 },
};

export const CopyStateIcon = ({
  state,
  className: _className,
}: {
  state: CopyState;
  className?: string;
}) => (
  <LazyMotion features={domMax} strict>
    <AnimatePresence mode="popLayout" initial={false}>
      {state === "idle" ? (
        <m.span key="idle" {...motionIconProps}>
          <CopyIcon className="size-3.25" />
        </m.span>
      ) : state === "done" ? (
        <m.span key="done" {...motionIconProps}>
          <CheckIcon strokeWidth={3} className="size-3.25" />
        </m.span>
      ) : state === "error" ? (
        <m.span key="error" {...motionIconProps}>
          <CircleXIcon className="size-3.25" />
        </m.span>
      ) : null}
    </AnimatePresence>
  </LazyMotion>
);

export type CopyButtonProps = ComponentProps<typeof Button> & {
  /** The text to copy, or a function that returns the text. */
  text: string | (() => string);
  /** Called with the copied text on successful copy. */
  onCopySuccess?: (text: string) => void;
  /** Called with the error if the copy operation fails. */
  onCopyError?: (error: Error) => void;
};

type CopyButtonClickEvent = Parameters<NonNullable<ComponentProps<typeof Button>["onClick"]>>[0];

export const CopyButton = ({
  size = "icon",
  children,
  text,
  onCopySuccess,
  onCopyError,
  onClick,
  ...props
}: CopyButtonProps) => {
  const { state, copy } = useCopyToClipboard({
    onCopySuccess,
    onCopyError,
  });

  const copyText = useCallback(
    (e: CopyButtonClickEvent) => {
      void copy(text);
      onClick?.(e);
    },
    [copy, text, onClick],
  );

  return (
    <Button
      size={size}
      onClick={copyText}
      prefix={<CopyStateIcon state={state} className="size-3.25" />}
      aria-label="Copy"
      {...props}
    >
      {/* Swap the label to "Copied"/"Failed" while active, reverting on idle. Icon-only
          buttons (no children) keep just the icon swap. */}
      {children != null && (
        <TextSwap key={state}>
          {state === "done" ? "Copied" : state === "error" ? "Failed" : children}
        </TextSwap>
      )}
    </Button>
  );
};
