"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Tabs = ({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) => (
  <TabsPrimitive.Root
    data-slot="tabs"
    data-orientation={orientation}
    className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
    {...props}
  />
);

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center overflow-clip text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-1.5 rounded-[10px] bg-secondary p-px",
        outline: "gap-1.5 rounded-[10px] bg-secondary p-px",
        underline: "gap-1 border-b border-border bg-transparent",
      },
      size: {
        md: "group-data-horizontal/tabs:h-[30px]",
        sm: "group-data-horizontal/tabs:h-[26px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export const TabsList = ({
  className,
  variant = "default",
  size = "md",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    data-variant={variant}
    data-size={size}
    className={cn(tabsListVariants({ variant, size }), className)}
    {...props}
  />
);

const tabsTriggerVariants = cva(
  [
    "relative z-10 gap-1.5 border border-transparent",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    "text-muted-foreground hover:text-foreground",
    "inline-flex flex-1 items-center justify-center whitespace-nowrap transition-colors",
    "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "data-active:text-foreground",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "rounded-[9px]",
        outline: "rounded-[9px] border-border",
        underline: [
          "rounded-none bg-transparent border-b-2 border-transparent",
          "data-active:border-b-foreground",
        ].join(" "),
      },
      size: {
        md: "h-[28px] px-2.5 py-1.5 text-sm",
        sm: "h-[22px] px-2 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

interface TabsTriggerProps
  extends TabsPrimitive.Tab.Props, VariantProps<typeof tabsTriggerVariants> {
  prefixIcon?: ReactNode;
  badge?: ReactNode;
}

export const TabsTrigger = ({
  className,
  variant,
  size,
  prefixIcon,
  badge,
  children,
  ...props
}: TabsTriggerProps) => (
  <TabsPrimitive.Tab
    data-slot="tabs-trigger"
    className={cn(tabsTriggerVariants({ variant, size }), className)}
    {...props}
  >
    {prefixIcon && <span className="shrink-0">{prefixIcon}</span>}
    {children}
    {badge !== undefined && (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          size === "sm" ? "h-4 min-w-4 px-1 text-[10px]" : "h-5 min-w-5 px-1.5 text-[14px]",
        )}
      >
        {badge}
      </span>
    )}
  </TabsPrimitive.Tab>
);

const tabsIndicatorVariants = cva(
  [
    "absolute transition-all duration-300 ease-in-out",
    "top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width)",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "z-0 rounded-[9px] bg-primary-foreground text-foreground shadow-[0px_0px_1.5px_0px_rgba(0,0,0,0.16),0px_2px_5px_0px_rgba(0,0,0,0.14)]",
        outline:
          "z-0 rounded-[9px] bg-primary-foreground text-foreground shadow-[0px_0px_1.5px_0px_rgba(0,0,0,0.16),0px_2px_5px_0px_rgba(0,0,0,0.14)]",
        underline: "bottom-0 z-0 h-0.5 rounded-full bg-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const TabsIndicator = ({
  className,
  variant,
  ...props
}: TabsPrimitive.Indicator.Props & VariantProps<typeof tabsIndicatorVariants>) => (
  <TabsPrimitive.Indicator
    data-slot="tabs-indicator"
    className={cn(tabsIndicatorVariants({ variant }), className)}
    {...props}
  />
);

export const TabsContent = ({ className, ...props }: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel
    data-slot="tabs-content"
    className={cn("flex-1 text-sm outline-none", className)}
    {...props}
  />
);

export { tabsListVariants, tabsTriggerVariants, tabsIndicatorVariants };
