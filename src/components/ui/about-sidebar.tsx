import { XIcon } from "@/components/ui/icons";
import { APP_NAME } from "@/lib/config/app-config";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FAQItem } from "@/components/footer";

interface AboutSidebarProps {
  onClose: () => void;
}

export const AboutSidebar = ({ onClose }: AboutSidebarProps) => (
  <div className="flex h-full animate-in flex-col bg-background duration-200 ease-out slide-in-from-right-[40%]">
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/40 px-3">
      <span className="text-[13px]">About</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        aria-label="Close"
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </div>
    <ScrollArea className="flex-1">
      <div className="p-6">
        <h2 className="mb-6 text-xl font-bold">Got questions?</h2>
        <div className="flex flex-col">
          <FAQItem
            question="How do I embed my form in a Notion page?"
            answer="Simply copy the share link and paste it into any Notion block. Select 'Create Embed' from the menu to instantly render your form inside Notion."
          />
          <FAQItem
            question="Is Agentation a complete alternative to Google Forms?"
            answer="Yes, and more. We offer advanced Notion-like blocks, AI generation, and a much cleaner aesthetic for modern workflows."
          />
          <FAQItem
            question="Can I use AI to generate form blocks automatically?"
            answer="Absolutely. Just type '/ai' in the editor followed by your prompt, and our engine will draft fields and questions for you."
          />
          <FAQItem
            question="How can I better organize my forms into workspaces?"
            answer="Workspaces allow you to group forms by project or team. You can switch between them using the workspace selector in the head margin."
          />
          <FAQItem
            question={`Does Agentation support multi-step forms like ${APP_NAME} or Typeform?`}
            answer="Yes, you can add 'Page' blocks to create immersive multi-step experiences with conditional logic support coming soon."
          />
        </div>
      </div>
    </ScrollArea>
  </div>
);
