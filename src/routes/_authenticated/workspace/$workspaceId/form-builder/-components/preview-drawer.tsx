import { tabs } from "@/components/form-builder/embed-section";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerOverlay, DrawerPortal, DrawerTitle } from "@/components/ui/drawer";
import { LeftChevronIcon } from "@/components/ui/icons";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { startScopedViewTransition } from "@/lib/view-transition";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { flushSync } from "react-dom";
import { Drawer as DrawerPrimitive } from "vaul-base";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  // The preview surface (builder: <PreviewMode/>, landing: local-draft PreviewModeContent).
  children: ReactNode;
}

// Full-page preview drawer (Figma system-flat node 25408:8957): floating "Back to editor"
// top-left, Embed/Popup/Full Page tabs top-right, preview surface fills the card.
export const PreviewDrawer = ({ open, onClose, children }: PreviewDrawerProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const embedType = (search.embedType as EmbedType) ?? "fullpage";

  // Same flushSync + view-transition tab switch as the share sidebar so both stay in sync via the embedType search param.
  const handleEmbedTypeChange = (value: string) => {
    const update = () => {
      flushSync(() => {
        void navigate({
          search: ((prev: Record<string, unknown>) => ({
            ...prev,
            embedType: value,
            // eslint-disable-next-line typescript-eslint/no-explicit-any
          })) as any,
          replace: true,
        });
      });
    };
    // Scoped: only "preview-content" cross-fades; surrounding chrome stays static.
    startScopedViewTransition(update);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      direction="bottom"
      handleOnly
    >
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content className="preview-zoom-drawer fixed inset-2 z-50 flex flex-col overflow-hidden rounded-[10px] bg-background shadow-[0px_0px_4px_0px_rgba(0,0,0,0.08)] outline-none">
          <DrawerTitle className="sr-only">Form preview</DrawerTitle>
          <div className="min-h-0 flex-1">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
          {/* Chrome renders AFTER the preview so it paints on top via source order (no z-index =
              no stacking context). Own view-transition groups keep the chrome static on tab switch. */}
          <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              // same pill as TabsList (bg-secondary/rounded-md/h-7) so both chrome pieces match over any cover
              className="pointer-events-auto h-7 gap-1.5 rounded-md bg-secondary px-2 text-[14px] font-medium text-foreground shadow-[0px_0px_4px_0px_rgba(0,0,0,0.08)] hover:bg-secondary"
              style={{ viewTransitionName: "preview-drawer-back" }}
              onClick={onClose}
            >
              <LeftChevronIcon className="size-4" />
              Back to editor
            </Button>
            <Tabs
              value={embedType}
              onValueChange={handleEmbedTypeChange}
              className="pointer-events-auto w-60"
              style={{ viewTransitionName: "preview-drawer-tabs" }}
            >
              <TabsList className="w-full">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-base font-medium tracking-[0.21px]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
                <TabsIndicator />
              </TabsList>
            </Tabs>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
};
