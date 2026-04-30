import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SettingsTab } from "@/hooks/use-settings-dialog";
import { useSettingsDialog } from "@/hooks/use-settings-dialog";
import { useCallback } from "react";
import { SidebarItem } from "@/components/sidebar-item";
import { CircleUserIcon, CreditCardIcon, GlobeIcon } from "@/components/ui/icons";
import { AccountSettingsContent } from "./account-settings-content";
import { BillingContent } from "./billing-content";
import { DomainsContent } from "./domains-content";
import { MembersContent } from "./members-content";

const navItems: {
  key: SettingsTab;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { key: "account", label: "Account", icon: CircleUserIcon },
  { key: "billing", label: "Billing", icon: CreditCardIcon },
  { key: "domains", label: "Domains", icon: GlobeIcon },
];

const tabTitles: Record<SettingsTab, string> = {
  account: "Account",
  members: "Members",
  billing: "Billing",
  domains: "Custom Domains",
};

const TabContent = ({ tab }: { tab: SettingsTab }) => {
  switch (tab) {
    case "account":
      return <AccountSettingsContent />;
    case "members":
      return <MembersContent />;
    case "billing":
      return <BillingContent />;
    case "domains":
      return <DomainsContent />;
  }
};

export const SettingsDialog = () => {
  const { isOpen, activeTab, close, setTab } = useSettingsDialog();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(0,0,0,0.36)] backdrop-blur-[4px] duration-150"
        className="flex h-[calc(100vh-2rem)] w-[calc(100vw-1rem)] max-w-none flex-col overflow-clip rounded-5xl p-0 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6),0px_105px_29px_0px_rgba(0,0,0,0),0px_67px_27px_0px_rgba(0,0,0,0.01),0px_38px_23px_0px_rgba(0,0,0,0.04),0px_17px_17px_0px_rgba(0,0,0,0.08),0px_4px_9px_0px_rgba(0,0,0,0.09)] ring-0 duration-150 sm:max-w-none md:h-[min(700px,calc(100vh-80px))] md:w-[740px] md:flex-row data-open:zoom-in-[0.98] data-closed:zoom-out-[0.98]"
      >
        {/* Left Sidebar (top tabs on mobile) */}
        <div className="relative flex w-full shrink-0 flex-col after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[0.5px] after:bg-gray-100 md:w-[180px] md:after:top-0 md:after:left-auto md:after:h-auto md:after:w-[0.5px]">
          {/* Settings label */}
          <div className="hidden px-[18px] pt-5 pb-[12.21px] md:block">
            <p className="text-sm font-medium tracking-[0.26px] text-muted-foreground">Settings</p>
          </div>

          {/* Nav items */}
          <nav className="flex flex-row overflow-x-auto px-2 py-2 md:flex-col md:overflow-visible md:py-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <SidebarItem
                  label={item.label}
                  key={item.key}
                  isActive={isActive}
                  onClick={() => setTab(item.key)}
                  prefix={<Icon className="size-[18px] shrink-0 text-muted-foreground" />}
                />
              );
            })}
          </nav>
        </div>

        {/* Right Content Area — entire section scrolls */}
        <ScrollArea className="min-h-0 flex-1" hideScrollbar>
          <div className="px-5 pt-5 pb-5 md:px-12.25 md:pt-8 md:pb-8">
            <DialogTitle className="mb-4 text-xl font-semibold text-foreground">
              {tabTitles[activeTab]}
            </DialogTitle>
            <TabContent tab={activeTab} />
          </div>
        </ScrollArea>

        <DialogDescription className="sr-only">Settings dialog</DialogDescription>
      </DialogContent>
    </Dialog>
  );
};
