import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQItem = ({ question, answer }: { question: string; answer: string }) => (
  <Accordion>
    <AccordionItem className="border-b border-foreground/5 last:border-0">
      <AccordionTrigger className="px-0 py-3 text-[13px] font-normal text-muted-foreground group-hover:text-foreground hover:no-underline [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground/30 [&>svg]:hover:text-foreground">
        {question}
      </AccordionTrigger>
      <AccordionContent className="ml-1 border-l border-foreground/5 pl-1 text-[12px] text-muted-foreground/80">
        {answer}
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);
