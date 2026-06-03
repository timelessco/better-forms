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

// Figma system-flat header label scale; shared by both variants.
const HEADER_LABEL_CLS = "truncate text-[13px] font-medium tracking-[0.13px] text-muted-foreground";

interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Collapsible Accordion (chevron caret, reset-key) vs flat header + divider. Default collapsible (back-compat). */
  collapsible?: boolean;
  /** Right-aligned header slot (e.g. Typography "Title"/Colors "Light" scope selects). */
  headerRight?: React.ReactNode;
  /** Bottom border divider in the flat variant. Default true. */
  divider?: boolean;
  initialOpen?: boolean;
  className?: string;
  /** Additional classes for the accordion Panel itself (use to allow popups to escape). */
  panelClassName?: string;
}

/** Sidebar section: collapsible Accordion by default, or flat (plain header + divider) via collapsible={false} (Figma system-flat). */
export const SidebarSection = ({
  label,
  children,
  action,
  collapsible = true,
  headerRight,
  divider = true,
  initialOpen = true,
  className,
  panelClassName,
}: SidebarSectionProps) => {
  // Hook must run unconditionally; only the collapsible path re-keys off it.
  const resetKey = use(SidebarSectionResetContext);

  if (!collapsible) {
    // Figma rhythm: 16px header→rows, 8px between rows, 16px pad + divider below.
    return (
      <div className={cn("flex flex-col gap-4 pb-4", divider && "border-b border-border")}>
        <div className="flex min-h-[15px] items-center gap-3">
          <span className={cn("flex-1", HEADER_LABEL_CLS)}>{label}</span>
          {headerRight}
          {action}
        </div>
        <div className={cn("flex flex-col gap-2", className)}>{children}</div>
      </div>
    );
  }

  return (
    <Accordion
      key={resetKey}
      defaultValue={initialOpen ? [SECTION_VALUE] : []}
      className="flex flex-col"
    >
      <AccordionItem value={SECTION_VALUE} className="border-none">
        <AccordionTrigger
          iconPosition="inline"
          action={headerRight ?? action}
          className="ml-[0.55px] h-7.5 cursor-pointer overflow-hidden rounded-lg px-1 py-1.5"
        >
          <span className={cn("font-case tracking-4", HEADER_LABEL_CLS)}>{label}</span>
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
