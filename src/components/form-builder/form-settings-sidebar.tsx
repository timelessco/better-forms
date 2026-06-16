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
      // [font-variation-settings:normal] un-pins the global opsz20/wght450 so font-weight utils + Figma optical size apply
      className="size-full animate-in border-none duration-200 ease-out [font-variation-settings:normal] slide-in-from-right-[40%]"
    >
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pr-2 pb-2 pl-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm leading-[1.15] font-medium tracking-[0.14px] text-gray-800">
            Settings
          </h2>
          <Button
            variant="ghost-flat"
            size="icon-xs"
            className="size-7 rounded-lg p-1.25 text-gray-800 hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <XIcon className="size-4.5" />
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
