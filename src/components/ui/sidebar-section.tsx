import { Button } from "@/components/ui/button";
import { MoreHorizontalIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SECTION_VALUE = "section";

/** Collapsible sidebar section with label, chevron, and optional action (Figma system-flat). */
export const SidebarSection = ({
  label,
  children,
  action,
  initialOpen = true,
  className,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  initialOpen?: boolean;
  className?: string;
}) => {
  const defaultAction = (
    <Button
      variant="ghost"
      className="hover:bg-sidebar-active size-[26px] overflow-hidden rounded-lg p-[5px] text-muted-foreground hover:text-foreground"
      aria-label="Section actions"
    >
      <MoreHorizontalIcon className="size-4" />
    </Button>
  );

  return (
    <Accordion defaultValue={initialOpen ? [SECTION_VALUE] : []} className="flex flex-col">
      <AccordionItem value={SECTION_VALUE} className="border-none">
        <AccordionTrigger
          iconPosition="inline"
          action={action ?? defaultAction}
          className="ml-[0.55px] h-7.5 cursor-pointer overflow-hidden rounded-lg px-1 py-1.5"
        >
          <span className="truncate font-case text-[13px] font-medium tracking-4 text-muted-foreground">
            {label}
          </span>
        </AccordionTrigger>
        <AccordionContent className={cn("flex flex-col", className)}>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
