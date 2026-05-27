import { Button } from "@/components/ui/button";
import { MoreHorizontalIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createContext, use } from "react";

const SECTION_VALUE = "section";

/**
 * Counter that re-keys SidebarSection's Accordion. PersistentSidebars bumps it on each
 * hidden→visible transition, so reopening resets sections to initialOpen while form state and
 * scroll (above this Accordion) survive. Default 0 — uses outside this provider never re-key.
 */
const SidebarSectionResetContext = createContext(0);
export const SidebarSectionResetProvider = SidebarSectionResetContext.Provider;

const DEFAULT_ACTION = (
  <Button
    variant="ghost"
    className="hover:bg-sidebar-active size-[26px] overflow-hidden rounded-lg p-[5px] text-muted-foreground hover:text-foreground"
    aria-label="Section actions"
  >
    <MoreHorizontalIcon className="size-4" />
  </Button>
);

/** Collapsible sidebar section with label, chevron, and optional action (Figma system-flat). */
export const SidebarSection = ({
  label,
  children,
  action,
  initialOpen = true,
  className,
  panelClassName,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  initialOpen?: boolean;
  className?: string;
  /** Additional classes for the accordion Panel itself (use to allow popups to escape). */
  panelClassName?: string;
}) => {
  const resetKey = use(SidebarSectionResetContext);

  return (
    <Accordion
      key={resetKey}
      defaultValue={initialOpen ? [SECTION_VALUE] : []}
      className="flex flex-col"
    >
      <AccordionItem value={SECTION_VALUE} className="border-none">
        <AccordionTrigger
          iconPosition="inline"
          action={action ?? DEFAULT_ACTION}
          className="ml-[0.55px] h-7.5 cursor-pointer overflow-hidden rounded-lg px-1 py-1.5"
        >
          <span className="truncate font-case text-[13px] font-medium tracking-4 text-muted-foreground">
            {label}
          </span>
        </AccordionTrigger>
        <AccordionContent
          className={cn("flex flex-col", className)}
          panelClassName={panelClassName}
        >
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
