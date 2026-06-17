import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CaretDownIcon } from "@/components/ui/icons";
import { createContext, use, useState } from "react";

const SECTION_VALUE = "section";

/**
 * Counter that re-keys SidebarSection's Accordion. PersistentSidebars bumps it on each
 * hidden→visible transition, so reopening resets sections to initialOpen while form state and
 * scroll (above this Accordion) survive. Default 0 — uses outside this provider never re-key.
 */
const SidebarSectionResetContext = createContext(0);
export const SidebarSectionResetProvider = SidebarSectionResetContext.Provider;

// Figma system-flat header label scale; shared by both variants.
// Figma section header (node 25424-12009): Inter Medium 13px, 0.13px tracking, gray/500 (#999).
const HEADER_LABEL_CLS =
  "truncate text-[13px] leading-[1.15] font-medium tracking-[0.13px] text-gray-500";

interface SidebarSectionProps {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /**
   * `true` (default): collapsible Accordion, always-visible caret (back-compat).
   * `false`: flat static header + divider.
   * `"flat"`: flat header + divider, collapsible with a hover-only caret (Figma system-flat).
   */
  collapsible?: boolean | "flat";
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

  if (collapsible === "flat") {
    // key={resetKey} remounts on sidebar reopen → sections reset to initialOpen (all open).
    return (
      <FlatCollapsibleSection
        key={resetKey}
        label={label}
        action={action}
        headerRight={headerRight}
        divider={divider}
        initialOpen={initialOpen}
        className={className}
      >
        {children}
      </FlatCollapsibleSection>
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

// Flat header (Figma system-flat) that collapses on click; the 10px caret reveals on hover only
// and points right when collapsed (node 25424-12987). Open by default.
const FlatCollapsibleSection = ({
  label,
  children,
  action,
  headerRight,
  divider = true,
  initialOpen = true,
  className,
}: Pick<
  SidebarSectionProps,
  "label" | "children" | "action" | "headerRight" | "divider" | "initialOpen" | "className"
>) => {
  const [open, setOpen] = useState(initialOpen);
  // Figma divider frame (node 25424-12791) = 8px tall, hairline centered → 4px above/below the line.
  // Paired with the parent's 16px section gap, the line lands 20px from content and 20px from the next header.
  return (
    <div className={cn("flex flex-col gap-4 pb-5", divider && "border-b border-border")}>
      <div className="flex min-h-[15px] items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="group/sec flex flex-1 cursor-pointer items-center gap-0.5 text-left"
        >
          <span className={HEADER_LABEL_CLS}>{label}</span>
          <CaretDownIcon
            aria-hidden
            className={cn(
              "size-2.5 shrink-0 text-gray-500 opacity-0 transition-[opacity,transform] group-hover/sec:opacity-100",
              !open && "-rotate-90",
            )}
          />
        </button>
        {headerRight}
        {action}
      </div>
      {open && <div className={cn("flex flex-col gap-2", className)}>{children}</div>}
    </div>
  );
};
