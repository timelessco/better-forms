"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

// Default hover delay — high enough to avoid flicker on incidental hovers, low enough to feel
// responsive on a deliberate pause. Override per-tooltip via `delay`.
const DEFAULT_TOOLTIP_DELAY_MS = 400;

export const TooltipProvider = ({
  delay = DEFAULT_TOOLTIP_DELAY_MS,
  ...props
}: TooltipPrimitive.Provider.Props) => (
  <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
);

export const Tooltip = ({ ...props }: TooltipPrimitive.Root.Props) => (
  <TooltipPrimitive.Root data-slot="tooltip" {...props} />
);

export const TooltipTrigger = ({ render, ...props }: TooltipPrimitive.Trigger.Props) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" render={render} {...props} />
);

export const TooltipContent = ({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <TooltipPrimitive.Popup
        data-slot="tooltip-content"
        className={cn(
          // Compact, minimal, theme-matched: same surface as popovers/dropdowns (white in light, dark
          // surface in dark) + a hairline border and soft shadow. No arrow — a clean floating pill.
          "z-50 w-fit max-w-xs origin-(--transform-origin) rounded-lg border border-border bg-popover px-2.5 py-1 text-sm leading-normal text-popover-foreground elevation-base duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:duration-75 data-closed:fade-out-0",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
);
