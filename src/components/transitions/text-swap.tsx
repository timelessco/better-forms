import type { ReactNode } from "react";
import { useRef } from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import { cn } from "@/lib/utils";

interface TextSwapProps {
  children: ReactNode;
  className?: string;
}

/**
 * Swaps text in place — the new value enters from below with a blur. Drive it
 * with a `key` that changes when the text changes so each new value remounts
 * and re-enters:
 *
 *   <TextSwap key={status}>{status}</TextSwap>
 *
 * See `.t-text-swap` in `src/styles/transitions.css`.
 */
export const TextSwap = ({ children, className }: TextSwapProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  useMountEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Jump to the "below + blurred" start, force a reflow, then release so
    // the element transitions up to its resting position.
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
