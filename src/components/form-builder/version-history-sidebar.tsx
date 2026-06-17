import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";
import { Loader2Icon } from "@/components/ui/icons";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useSession } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons traced from the system-flat Figma (node 25690:11511); currentColor + square viewBox so they inherit theme color undistorted.
type IconProps = React.SVGProps<SVGSVGElement>;

const FigFilterIcon = (props: IconProps) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(1.6875 4.6875)">
      <path
        d="M9.1123 7.49512C9.42288 7.49522 9.6748 7.74702 9.6748 8.05762C9.67467 8.3681 9.42279 8.62001 9.1123 8.62012H5.5127C5.20212 8.62012 4.95033 8.36817 4.9502 8.05762C4.9502 7.74696 5.20204 7.49512 5.5127 7.49512H9.1123ZM11.8125 3.74707C12.1231 3.74709 12.3749 3.99899 12.375 4.30957C12.375 4.62022 12.1231 4.87205 11.8125 4.87207H2.8125C2.50184 4.87207 2.25 4.62023 2.25 4.30957C2.25008 3.99898 2.50189 3.74707 2.8125 3.74707H11.8125ZM14.0625 0C14.3732 0 14.625 0.25184 14.625 0.5625C14.625 0.87316 14.3732 1.125 14.0625 1.125H0.5625C0.25184 1.125 0 0.87316 0 0.5625C0 0.25184 0.25184 0 0.5625 0H14.0625Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigXIcon = (props: IconProps) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M14.3402 3.375L3.6582 14.625M3.6582 3.375L14.3402 14.625"
      stroke="currentColor"
      strokeWidth="1.28571"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FigLiveIcon = (props: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(0.5 3.5)">
      <path
        d="M1.81311 0.146441C2.00839 -0.0486477 2.32494 -0.048763 2.52014 0.146441C2.71496 0.341678 2.7151 0.658327 2.52014 0.853473C0.493184 2.88043 0.493184 6.18296 2.52014 8.20992C2.71496 8.40515 2.7151 8.7218 2.52014 8.91695C2.32501 9.11208 2.00841 9.11183 1.81311 8.91695C-0.604371 6.49947 -0.604371 2.56393 1.81311 0.146441ZM12.4791 0.146441C12.6744 -0.0488104 12.9909 -0.0488172 13.1862 0.146441C15.6034 2.56394 15.6036 6.49954 13.1862 8.91695C12.991 9.11214 12.6744 9.11198 12.4791 8.91695C12.2839 8.72169 12.2839 8.40518 12.4791 8.20992C14.506 6.18303 14.5059 2.88045 12.4791 0.853473C12.2839 0.658211 12.2839 0.341704 12.4791 0.146441ZM3.65393 1.86031C3.84917 1.66534 4.16578 1.66526 4.36096 1.86031C4.55614 2.05549 4.55597 2.37206 4.36096 2.56734C3.28657 3.64186 3.28662 5.29358 4.36096 6.36812C4.55614 6.5633 4.55597 6.87987 4.36096 7.07515C4.1657 7.27036 3.84918 7.2704 3.65393 7.07515C2.18906 5.61008 2.18901 3.32535 3.65393 1.86031ZM10.6383 1.86031C10.8336 1.66531 11.1502 1.66515 11.3453 1.86031C12.8103 3.32531 12.8101 5.61004 11.3453 7.07515C11.1501 7.27041 10.8336 7.27041 10.6383 7.07515C10.4431 6.87988 10.4431 6.56336 10.6383 6.36812C11.7126 5.29353 11.7128 3.64181 10.6383 2.56734C10.4431 2.37208 10.4431 2.05557 10.6383 1.86031ZM7.49866 2.73043C8.47601 2.73043 9.269 3.52264 9.26917 4.49996C9.26892 5.4772 8.47596 6.27046 7.49866 6.27046C6.52162 6.27016 5.72938 5.47701 5.72913 4.49996C5.7293 3.52283 6.52156 2.73073 7.49866 2.73043ZM7.49866 3.73043C7.07385 3.73073 6.7293 4.07511 6.72913 4.49996C6.72938 4.92473 7.0739 5.27016 7.49866 5.27046C7.92368 5.27046 8.26892 4.92492 8.26917 4.49996C8.269 4.07493 7.92373 3.73043 7.49866 3.73043Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigChevronDownIcon = (props: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(3.75 5.5)">
      <path
        d="M7.63477 0.158209C7.82353 -0.0431383 8.14033 -0.0537767 8.3418 0.134771C8.54315 0.323535 8.55379 0.640331 8.36524 0.841802L4.61524 4.8418C4.52072 4.94263 4.38821 5.00001 4.25001 5.00001C4.1118 5.00001 3.97929 4.94263 3.88477 4.8418L0.134771 0.841802C-0.053777 0.640331 -0.0431386 0.323534 0.158209 0.134771C0.359679 -0.0537781 0.676476 -0.0431375 0.86524 0.158209L4.25001 3.76856L7.63477 0.158209Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigCalendarDayIcon = (props: IconProps) => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(6 6)">
      <path
        d="M2 0C3.10457 0 4 0.895431 4 2C4 3.10457 3.10457 4 2 4C0.895431 4 0 3.10457 0 2C0 0.895431 0.895431 0 2 0ZM2 1C1.44772 1 1 1.44772 1 2C1 2.55228 1.44772 3 2 3C2.55228 3 3 2.55228 3 2C3 1.44772 2.55228 1 2 1Z"
        fill="currentColor"
      />
    </g>
  </svg>
);

const FigMoreIcon = (props: IconProps) => (
  <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M5.25 9.00009C5.25 8.17166 4.57843 7.50009 3.75 7.50009C2.92157 7.50009 2.25 8.17166 2.25 9.00009C2.25 9.82852 2.92157 10.5001 3.75 10.5001C4.57843 10.5001 5.25 9.82852 5.25 9.00009Z"
      fill="currentColor"
    />
    <path
      d="M10.4998 9.00009C10.4998 8.17166 9.82824 7.50009 8.99982 7.50009C8.17139 7.50009 7.49982 8.17166 7.49982 9.00009C7.49982 9.82852 8.17139 10.5001 8.99982 10.5001C9.82824 10.5001 10.4998 9.82852 10.4998 9.00009Z"
      fill="currentColor"
    />
    <path
      d="M15.7502 9.00009C15.7502 8.17166 15.0786 7.50009 14.2502 7.50009C13.4218 7.50009 12.7502 8.17166 12.7502 9.00009C12.7502 9.82852 13.4218 10.5001 14.2502 10.5001C15.0786 10.5001 15.7502 9.82852 15.7502 9.00009Z"
      fill="currentColor"
    />
  </svg>
);

type VersionItem = ReturnType<typeof useFormVersions>["data"] extends
  | readonly (infer T)[]
  | undefined
  ? T
  : never;

type VersionFilter = "all" | "mine";

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

/** Figma format: same-day → clock time, yesterday → "Yesterday", then "Nd ago"/"A week ago"/months/years. */
const formatVersionTime = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  const days = differenceInCalendarDays(new Date(), date);
  if (days < 7) return `${days}d ago`;
  if (days < 14) return "A week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "A month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  if (days < 730) return "A year ago";
  return `${Math.floor(days / 365)} years ago`;
};

/** Bucket versions into Today / Yesterday / Earlier for the calendar grouped view. */
const groupVersionsByDate = (versions: VersionItem[]) => {
  const buckets: { label: string; items: VersionItem[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];
  for (const version of versions) {
    const date = new Date(version.publishedAt);
    if (isToday(date)) buckets[0].items.push(version);
    else if (isYesterday(date)) buckets[1].items.push(version);
    else buckets[2].items.push(version);
  }
  return buckets.filter((bucket) => bucket.items.length > 0);
};

/** A circular marker on the left timeline rail. */
const RailNode = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "relative z-10 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-200 text-gray-800 transition-colors",
      active && "bg-gray-300",
    )}
  >
    {icon}
  </button>
);

interface VersionHistorySidebarProps {
  formId: string;
}

export const VersionHistorySidebar = ({ formId }: VersionHistorySidebarProps) => {
  const { data: versions } = useFormVersions(formId);
  const { closeSidebar } = useEditorSidebar();
  const { selectedVersionId, selectVersion, exitVersionView } = useVersionHistorySidebar();
  const { data: session } = useSession();
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreConfirmVersionId, setRestoreConfirmVersionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VersionFilter>("all");
  const [groupByDate, setGroupByDate] = useState(false);
  const [indicator, setIndicator] = useState<{ top: number; duration: number } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

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

  const currentUserId = session?.user?.id ?? null;
  const versionList = useMemo(() => versions ?? [], [versions]);

  const filteredList = useMemo(() => {
    if (filter === "mine" && currentUserId) {
      return versionList.filter((v) => v.publishedBy?.id === currentUserId);
    }
    return versionList;
  }, [versionList, filter, currentUserId]);

  const groups = useMemo(() => groupVersionsByDate(filteredList), [filteredList]);

  const effectiveVersionId = selectedVersionId ?? versionList[0]?.id ?? null;
  const currentVersionId = versionList[0]?.id ?? null;

  const handleSelectCurrent = useCallback(() => {
    if (currentVersionId) selectVersion(currentVersionId);
  }, [currentVersionId, selectVersion]);

  // Callback ref on the selected row → measure its center vs the rail so the chevron slides to it.
  // No useEffect: the ref fires during commit when selection changes (old row detaches, new attaches).
  const measureSelectedRow = useCallback((node: HTMLButtonElement | null) => {
    if (!node || !railRef.current) return;
    const rowRect = node.getBoundingClientRect();
    const railRect = railRef.current.getBoundingClientRect();
    const next = rowRect.top - railRect.top + rowRect.height / 2;
    setIndicator((prev) => {
      if (prev !== null && Math.abs(prev.top - next) < 0.5) return prev;
      // Constant-velocity feel: scale duration to travel distance, clamped 200–500ms.
      const distance = prev === null ? 0 : Math.abs(next - prev.top);
      const duration = prev === null ? 0 : Math.min(500, Math.max(200, distance / 0.6));
      return { top: next, duration };
    });
  }, []);

  const renderRow = useCallback(
    (version: VersionItem) => {
      const publisher = getPublisherInfo(version.publishedBy);
      const isSelected = effectiveVersionId === version.id;

      return (
        <button
          type="button"
          key={version.id}
          ref={isSelected ? measureSelectedRow : undefined}
          onClick={() => selectVersion(version.id)}
          className={cn(
            "group/vh-row flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
            isSelected ? "bg-muted" : "hover:bg-muted/50",
          )}
        >
          {/* Figma cell: 14px medium count title, 13px name w/ 16px avatar, leading-[1.15]. */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="truncate text-base leading-[1.15] font-medium tracking-[0.14px] text-gray-800">
              {version.version} Change{version.version === 1 ? "" : "s"}
            </p>
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar className="size-4 shrink-0 rounded-full">
                <AvatarImage src={publisher.image} alt={publisher.name} />
                <AvatarFallback className="rounded-full bg-muted text-[10px] text-muted-foreground">
                  {publisher.initial}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-[13px] leading-[1.15] font-[420] tracking-[0.13px] text-gray-600">
                {publisher.name}
              </span>
            </div>
          </div>

          {/* Right slot: timestamp at rest; ⋯ menu reveals on row hover/focus (or while open).
              ⋯ stays transparent until hovered directly → gray-300 (its active fill).
              Timestamp top-aligned (with title); ⋯ vertically centered, per Figma. */}
          <div className="relative flex shrink-0 items-start self-stretch">
            <span className="pt-[1px] text-[13px] leading-[1.15] font-medium tracking-[0.13px] text-gray-500 transition-opacity group-focus-within/vh-row:opacity-0 group-hover/vh-row:opacity-0 group-has-[[data-popup-open]]/vh-row:opacity-0">
              {formatVersionTime(version.publishedAt)}
            </span>
            <div className="absolute inset-y-0 right-0 flex items-center opacity-0 transition-opacity group-focus-within/vh-row:opacity-100 group-hover/vh-row:opacity-100 group-has-[[data-popup-open]]/vh-row:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg p-1.25 text-muted-foreground transition-colors hover:bg-gray-300 data-popup-open:bg-gray-300"
                      onClick={stopPropagation}
                      onKeyDown={(e) => e.stopPropagation()}
                      aria-label="Version actions"
                    />
                  }
                >
                  <FigMoreIcon className="size-[18px]" />
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
                    {isRestoring ? <Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> : null}
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
            </div>
          </div>
        </button>
      );
    },
    [effectiveVersionId, isRestoring, selectVersion, measureSelectedRow],
  );

  return (
    <Sidebar
      collapsible="none"
      // [font-variation-settings:normal] un-pins the global opsz20/wght450 so font-weight utils + Figma optical size apply
      className="size-full animate-in border-none duration-200 ease-out [font-variation-settings:normal] slide-in-from-right-[40%]"
    >
      <SidebarHeader className="h-11 shrink-0 flex-row items-center justify-between py-2 pr-2 pl-4">
        <h2 className="text-base leading-[1.15] font-medium tracking-[0.14px] text-gray-800">
          Version history
        </h2>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-gray-800 transition-colors hover:bg-secondary data-popup-open:bg-secondary"
                  aria-label="Filter versions"
                />
              }
            >
              <FigFilterIcon className="size-[18px]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              sideOffset={4}
              className="min-w-[151px] rounded-xl p-1"
            >
              <DropdownMenuRadioGroup
                value={filter}
                onValueChange={(value) => setFilter(value as VersionFilter)}
              >
                <DropdownMenuRadioItem value="all" className="text-[13px]">
                  All
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mine" className="text-[13px]">
                  Only yours
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost-flat"
            size="icon-xs"
            className="size-7 rounded-lg p-1.25 text-gray-800 hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <FigXIcon className="size-[18px]" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative pt-3 pr-2 pl-4">
        {/* gap-2: not in Figma (rail is flush there), but keeps the row highlight off the rail. */}
        <div className="flex gap-2">
          {/* Left timeline rail: live (current) at top, calendar (group by date) at bottom, chevron slides to the active row. */}
          <div
            ref={railRef}
            className="relative flex w-6 shrink-0 flex-col items-center self-stretch"
          >
            {filteredList.length > 1 && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-3 bottom-3 w-px bg-gray-200"
              />
            )}
            <div className="flex h-8 items-center">
              <RailNode
                icon={<FigLiveIcon className="size-4" />}
                label="Go to current version"
                onClick={handleSelectCurrent}
              />
            </div>
            <div className="mt-auto flex h-[51px] items-center">
              <RailNode
                icon={<FigCalendarDayIcon className="size-4" />}
                label="Group by date"
                active={groupByDate}
                onClick={() => setGroupByDate((v) => !v)}
              />
            </div>

            {/* Active-version pointer: slides to the selected row's vertical center. */}
            {indicator !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 z-10 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-800 transition-[top] ease-out"
                style={{ top: indicator.top, transitionDuration: `${indicator.duration}ms` }}
              >
                <FigChevronDownIcon className="size-4" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {groupByDate ? (
              groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <p className="px-2.5 py-2 text-base leading-[1.15] font-medium tracking-[0.14px] text-gray-800">
                    {group.label}
                  </p>
                  {group.items.map((version) => renderRow(version))}
                </div>
              ))
            ) : (
              <>
                <p className="px-2.5 py-2 text-base leading-[1.15] font-medium tracking-[0.14px] text-gray-800">
                  Current Version
                </p>
                {filteredList.map((version) => renderRow(version))}
              </>
            )}
          </div>
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
