import { XIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { SettingsContent } from "@/components/form-builder/settings-content";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";

interface FormSettingsSidebarProps {
  formId: string;
  isLocal?: boolean;
}

export const FormSettingsSidebar = ({ formId, isLocal }: FormSettingsSidebarProps) => {
  const { closeSidebar } = useEditorSidebar();

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="h-full w-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between">
          <h2 className="pl-2.5 text-base font-normal text-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="p-2 [&_button[data-empty]]:!w-auto [&_button[data-empty]]:max-w-[55%]">
          <p className="px-2 pb-2 text-[11px] text-muted-foreground/80">
            Changes apply to the public form on next publish.
          </p>
          <SettingsContent formId={formId} isLocal={isLocal} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
};
