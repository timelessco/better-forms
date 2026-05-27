import type { ReactNode } from "react";
import { useRef } from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

interface TextSwapProps {
  children: ReactNode;
  className?: string;
}

/**
 * Swaps text in place; new value enters from below w/ blur. Key on the text so each value remounts: `<TextSwap key={status}>`.
 * See `.t-text-swap` in `src/styles/transitions.css`.
 */
export const TextSwap = ({ children, className }: TextSwapProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useMountEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Jump to "below + blurred" start, force reflow, release so it transitions up to rest.
    el.classList.add("is-enter-start");
    void el.offsetHeight;
    el.classList.remove("is-enter-start");
  });

  return (
    <span ref={ref} className={cn("t-text-swap", className)}>
      {children}
    </span>
  );
};
