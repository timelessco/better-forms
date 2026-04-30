import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";

export const Accordion = ({ className, ...props }: AccordionPrimitive.Root.Props) => (
  <AccordionPrimitive.Root
    data-slot="accordion"
    className={cn("flex w-full flex-col", className)}
    {...props}
  />
);

export const AccordionItem = ({ className, ...props }: AccordionPrimitive.Item.Props) => (
  <AccordionPrimitive.Item
    data-slot="accordion-item"
    className={cn("not-last:border-b", className)}
    {...props}
  />
);

interface AccordionTriggerProps extends AccordionPrimitive.Trigger.Props {
  /** Position of the chevron icon relative to the label.
   *  - "inline": chevron sits right after the label text (sidebar style)
   *  - "end": chevron is pushed to the far right (default / FAQ style) */
  iconPosition?: "inline" | "end";
  /** Optional action slot rendered on the far right (visible on hover). */
  action?: ReactNode;
}

export const AccordionTrigger = ({
  className,
  children,
  iconPosition = "end",
  action,
  ...props
}: AccordionTriggerProps) => {
  const isInline = iconPosition === "inline";

  return (
    <AccordionPrimitive.Header className="group/accordion-header flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        data-icon-position={iconPosition}
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-center border border-transparent transition-all outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-disabled:pointer-events-none aria-disabled:opacity-50",
          isInline
            ? "gap-1 rounded-lg py-1.5 text-start text-[13px]"
            : "justify-between rounded-lg py-2.5 text-start text-sm hover:underline",
          className,
        )}
        {...props}
      >
        {isInline ? (
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {children}
            <ChevronDownIcon
              data-slot="accordion-trigger-icon"
              className="size-2.5 shrink-0 -rotate-90 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:-rotate-0"
            />
          </span>
        ) : (
          <>
            {children}
            <ChevronDownIcon
              data-slot="accordion-trigger-icon"
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180"
            />
          </>
        )}
      </AccordionPrimitive.Trigger>
      {action && (
        <div className="mr-[0.55px] flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/accordion-header:opacity-100">
          {action}
        </div>
      )}
    </AccordionPrimitive.Header>
  );
};

export const AccordionContent = ({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) => (
  <AccordionPrimitive.Panel
    data-slot="accordion-content"
    className="h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-300 ease-in-out data-ending-style:h-0 data-starting-style:h-0"
    {...props}
  >
    <div
      className={cn(
        "pt-0 pb-2.5 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className,
      )}
    >
      {children}
    </div>
  </AccordionPrimitive.Panel>
);
