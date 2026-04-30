"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ChevronDownIcon, XIcon, CheckIcon } from "@/components/ui/icons";

const Combobox = ComboboxPrimitive.Root;

export const ComboboxValue = ({ ...props }: ComboboxPrimitive.Value.Props) => (
  <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
);

export const ComboboxTrigger = ({
  className,
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props) => (
  <ComboboxPrimitive.Trigger
    data-slot="combobox-trigger"
    className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
    {...props}
  >
    {children}
    <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
  </ComboboxPrimitive.Trigger>
);

const ComboboxClear = ({ className, ...props }: ComboboxPrimitive.Clear.Props) => (
  <ComboboxPrimitive.Clear
    data-slot="combobox-clear"
    render={<InputGroupButton variant="ghost" size="icon-xs" />}
    className={cn(className)}
    {...props}
  >
    <XIcon className="pointer-events-none" />
  </ComboboxPrimitive.Clear>
);

export const ComboboxInput = ({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean;
  showClear?: boolean;
}) => (
  <InputGroup
    className={cn(
      "placeholder:text-gray-alpha-600 w-auto min-w-[80px] flex-1 rounded-xl bg-accent px-2.5 py-1.75 text-base outline-none",
      className,
    )}
  >
    <ComboboxPrimitive.Input
      render={
        <InputGroupInput
          disabled={disabled}
          className="placeholder:text-gray-alpha-600 min-w-[80px] outline-none"
        />
      }
      {...props}
    />
    <InputGroupAddon align="inline-end">
      {showTrigger && (
        <InputGroupButton
          size="icon-xs"
          variant="ghost"
          render={<ComboboxTrigger />}
          data-slot="input-group-button"
          className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
          disabled={disabled}
        />
      )}
      {showClear && <ComboboxClear disabled={disabled} />}
    </InputGroupAddon>
    {children}
  </InputGroup>
);

export const ComboboxContent = ({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) => (
  <ComboboxPrimitive.Portal>
    <ComboboxPrimitive.Positioner
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      anchor={anchor}
      className="isolate z-50 select-none"
    >
      <ComboboxPrimitive.Popup
        data-slot="combobox-content"
        data-chips={!!anchor}
        className={cn(
          "w-(--anchor-width) origin-(--transform-origin) rounded-2xl bg-popover text-popover-foreground shadow-[0_0_1px_0_rgba(0,0,0,0.19),0_1px_2px_0_rgba(0,0,0,0.07),0_6px_15px_-5px_rgba(0,0,0,0.11)] ring-1 ring-foreground/10 transition-[scale,opacity,shadow] data-starting-style:scale-98 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      />
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
);

export const ComboboxList = ({ className, ...props }: ComboboxPrimitive.List.Props) => (
  <ComboboxPrimitive.List
    data-slot="combobox-list"
    className={cn("flex flex-col gap-1 p-1 empty:hidden", className)}
    {...props}
  />
);

export const ComboboxItem = ({ className, children, ...props }: ComboboxPrimitive.Item.Props) => (
  <ComboboxPrimitive.Item
    data-slot="combobox-item"
    className={cn(
      "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-[5px] font-case text-[13px] text-foreground transition-colors select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  >
    {children}
    <ComboboxPrimitive.ItemIndicator
      keepMounted
      render={
        <span className="text-plain data-selected:text-plain ml-auto flex size-4 shrink-0 items-center justify-center opacity-0 data-selected:opacity-100" />
      }
    >
      <CheckIcon className="pointer-events-none text-gray-800" />
    </ComboboxPrimitive.ItemIndicator>
  </ComboboxPrimitive.Item>
);

export const ComboboxGroup = ({ className, ...props }: ComboboxPrimitive.Group.Props) => (
  <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />
);

export const ComboboxLabel = ({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) => (
  <ComboboxPrimitive.GroupLabel
    data-slot="combobox-label"
    className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
    {...props}
  />
);

export const ComboboxCollection = ({ ...props }: ComboboxPrimitive.Collection.Props) => (
  <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
);

export const ComboboxEmpty = ({ className, ...props }: ComboboxPrimitive.Empty.Props) => (
  <ComboboxPrimitive.Empty
    data-slot="combobox-empty"
    className={cn(
      "text-13 hidden w-full justify-center px-2 py-[5px] text-gray-500 group-data-empty/combobox-content:flex",
      className,
    )}
    {...props}
  />
);

export const ComboboxSeparator = ({ className, ...props }: ComboboxPrimitive.Separator.Props) => (
  <ComboboxPrimitive.Separator
    data-slot="combobox-separator"
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}
  />
);

export const ComboboxChips = ({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props) => (
  <ComboboxPrimitive.Chips
    data-slot="combobox-chips"
    className={cn(
      "bg-gray-alpha-100 relative flex min-h-[30px] w-full flex-wrap items-center gap-1 rounded-lg px-[3px] py-[3px] focus-within:ring-2 focus-within:ring-gray-200",
      className,
    )}
    {...props}
  />
);

export const ComboboxChip = ({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
}) => (
  <ComboboxPrimitive.Chip
    data-slot="combobox-chip"
    className={cn(
      "font-450 flex cursor-pointer items-center gap-1.5 rounded-[6px] bg-gray-100 px-2 py-[4.5px] text-xs text-gray-800 transition-colors outline-none hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-200 has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pe-0",
      className,
    )}
    {...props}
  >
    {children}
    {showRemove && (
      <ComboboxPrimitive.ChipRemove
        render={<Button variant="ghost" size="icon-xs" />}
        className="-ms-1 opacity-50 hover:opacity-100"
        data-slot="combobox-chip-remove"
      >
        <XIcon className="pointer-events-none" />
      </ComboboxPrimitive.ChipRemove>
    )}
  </ComboboxPrimitive.Chip>
);

export const ComboboxChipsInput = ({ className, ...props }: ComboboxPrimitive.Input.Props) => (
  <ComboboxPrimitive.Input
    data-slot="combobox-chip-input"
    className={cn(
      "text-13 placeholder:text-gray-alpha-600 min-w-[80px] flex-1 bg-transparent px-2.5 outline-none",
      className,
    )}
    {...props}
  />
);

export const useComboboxAnchor = () => React.useRef<HTMLDivElement | null>(null);

export { Combobox };
