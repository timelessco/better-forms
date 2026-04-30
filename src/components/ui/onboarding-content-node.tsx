import { APP_NAME } from "@/lib/config/app-config";
import { Calculator, MessageSquare, MousePointer2, Split, Zap } from "lucide-react";
import {
  CreditCardIcon,
  EyeOffLucideIcon,
  FileTextIcon,
  HelpCircleIcon,
  LayoutIcon,
  LinkIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface OnboardingContentElementData {
  type: "onboardingContent";
  children: [{ text: "" }];
}

export const createOnboardingContentNode = (): OnboardingContentElementData => ({
  type: "onboardingContent",
  children: [{ text: "" }],
});

const OnboardingItem = ({
  icon: Icon,
  label,
  href = "#",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href?: string;
}) => (
  <a
    href={href}
    className="group flex items-center gap-3 py-0.5 text-sm text-muted-foreground/70 transition-colors hover:text-foreground"
  >
    <Icon className="h-4 w-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
    <span>{label}</span>
  </a>
);

export const OnboardingContentElement = (props: PlateElementProps) => {
  const { children } = props;
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  return (
    <PlateElement {...props}>
      <div contentEditable={false} className="select-none">
        <div className="mx-auto max-w-[700px] px-4 pt-8 pb-16 sm:px-16">
          {/* Landing Hero Section */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              <SparklesIcon className="h-4 w-4" />
              <span>The next generation of forms</span>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
              Beautiful forms, building itself.
            </h2>
          </div>

          <div className="space-y-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 text-lg text-muted-foreground/60">
                <FileTextIcon className="h-5 w-5" />
                <span>
                  Press <span className="text-foreground/80">Enter</span> to start from scratch
                </span>
              </div>

              <Button
                variant="outline"
                className="h-10 w-fit gap-2 rounded-lg border-muted-foreground/20 px-4 text-muted-foreground shadow-sm hover:border-muted-foreground/40 hover:bg-muted/50"
                onClick={() => setTemplateModalOpen(true)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <LayoutIcon className="h-4 w-4" />
                Use a template
              </Button>
            </div>

            <div className="space-y-1 py-6">
              <p className="text-lg text-muted-foreground/80">
                {APP_NAME} is a form builder that{" "}
                <span className="px-1 font-semibold text-fuchsia-500">works like a doc</span>.
              </p>
              <p className="text-lg text-muted-foreground/80">
                Just type{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  /
                </code>
                to insert form blocks and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-fuchsia-500">
                  @
                </code>
                to mention question answers.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-16 pt-8">
              <div className="space-y-5">
                <h3 className="text-sm font-bold tracking-wider text-foreground uppercase">
                  Get started
                </h3>
                <div className="flex flex-col gap-3">
                  <OnboardingItem icon={MousePointer2} label="Create your first form" />
                  <OnboardingItem icon={LayoutIcon} label="Get started with templates" />
                  <OnboardingItem icon={LinkIcon} label="Embed your form" />
                  <OnboardingItem icon={HelpCircleIcon} label="Help center" />
                  <OnboardingItem icon={Zap} label={`Learn about ${APP_NAME} Pro`} />
                </div>
              </div>

              <div className="space-y-5">
                <h3 className="text-sm font-bold tracking-wider text-foreground uppercase">
                  How-to guides
                </h3>
                <div className="flex flex-col gap-3">
                  <OnboardingItem icon={Split} label="Conditional logic" />
                  <OnboardingItem icon={Calculator} label="Calculator" />
                  <OnboardingItem icon={EyeOffLucideIcon} label="Hidden fields" />
                  <OnboardingItem icon={MessageSquare} label="Mentions" />
                  <OnboardingItem icon={CreditCardIcon} label="Collect payments" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Modal */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <LayoutIcon className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-lg">Coming soon</p>
            <p className="mt-2 text-sm">We're working on some great templates for you.</p>
          </div>
        </DialogContent>
      </Dialog>

      {children}
    </PlateElement>
  );
};
