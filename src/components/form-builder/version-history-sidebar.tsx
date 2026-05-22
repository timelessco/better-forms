import { formatDistanceToNow } from "date-fns";
import { Loader2Icon, MoreHorizontalIcon, XIcon } from "@/components/ui/icons";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFormVersions, restoreVersion } from "@/hooks/use-form-versions";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useVersionHistorySidebar } from "@/hooks/use-version-history-sidebar";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const getPublisherInfo = (
  publishedBy?: { id: string | null; name: string | null; image: string | null } | null,
) => {
  if (!publishedBy) {
    return { name: "Unknown", image: undefined, initial: "?" };
  }
  return {
    name: publishedBy.name ?? "Unknown",
    image: publishedBy.image ?? undefined,
    initial: publishedBy.name?.charAt(0) ?? "?",
  };
};

const formatRelativeTime = (dateString: string) => {
  const distance = formatDistanceToNow(new Date(dateString), {
    addSuffix: false,
  });
  if (distance.includes("less than") || distance.includes("second")) return "Now";
  return (
    distance
      .replace(/ minutes?/, "m")
      .replace(/ hours?/, "h")
      .replace(/ days?/, "d")
      .replace(/ months?/, "mo")
      .replace(/ years?/, "y")
      .replace(/about /, "")
      .replace(/over /, "")
      .replace(/almost /, "") + " ago"
  );
};

interface VersionHistorySidebarProps {
  formId: string;
}

export const VersionHistorySidebar = ({ formId }: VersionHistorySidebarProps) => {
  const { data: versions } = useFormVersions(formId);
  const { closeSidebar } = useEditorSidebar();
  const { selectedVersionId, selectVersion, exitVersionView } = useVersionHistorySidebar();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirmVersionId, setRestoreConfirmVersionId] = useState<string | null>(null);

  const handleRestore = useCallback(
    async (versionId: string) => {
      setIsRestoring(true);
      try {
        await restoreVersion(formId, versionId);
        toast.success("Version restored. Publish again to make it live.");
        exitVersionView();
      } catch {
        toast.error("Failed to restore version");
      } finally {
        setIsRestoring(false);
      }
    },
    [formId, exitVersionView],
  );

  const handleRestoreDialogChange = useCallback((open: boolean) => {
    if (!open) setRestoreConfirmVersionId(null);
  }, []);

  const handleRestoreConfirm = useCallback(() => {
    if (restoreConfirmVersionId) {
      void handleRestore(restoreConfirmVersionId);
    }
    setRestoreConfirmVersionId(null);
  }, [restoreConfirmVersionId, handleRestore]);

  const versionList = versions ?? [];

  const effectiveVersionId = selectedVersionId ?? versionList[0]?.id ?? null;

  return (
    <Sidebar
      collapsible="none"
      className="size-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between">
          <h2 className="pl-2.5 text-base font-normal text-foreground">Version History</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative px-2 pt-[10px]">
        <div className="relative flex flex-col gap-1">
          {versionList.length > 1 && (
            <div
              aria-hidden
              className="pointer-events-none absolute left-[18px] w-px overflow-hidden"
              style={{ top: 18, bottom: 33 }}
            >
              <div className="absolute inset-0 bg-border/60" />
              <div
                className="absolute inset-x-0 h-32 animate-[timeline-glow-up_3s_linear_infinite]"
                style={{
                  background:
                    "linear-gradient(to top, transparent 0%, color-mix(in oklab, var(--color-primary) 70%, transparent) 50%, transparent 100%)",
                }}
              />
            </div>
          )}

          {versionList.map((version, index) => {
            const publisher = getPublisherInfo(version.publishedBy);
            const isSelected = effectiveVersionId === version.id;
            const isCurrent = index === 0;

            return (
              <button
                type="button"
                key={version.id}
                onClick={() => selectVersion(version.id)}
                className={cn(
                  "relative flex h-auto w-full cursor-pointer items-start gap-1.5 rounded-lg py-2 pl-2 text-left",
                  isSelected ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                {/* Avatar */}
                <div className="relative z-10 shrink-0">
                  <Avatar className="size-5 rounded-full">
                    <AvatarImage src={publisher.image} alt={publisher.name} />
                    <AvatarFallback className="rounded-full bg-muted text-[13px] text-muted-foreground">
                      {publisher.initial}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Content — sizes match Figma (system-flat / cell): 14px
                    medium title, 13px regular subtitle, both at leading-[1.15] */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm leading-[1.15] font-medium text-foreground">
                    {publisher.name}
                  </p>
                  <p className="text-[13px] leading-[1.15] font-normal tracking-[0.13px] text-muted-foreground">
                    {version.version} change{version.version !== 1 ? "s" : ""} ·{" "}
                    {isCurrent ? "Current" : "Published"}
                  </p>
                </div>

                {/* Suffix: timestamp or menu. Both states share the same
                    pt-[2px] items-start outer wrapper (per Figma) and a
                    16px-tall inner box, so flipping selection never
                    changes the row's height (51px) or visual rhythm. */}
                <div className="inline-flex shrink-0 items-start pt-[2px]">
                  {isSelected ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="inline-flex h-4 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-[5.5px] hover:bg-accent"
                            onClick={stopPropagation}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label="Version actions"
                          />
                        }
                      >
                        <MoreHorizontalIcon className="size-3 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="bottom"
                        align="end"
                        sideOffset={4}
                        className="flex min-w-[151px] flex-col gap-0.5 rounded-xl p-1"
                      >
                        <DropdownMenuItem
                          className="h-[26px] rounded-lg px-2 text-[13px]"
                          disabled={isRestoring}
                          onClick={() => setRestoreConfirmVersionId(version.id)}
                        >
                          {isRestoring ? (
                            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                          ) : null}
                          Restore this version
                        </DropdownMenuItem>
                        <DropdownMenuItem className="h-[26px] rounded-lg px-2 text-[13px]">
                          Publish this version
                        </DropdownMenuItem>
                        <DropdownMenuItem className="h-[26px] rounded-lg px-2 text-[13px]">
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="inline-flex h-4 items-center px-2 text-[13px] leading-[1.15] font-medium tracking-[0.13px] text-muted-foreground">
                      {formatRelativeTime(version.publishedAt)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SidebarContent>

      <AlertDialog open={!!restoreConfirmVersionId} onOpenChange={handleRestoreDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              Current draft will be overwritten. You can publish again to make it live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreConfirm}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
};
