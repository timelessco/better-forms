import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";

import { cn } from "@/lib/utils";

export const Collapsible = ({ className, ...props }: CollapsiblePrimitive.Root.Props) => (
  <CollapsiblePrimitive.Root
    data-slot="collapsible"
    className={cn("contents", className)}
    {...props}
  />
);

export const CollapsibleTrigger = ({ className, ...props }: CollapsiblePrimitive.Trigger.Props) => (
  <CollapsiblePrimitive.Trigger
    data-slot="collapsible-trigger"
    type="button"
    className={cn(
      "aria-disclosure-button w-full cursor-pointer outline-hidden hover:bg-(--color-gray-alpha-100) hover:text-foreground focus-visible:ring-1 focus-visible:ring-gray-200",
      className,
    )}
    {...props}
  />
);

export const CollapsibleContent = ({ className, ...props }: CollapsiblePrimitive.Panel.Props) => (
  <CollapsiblePrimitive.Panel
    data-slot="collapsible-content"
    keepMounted
    className={cn(
      "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
);
