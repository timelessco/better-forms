import * as React from "react";
import { Command as CommandPrimitive } from "cmdk-base";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckIcon, CornerDownLeftIcon } from "@/components/ui/icons";
import { FigSearchAltIcon, FigSortIcon } from "@/components/dashboard/dashboard-icons";

export const Command = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    data-slot="command"
    className={cn(
      "flex size-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
);

export const CommandDialog = ({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) => (
  <Dialog {...props}>
    <DialogHeader className="sr-only">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    <DialogContent
      className={cn(
        "top-[19.5%] translate-y-0 overflow-hidden rounded-4xl p-0 sm:max-w-[600px]",
        className,
      )}
      showCloseButton={showCloseButton}
    >
      {children}
    </DialogContent>
  </Dialog>
);

// Figma 26612:40173 — gray/100 field, 32px tall, search icon on the RIGHT, placeholder gray/550.
export const CommandInput = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) => (
  <div data-slot="command-input-wrapper" className="px-3 pt-3">
    <div className="flex h-8 w-full items-center gap-3 overflow-hidden rounded-[8px] bg-secondary px-2.5">
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "placeholder:text-gray-550 min-w-0 flex-1 border-0 bg-transparent p-0 text-base tracking-[0.28px] text-foreground outline-none placeholder:font-[420] placeholder:tracking-[0.28px] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <FigSearchAltIcon className="size-4 shrink-0 text-muted-foreground" />
    </div>
  </div>
);

// 18px between sections (modal gap), 12px side / bottom padding (modal padding).
export const CommandList = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    data-slot="command-list"
    className={cn(
      // cmdk nests the groups inside [cmdk-list-sizer]; the flex+gap must live there, not on the list.
      "no-scrollbar max-h-80 scroll-py-1 overflow-x-hidden overflow-y-auto px-3 pt-[18px] pb-3 outline-none [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col [&_[cmdk-list-sizer]]:gap-[18px]",
      className,
    )}
    {...props}
  />
);

export const CommandEmpty = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    data-slot="command-empty"
    className={cn("py-6 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
);

// Group = heading (Regular 420 / 14px / gray-600 / 0.28px) + items, 8px apart.
export const CommandGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    data-slot="command-group"
    className={cn(
      "flex flex-col gap-2 overflow-hidden text-foreground **:[[cmdk-group-heading]]:px-0 **:[[cmdk-group-heading]]:py-0 **:[[cmdk-group-heading]]:text-base **:[[cmdk-group-heading]]:font-[420] **:[[cmdk-group-heading]]:tracking-[0.28px] **:[[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export const CommandSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    data-slot="command-separator"
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
);

// Figma 26612:40177 — 34px row (py 9 + 16px content), icon 16 + 8px gap + Medium 450 / 14px / gray-700
// label; selected/hover = gray/100 fill, 8px radius. Right-aligned meta via CommandShortcut.
export const CommandItem = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    data-slot="command-item"
    className={cn(
      "group/command-item relative flex cursor-default items-center gap-2 rounded-[8px] px-1.5 py-[9px] text-base font-[450] tracking-[0.21px] text-gray-700 outline-hidden select-none hover:bg-secondary data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-secondary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  >
    {children}
    <CheckIcon className="ms-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
  </CommandPrimitive.Item>
);

// Right-aligned cell meta (e.g. response counts) — Regular 420 / 13px / gray-600 / 0.26px (Figma 26621:15599).
export const CommandShortcut = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    data-slot="command-shortcut"
    className={cn("ms-auto text-sm font-[420] tracking-[0.26px] text-muted-foreground", className)}
    {...props}
  />
);

// Figma 26612:40218 — footer bar: Select / Open hints (left), Actions ⌘K (right). Border-top gray/200.
export const CommandFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="command-footer"
    className={cn("flex items-center gap-4 border-t border-gray-200 px-2.5 py-1.5", className)}
    {...props}
  >
    <div className="flex flex-1 items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-[420] tracking-[0.24px] text-muted-foreground">
        <FigSortIcon className="size-3 shrink-0" />
        Select
      </span>
      <span className="flex items-center gap-1 text-xs font-[420] tracking-[0.24px] text-muted-foreground">
        <CornerDownLeftIcon className="size-3 shrink-0" />
        Open
      </span>
    </div>
    <span className="flex items-center gap-1.5 text-xs font-[420] tracking-[0.24px] text-muted-foreground">
      Actions
      <span className="flex items-center gap-0.5">
        <kbd className="flex size-4 items-center justify-center rounded-[4px] bg-gray-300 text-[10px] leading-none text-muted-foreground">
          ⌘
        </kbd>
        <kbd className="flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-gray-300 px-1 text-[9px] leading-none text-muted-foreground">
          K
        </kbd>
      </span>
    </span>
  </div>
);
