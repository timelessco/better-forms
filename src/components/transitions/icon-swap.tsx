import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface IconSwapProps {
  /** Which icon is currently shown. Toggling this cross-fades the two icons. */
  state: "a" | "b";
  iconA: ReactNode;
  iconB: ReactNode;
  className?: string;
}

/**
 * Cross-fades two icons in one slot (sun ↔ moon). Both stay mounted, stacked in one grid cell; `state` picks the visible one.
 * Pure CSS — see `.t-icon-swap` in `src/styles/transitions.css`.
 */
export const IconSwap = ({ state, iconA, iconB, className }: IconSwapProps) => (
  <span className={cn("t-icon-swap", className)} data-state={state}>
    <span className="t-icon" data-icon="a">
      {iconA}
    </span>
    <span className="t-icon" data-icon="b">
      {iconB}
    </span>
  </span>
);
