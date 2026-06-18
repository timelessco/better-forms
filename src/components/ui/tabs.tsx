"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = ({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) => (
  <TabsPrimitive.Root
    data-slot="tabs"
    data-orientation={orientation}
    className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
    {...props}
  />
);

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "overflow-hidden rounded-md bg-secondary p-px",
        line: "rounded-md bg-transparent p-px group-data-horizontal/tabs:border-b group-data-horizontal/tabs:border-border-soft group-data-vertical/tabs:border-r group-data-vertical/tabs:border-border-soft",
        ghost: "rounded-md bg-transparent p-px",
        browser:
          "gap-0 bg-transparent p-0 group-data-horizontal/tabs:border-b group-data-horizontal/tabs:border-border-soft group-data-vertical/tabs:border-r group-data-vertical/tabs:border-border-soft",
      },
      size: {
        sm: "",
        default: "",
      },
    },
    compoundVariants: [
      // sm heights
      { variant: "default", size: "sm", className: "group-data-horizontal/tabs:h-7" },
      { variant: "line", size: "sm", className: "group-data-horizontal/tabs:h-7" },
      { variant: "ghost", size: "sm", className: "group-data-horizontal/tabs:h-7" },
      { variant: "browser", size: "sm", className: "group-data-horizontal/tabs:h-7" },
      // default heights
      { variant: "default", size: "default", className: "group-data-horizontal/tabs:h-7.5" },
      { variant: "line", size: "default", className: "group-data-horizontal/tabs:h-7.5" },
      { variant: "ghost", size: "default", className: "group-data-horizontal/tabs:h-7.5" },
      { variant: "browser", size: "default", className: "group-data-horizontal/tabs:h-7.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

const TabsList = ({
  className,
  variant = "default",
  size = "sm",
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

const tabsTriggerVariants = cva([
  "leading-base relative inline-flex flex-1 items-center justify-center gap-2 rounded-[7px] text-base tracking-normal whitespace-nowrap text-accent-foreground transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  // active text color (background handled by TabsIndicator)
  "z-[1] data-active:text-foreground",
  // browser variant keeps per-tab border structure for its unique look
  "group-data-[variant=browser]/tabs-list:h-full group-data-[variant=browser]/tabs-list:border-transparent group-data-[variant=browser]/tabs-list:bg-transparent group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:-bottom-px group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:rounded-b-none! group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:border-x group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:border-t group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:-right-px group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:rounded-r-none! group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:border-y group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:border-l",
  // size sm
  "group-data-[size=sm]/tabs-list:h-6.5 group-data-[size=sm]/tabs-list:px-2 group-data-[size=sm]/tabs-list:py-1.25 group-data-[size=sm]/tabs-list:font-normal",
  // size default
  "group-data-[size=default]/tabs-list:h-7 group-data-[size=default]/tabs-list:px-2.5 group-data-[size=default]/tabs-list:py-1.5 group-data-[size=default]/tabs-list:font-medium",
]);

const TabsTrigger = ({ className, ...props }: TabsPrimitive.Tab.Props) => (
  <TabsPrimitive.Tab
    data-slot="tabs-trigger"
    className={cn(tabsTriggerVariants(), className)}
    {...props}
  />
);

const TabsIndicator = ({ className, ...props }: TabsPrimitive.Indicator.Props) => (
  <TabsPrimitive.Indicator
    data-slot="tabs-indicator"
    className={cn(
      // No transition on first mount (base-ui sets activation-direction=none) so the pill places
      // instantly instead of expanding from 0,0; only real tab switches (left/right) animate.
      "absolute rounded-[7px] transition-all duration-200 ease-out data-[activation-direction=none]:transition-none",
      // horizontal
      "group-data-horizontal/tabs:top-[var(--active-tab-top)] group-data-horizontal/tabs:left-[var(--active-tab-left)] group-data-horizontal/tabs:h-[var(--active-tab-height)] group-data-horizontal/tabs:w-[var(--active-tab-width)]",
      // vertical
      "group-data-vertical/tabs:top-[var(--active-tab-top)] group-data-vertical/tabs:left-[var(--active-tab-left)] group-data-vertical/tabs:h-[var(--active-tab-height)] group-data-vertical/tabs:w-[var(--active-tab-width)]",
      // variant-specific styling (surface / shadow-6xs tokens added to styles.css from espresso-base-ui)
      "group-data-[variant=default]/tabs-list:bg-surface group-data-[variant=default]/tabs-list:shadow-6xs",
      "group-data-[variant=ghost]/tabs-list:bg-surface group-data-[variant=ghost]/tabs-list:shadow-6xs",
      "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:shadow-none group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:top-auto group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:-bottom-px group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:h-px group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:rounded-none group-data-[variant=line]/tabs-list:group-data-horizontal/tabs:bg-foreground group-data-[variant=line]/tabs-list:group-data-vertical/tabs:right-[-1px] group-data-[variant=line]/tabs-list:group-data-vertical/tabs:left-auto group-data-[variant=line]/tabs-list:group-data-vertical/tabs:w-px group-data-[variant=line]/tabs-list:group-data-vertical/tabs:bg-foreground",
      "group-data-[variant=browser]/tabs-list:border-border group-data-[variant=browser]/tabs-list:bg-background group-data-[variant=browser]/tabs-list:shadow-none group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:rounded-b-none group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:border-x group-data-[variant=browser]/tabs-list:group-data-horizontal/tabs:border-t group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:rounded-r-none group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:border-y group-data-[variant=browser]/tabs-list:group-data-vertical/tabs:border-l",
      className,
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel
    data-slot="tabs-content"
    className={cn("flex-1 text-sm outline-none", className)}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent, tabsListVariants };

// ## Tabs Changelog (vs shadcn)
//
// ### Added
// - `TabsIndicator` component wrapping `TabsPrimitive.Indicator`, providing
//   a sliding active-tab highlight via Base UI's `--active-tab-*` CSS vars.
//   Consumers render `<TabsIndicator />` inside `<TabsList>`.
// - `size` variant on `TabsList` (`sm`, `default`) with `sm` as default.
//   shadcn has no size variants.
// - Additional `variant`s on `TabsList`: `ghost`, `browser`.
//   shadcn ships only `default` and `line`.
// - CVA compound variants on `tabsListVariants` pairing each
//   `variant` with each `size` to set appropriate heights.
// - `tabsTriggerVariants` exported as a CVA (shadcn inlines the class string
//   directly in the component).
//
// ### Changed
// - Active-tab background/highlight is owned by `TabsIndicator` instead of
//   being rendered per-trigger. This is what enables the smooth sliding
//   transition between tabs.
// - `TabsTrigger` no longer carries variant-specific `data-active:bg-*`
//   rules; it only handles active text color, leaving the visual highlight
//   to the indicator.
//
// ### Removed
// - Per-trigger `after:` pseudo-element used as the line-variant underline
//   in shadcn — the indicator now handles the line variant too.
