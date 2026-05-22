import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

/**
 * Scopes any descendant `PopoverContent` (and components built on top of it,
 * like DatePicker / MultiSelect) to a specific container — used in embed
 * preview so popups portal into the embed frame and collision-detect against
 * its bounds instead of escaping to `document.body` + the viewport.
 *
 * `null` (the default) means "portal to body, use viewport for collisions".
 */
export const PopoverContainerContext = React.createContext<HTMLElement | null>(null);

export const Popover = ({ ...props }: PopoverPrimitive.Root.Props) => (
  <PopoverPrimitive.Root data-slot="popover" {...props} />
);

export const PopoverTrigger = ({ render, ...props }: PopoverPrimitive.Trigger.Props) => (
  <PopoverPrimitive.Trigger data-slot="popover-trigger" render={render} {...props} />
);

export const PopoverAnchor = ({
  render,
  virtualRef,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  render?: React.ReactElement;
  virtualRef?: React.RefObject<{ current: HTMLElement | null }>;
}) => {
  if (virtualRef) {
    return (
      <PopoverPrimitive.Positioner
        data-slot="popover-anchor"
        // eslint-disable-next-line typescript-eslint/no-explicit-any
        anchor={virtualRef as any}
        className={cn("sr-only", className)}
        {...props}
      >
        {children}
      </PopoverPrimitive.Positioner>
    );
  }
  if (render) {
    return (
      <div data-slot="popover-anchor" className={cn(className)} {...props}>
        {render}
        {children}
      </div>
    );
  }
  return (
    <div data-slot="popover-anchor" className={cn(className)} {...props}>
      {children}
    </div>
  );
};

export const PopoverContent = ({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  anchor,
  keepMounted = false,
  container: containerProp,
  collisionBoundary: collisionBoundaryProp,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "collisionBoundary"
  > & {
    keepMounted?: boolean;
    container?: PopoverPrimitive.Portal.Props["container"];
  }) => {
  const scopedContainer = React.use(PopoverContainerContext);
  const container = containerProp ?? scopedContainer ?? undefined;
  const collisionBoundary = collisionBoundaryProp ?? scopedContainer ?? undefined;
  return (
    <PopoverPrimitive.Portal keepMounted={keepMounted} container={container}>
      <PopoverPrimitive.Positioner
        anchor={anchor}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionBoundary={collisionBoundary}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-1 rounded-xl bg-popover p-1 font-case text-sm text-popover-foreground elevation-lg outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
};

export const PopoverHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="popover-header"
    className={cn("flex flex-col gap-0.5 text-base", className)}
    {...props}
  />
);

export const PopoverTitle = ({ className, ...props }: PopoverPrimitive.Title.Props) => (
  <PopoverPrimitive.Title
    data-slot="popover-title"
    className={cn("text-base", className)}
    {...props}
  />
);

export const PopoverDescription = ({ className, ...props }: PopoverPrimitive.Description.Props) => (
  <PopoverPrimitive.Description
    data-slot="popover-description"
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
);
