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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  SettingsIcon,
} from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IconSwap } from "@/components/transitions/icon-swap";
import { TextSwap } from "@/components/transitions/text-swap";
import { toggleFavoriteLocal, updateFormStatus } from "@/collections";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { discardChanges, publishForm, useHasUnpublishedChanges } from "@/hooks/use-form-versions";
import { useForm, useIsFavorite, useWorkspace } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { HOTKEYS, formatForDisplay } from "@/lib/hotkeys";
import { cn, parseTimestampAsUTC } from "@/lib/utils";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { LogoToggle } from "./logo";
import { useSidebarSafe } from "./sidebar";

interface AppHeaderProps {
  isDistractionHidden?: boolean;
}

type SavedDocsTooltipContentProps = {
  userName?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

const subscribeMountedNoop = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

const SavedDocsTooltipContent = ({
  userName,
  updatedAt,
  createdAt,
}: SavedDocsTooltipContentProps) => {
  // useSyncExternalStore mounted flag so SSR/client agree initially; relative timestamp swaps in after hydration.
  const mounted = useSyncExternalStore(subscribeMountedNoop, getMountedClient, getMountedServer);

  const updatedDate = mounted
    ? (parseTimestampAsUTC(updatedAt ?? undefined) ?? new Date())
    : undefined;
  const createdDate = mounted
    ? (parseTimestampAsUTC(createdAt ?? undefined) ?? new Date())
    : undefined;

  return (
    <div className="space-y-1">
      <p className="text-xs text-background/70" suppressHydrationWarning>
        Edited by <span className="text-background">{userName ?? "You"}</span>{" "}
        {updatedDate ? `${formatDistanceToNow(updatedDate)} ago` : ""}
      </p>
      {createdAt && (
        <p className="text-xs text-background/70" suppressHydrationWarning>
          Created by <span className="text-background">{userName ?? "You"}</span>{" "}
          {createdDate ? format(createdDate, "MMM d, yyyy") : ""}
        </p>
      )}
    </div>
  );
};

export const AppHeader = ({ isDistractionHidden = false }: AppHeaderProps) => {
  const { formId, workspaceId } = useParams({ strict: false });
  const {
    state,
    toggleSidebar: toggleMainSidebar,
    isMobile,
  } = useSidebarSafe() || {
    state: "expanded",
    toggleSidebar: () => {},
    isMobile: false,
  };
  const pathname = useLocation({ select: (s) => s.pathname });
  const isDashboard = pathname === "/dashboard";
  const isLandingPage = pathname === "/";
  const isFormBuilder = pathname.startsWith("/form-builder") || pathname.includes("/form-builder/");
  const isEditRoute = pathname.endsWith("/edit");
  const isInsightsRoute = pathname.endsWith("/insights");
  const breadcrumbLabel = isEditRoute ? "Editor" : isInsightsRoute ? "Insights" : "Submissions";
  const { data: sessionData } = useSession();
  const session = sessionData;
  const navigate = useNavigate();

  const {
    activeSidebar,
    closeSidebar,
    toggleSidebar: toggleEditorSidebar,
    previewMode,
    enterPreview,
    togglePreview,
    openShare,
  } = useEditorSidebar();

  const isShareSidebarOpen = activeSidebar === "share";
  const isEditorSidebarOpen = !!activeSidebar;

  const toggleVersionHistory = () => {
    toggleEditorSidebar("history");
  };
  const toggleSettingsSidebar = () => {
    toggleEditorSidebar("settings");
  };

  const toggleCustomizeSidebar = () => {
    toggleEditorSidebar("customize");
  };

  const handleCloseSidebar = () => {
    closeSidebar();
  };

  const toggleShareSidebar = () => {
    if (isShareSidebarOpen) {
      closeSidebar();
      return;
    }
    if (!isEditRoute && workspaceId && formId) {
      openShare();
      enterPreview();
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId, formId },
        search: { force: true },
      });
      return;
    }
    enterPreview();
    openShare();
  };

  const { data: workspace } = useWorkspace(workspaceId);
  const { data: savedDocs, isLoading: isLoadingSavedDocs } = useForm(formId);

  const hasUnpublishedChanges = useHasUnpublishedChanges(formId);
  const hasPublishedVersion = !!savedDocs?.[0]?.lastPublishedVersionId;
  const canShare = savedDocs?.[0]?.status === "published" || hasPublishedVersion;

  type WorkflowState = "idle" | "publishing" | "discarding";
  const [workflowState, setWorkflowState] = useState<WorkflowState>("idle");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  const isDiscarding = workflowState === "discarding";
  const isPublishing = workflowState === "publishing";

  useIsFavorite(session?.user?.id, formId);

  const isLeftSidebarOpen = state === "expanded";

  const {
    handleToggleFavorite,
    handleDeleteForm,
    handlePublish,
    handleDiscardChanges,
    handleEditForm,
    handleDismissSidebars,
  } = useAppHeaderFormActions({
    formId,
    workspaceId,
    sessionUserId: session?.user?.id,
    isEditorSidebarOpen,
    isLeftSidebarOpen,
    navigate,
    openShare,
    handleCloseSidebar,
    toggleMainSidebar,
    toggleShareSidebar,
    setWorkflowState,
  });

  useAppHeaderHotkeys({
    isFormBuilder,
    isLandingPage,
    isEditRoute,
    hasPublishedVersion,
    formId,
    hasUnpublishedChanges,
    isPublishing,
    workspaceId,
    canShare,
    toggleSettingsSidebar,
    toggleCustomizeSidebar,
    toggleVersionHistory,
    handleToggleFavorite,
    handlePublish,
    handleEditForm,
    togglePreview,
    toggleShareSidebar,
    handleDismissSidebars,
  });

  const menuItems = buildFormBuilderMenuItems({
    isEditRoute,
    hasPublishedVersion,
    hasUnpublishedChanges,
    isMobile,
    canShare,
    workspaceId,
    formId,
    onToggleFavorite: handleToggleFavorite,
    onNavigateInsights: () => {
      if (workspaceId && formId) {
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/insights",
          params: { workspaceId, formId },
        });
      }
    },
    onToggleCustomizeSidebar: toggleCustomizeSidebar,
    onToggleVersionHistory: toggleVersionHistory,
    onToggleShareSidebar: toggleShareSidebar,
    onToggleSettingsSidebar: toggleSettingsSidebar,
    onSetActiveDialog: setActiveDialog,
  });

  return (
    <>
      <header
        className={cn(
          "group/header -z-10 flex h-10 w-full shrink-0 items-center justify-between bg-background px-2 text-[13px] transition-opacity duration-150 select-none",
          isDistractionHidden && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isLandingPage && <LogoToggle static className="-ml-1" />}
          {/* Logo doubles as the sidebar trigger on mobile (always visible)
              and on desktop when the sidebar is collapsed. The primary open
              gesture on mobile is a rightward swipe from anywhere on the
              page; this is the discoverability safety net. */}
          {!isLandingPage && (state === "collapsed" || isMobile) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <LogoToggle
                    direction="right"
                    onClick={() => toggleMainSidebar()}
                    className="-ml-1"
                  />
                }
              />
              <TooltipContent side="right">
                <p>{isMobile ? "Open sidebar" : "Expand sidebar"}</p>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground">
                    {formatForDisplay(HOTKEYS.DISMISS_SIDEBARS)}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {isFormBuilder && savedDocs?.[0] && (
            <HeaderBreadcrumb
              workspace={workspace}
              savedDoc={savedDocs[0]}
              workspaceId={workspaceId}
              formId={formId}
              isEditRoute={isEditRoute}
              isEditorSidebarOpen={isEditorSidebarOpen}
              breadcrumbLabel={breadcrumbLabel}
            />
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isFormBuilder && savedDocs?.[0]?.updatedAt && !isLoadingSavedDocs && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="mr-1 hidden h-7 items-center rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-normal whitespace-nowrap text-muted-foreground/70 md:inline-flex" />
                }
              >
                Edited{" "}
                {/* eslint-disable-next-line react-doctor/rendering-hydration-mismatch-time -- authenticated layout, client-only render */}
                {formatDistanceToNow(parseTimestampAsUTC(savedDocs?.[0]?.updatedAt) ?? new Date())}{" "}
                ago
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <SavedDocsTooltipContent
                  userName={session?.user?.name}
                  updatedAt={savedDocs?.[0]?.updatedAt}
                  createdAt={savedDocs?.[0]?.createdAt}
                />
              </TooltipContent>
            </Tooltip>
          )}

          {isDashboard && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-2.5 font-normal text-gray-700 hover:text-foreground",
                activeSidebar === "about" && "bg-accent/50 text-foreground",
              )}
              onClick={() => toggleEditorSidebar("about")}
            >
              About
            </Button>
          )}

          {isLandingPage && (
            <LandingPageActions
              previewMode={previewMode}
              activeSidebar={activeSidebar}
              activeMenu={activeMenu}
              onTogglePreview={togglePreview}
              onToggleEditorSidebar={toggleEditorSidebar}
              onSetActiveMenu={setActiveMenu}
              onSignIn={() => navigate({ to: "/login" })}
            />
          )}

          {isFormBuilder && (
            <FormBuilderHeaderActions
              flags={{
                isEditRoute,
                hasUnpublishedChanges,
                isDiscarding,
                isPublishing,
                previewMode,
                canShare,
                isShareSidebarOpen,
                isLoadingSavedDocs,
              }}
              activeMenu={activeMenu}
              workspaceId={workspaceId}
              formId={formId}
              savedDocs={savedDocs}
              menuItems={menuItems}
              onTogglePreview={togglePreview}
              onToggleShareSidebar={toggleShareSidebar}
              onToggleSettingsSidebar={toggleSettingsSidebar}
              onPublish={handlePublish}
              onSetActiveDialog={setActiveDialog}
              onSetActiveMenu={setActiveMenu}
            />
          )}
        </div>
      </header>

      <AppHeaderDialogs
        activeDialog={activeDialog}
        onDialogChange={setActiveDialog}
        onDeleteForm={handleDeleteForm}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
};

type ActiveDialog = "delete" | "discard" | null;
type ActiveMenu = "main" | "local" | null;

interface UseAppHeaderFormActionsOptions {
  formId: string | undefined;
  workspaceId: string | undefined;
  sessionUserId: string | undefined;
  isEditorSidebarOpen: boolean;
  isLeftSidebarOpen: boolean;
  navigate: ReturnType<typeof useNavigate>;
  openShare: () => void;
  handleCloseSidebar: () => void;
  toggleMainSidebar: () => void;
  toggleShareSidebar: () => void;
  setWorkflowState: (state: "idle" | "publishing" | "discarding") => void;
}

const useAppHeaderFormActions = ({
  formId,
  workspaceId,
  sessionUserId,
  isEditorSidebarOpen,
  isLeftSidebarOpen,
  navigate,
  openShare,
  handleCloseSidebar,
  toggleMainSidebar,
  toggleShareSidebar,
  setWorkflowState,
}: UseAppHeaderFormActionsOptions) => {
  const handleToggleFavorite = async () => {
    if (!sessionUserId || !formId) return;
    await toggleFavoriteLocal(sessionUserId, formId);
  };

  const handleDeleteForm = async () => {
    if (!formId) return;
    try {
      await updateFormStatus(formId, "archived");
      toast.success("Form moved to trash");
      void navigate({ to: "/dashboard" });
    } catch {
      toast.error("Failed to delete form");
    }
  };

  const handlePublish = async () => {
    if (formId && workspaceId) {
      setWorkflowState("publishing");
      try {
        const tx = publishForm(formId);
        await tx.isPersisted.promise;
        toast.success("Form published");
        openShare();
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/submissions",
          params: { workspaceId, formId },
        });
      } catch (error) {
        toast.error("Failed to publish form");
        console.error(error);
      } finally {
        setWorkflowState("idle");
      }
    }
  };

  const handleDiscardChanges = async () => {
    if (formId) {
      setWorkflowState("discarding");
      try {
        await discardChanges(formId);
        toast.info("Changes discarded, reverted to last published version");
      } catch (error) {
        toast.error("Failed to discard changes");
        console.error(error);
      } finally {
        setWorkflowState("idle");
      }
    }
  };

  const handleEditForm = () => {
    if (workspaceId && formId) {
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId, formId },
        search: (prev: Record<string, unknown>) => ({ ...prev, force: true }),
      });
    }
  };

  const handleDismissSidebars = () => {
    if (isEditorSidebarOpen && isLeftSidebarOpen) {
      handleCloseSidebar();
      toggleMainSidebar();
    } else if (isEditorSidebarOpen) {
      handleCloseSidebar();
    } else if (isLeftSidebarOpen) {
      toggleMainSidebar();
    } else {
      toggleMainSidebar();
      toggleShareSidebar();
    }
  };

  return {
    handleToggleFavorite,
    handleDeleteForm,
    handlePublish,
    handleDiscardChanges,
    handleEditForm,
    handleDismissSidebars,
  };
};

interface BuildFormBuilderMenuItemsOptions {
  isEditRoute: boolean;
  hasPublishedVersion: boolean;
  hasUnpublishedChanges: boolean;
  isMobile: boolean;
  canShare: boolean;
  workspaceId: string | undefined;
  formId: string | undefined;
  onToggleFavorite: () => Promise<void> | void;
  onNavigateInsights: () => void;
  onToggleCustomizeSidebar: () => void;
  onToggleVersionHistory: () => void;
  onToggleShareSidebar: () => void;
  onToggleSettingsSidebar: () => void;
  onSetActiveDialog: (dialog: ActiveDialog) => void;
}

const buildFormBuilderMenuItems = ({
  isEditRoute,
  hasPublishedVersion,
  hasUnpublishedChanges,
  isMobile,
  canShare,
  onToggleFavorite,
  onNavigateInsights,
  onToggleCustomizeSidebar,
  onToggleVersionHistory,
  onToggleShareSidebar,
  onToggleSettingsSidebar,
  onSetActiveDialog,
}: BuildFormBuilderMenuItemsOptions): MenuItem[] =>
  [
    {
      key: "favorite",
      label: "Favorite",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_FAVORITE),
      onClick: () => onToggleFavorite(),
    },
    {
      key: "analytics",
      label: "Analytics",
      onClick: onNavigateInsights,
      // Analytics is empty until first publish, and /insights for an unpublished form crashes
      // the Recharts bundle — gate on the same flag as share + version history.
      show: hasPublishedVersion,
    },
    {
      key: "customization",
      label: "Customization",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_CUSTOMIZE_SIDEBAR),
      onClick: onToggleCustomizeSidebar,
      show: isEditRoute,
    },
    {
      key: "versionHistory",
      label: "Version History",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_VERSION_HISTORY),
      onClick: onToggleVersionHistory,
      show: isEditRoute && hasPublishedVersion,
    },
    {
      key: "share",
      label: "Share",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_SHARE_SIDEBAR),
      onClick: onToggleShareSidebar,
      show: isMobile && canShare,
    },
    {
      key: "settings",
      label: "Settings",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_SETTINGS_SIDEBAR),
      onClick: onToggleSettingsSidebar,
      show: isMobile,
    },
    {
      key: "discard",
      label: "Discard changes",
      onClick: () => onSetActiveDialog("discard"),
      show: hasUnpublishedChanges,
    },
    {
      key: "delete",
      label: "Delete form",
      onClick: () => onSetActiveDialog("delete"),
    },
  ].filter((item: { show?: boolean }) => item.show ?? true);

interface HeaderBreadcrumbProps {
  workspace: ReturnType<typeof useWorkspace>["data"];
  savedDoc: NonNullable<ReturnType<typeof useForm>["data"]>[0];
  workspaceId: string | undefined;
  formId: string | undefined;
  isEditRoute: boolean;
  isEditorSidebarOpen: boolean;
  breadcrumbLabel: string;
}

const HeaderBreadcrumb = ({
  workspace,
  savedDoc,
  workspaceId,
  formId,
  isEditRoute,
  isEditorSidebarOpen,
  breadcrumbLabel,
}: HeaderBreadcrumbProps) => {
  const titleText = savedDoc.title || "Untitled";
  const linkClassName = cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "max-w-[140px] min-w-0 shrink justify-start px-1.5 font-normal text-gray-700 hover:bg-accent/60 sm:max-w-[200px]",
  );
  const isPublished = savedDoc.status === "published" && workspaceId && formId;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center text-sm">
      {workspace && (
        <>
          <Link
            to="/dashboard"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden max-w-[150px] shrink truncate px-1.5 font-normal text-gray-700 hover:bg-accent/60 hover:text-foreground md:inline-flex",
            )}
          >
            <span className="truncate">{workspace.name}</span>
          </Link>
          <span aria-hidden="true" className="hidden shrink-0 px-0.5 text-gray-700/40 md:inline">
            /
          </span>
        </>
      )}
      {isPublished ? (
        isEditRoute ? (
          <Link
            to="/workspace/$workspaceId/form-builder/$formId/submissions"
            params={{ workspaceId, formId }}
            className={linkClassName}
          >
            <span className="truncate">{titleText}</span>
          </Link>
        ) : (
          <Link
            to="/workspace/$workspaceId/form-builder/$formId/edit"
            params={{ workspaceId, formId }}
            search={(prev) => ({ ...prev, force: true })}
            className={linkClassName}
          >
            <span className="truncate">{titleText}</span>
          </Link>
        )
      ) : (
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "max-w-[140px] min-w-0 shrink cursor-default justify-start px-1.5 font-normal text-gray-700 hover:bg-transparent sm:max-w-[200px]",
          )}
        >
          <span className="truncate">{titleText}</span>
        </span>
      )}
      {!isEditorSidebarOpen && (
        <>
          <span aria-hidden="true" className="hidden shrink-0 px-0.5 text-gray-700/40 lg:inline">
            /
          </span>
          <span
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden shrink-0 cursor-default px-1.5 font-normal text-gray-700 hover:bg-transparent lg:inline-flex",
            )}
          >
            {breadcrumbLabel}
          </span>
        </>
      )}
    </nav>
  );
};

interface LandingPageActionsProps {
  previewMode: boolean;
  activeSidebar: string | null;
  activeMenu: ActiveMenu;
  onTogglePreview: () => void;
  onToggleEditorSidebar: (id: "about" | "settings" | "customize") => void;
  onSetActiveMenu: (menu: ActiveMenu) => void;
  onSignIn: () => void;
}

const LandingPageActions = ({
  previewMode,
  activeSidebar,
  activeMenu,
  onTogglePreview,
  onToggleEditorSidebar,
  onSetActiveMenu,
  onSignIn,
}: LandingPageActionsProps) => (
  <>
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-2.5 font-normal text-gray-700 hover:text-foreground",
              previewMode && "bg-accent/50 text-foreground",
            )}
            onClick={onTogglePreview}
          />
        }
      >
        {previewMode ? "Editor" : "Preview"}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p>{previewMode ? "Back to Editor" : "Preview Form"}</p>
        <p className="text-xs text-muted-foreground">{formatForDisplay(HOTKEYS.TOGGLE_PREVIEW)}</p>
      </TooltipContent>
    </Tooltip>
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "px-2.5 font-normal text-gray-700 hover:text-foreground",
        activeSidebar === "about" && "bg-accent/50 text-foreground",
      )}
      onClick={() => onToggleEditorSidebar("about")}
    >
      About
    </Button>
    <Button
      variant="ghost"
      size="icon"
      className="rounded-lg text-gray-700 hover:text-foreground"
      onClick={() => onToggleEditorSidebar("settings")}
      aria-label="Settings"
    >
      <SettingsIcon fill="transparent" className="text-gray-700" />
    </Button>
    <DropdownMenu
      open={activeMenu === "local"}
      onOpenChange={(open) => onSetActiveMenu(open ? "local" : null)}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-gray-700 hover:text-foreground"
            aria-label="More options"
          />
        }
      >
        <MoreHorizontalIcon className="size-[18px] text-gray-700" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
        <DropdownMenuItem onClick={() => onToggleEditorSidebar("customize")}>
          <span className="flex-1 text-left">Customization</span>
          <DropdownMenuShortcut>
            {formatForDisplay(HOTKEYS.TOGGLE_CUSTOMIZE_SIDEBAR)}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignIn}>
          <span className="flex-1 text-left">Sign in</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button
      size="sm"
      className="ml-1 rounded-[8px] border-none bg-neutral-950 py-1.5 pr-2 pl-2.5 text-[14px] text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
      onClick={onSignIn}
    >
      Publish
    </Button>
  </>
);

interface MenuItem {
  key: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
}

interface FormBuilderHeaderActionsFlags {
  isEditRoute: boolean;
  hasUnpublishedChanges: boolean;
  isDiscarding: boolean;
  isPublishing: boolean;
  previewMode: boolean;
  canShare: boolean;
  isShareSidebarOpen: boolean;
  isLoadingSavedDocs: boolean;
}

interface FormBuilderHeaderActionsProps {
  flags: FormBuilderHeaderActionsFlags;
  activeMenu: ActiveMenu;
  workspaceId: string | undefined;
  formId: string | undefined;
  savedDocs: ReturnType<typeof useForm>["data"];
  menuItems: MenuItem[];
  onTogglePreview: () => void;
  onToggleShareSidebar: () => void;
  onToggleSettingsSidebar: () => void;
  onPublish: () => Promise<void> | void;
  onSetActiveDialog: (dialog: ActiveDialog) => void;
  onSetActiveMenu: (menu: ActiveMenu) => void;
}

const FormBuilderHeaderActions = ({
  flags,
  activeMenu,
  workspaceId,
  formId,
  savedDocs,
  menuItems,
  onTogglePreview,
  onToggleShareSidebar,
  onToggleSettingsSidebar,
  onPublish,
  onSetActiveDialog,
  onSetActiveMenu,
}: FormBuilderHeaderActionsProps) => {
  const {
    isEditRoute,
    hasUnpublishedChanges,
    isDiscarding,
    isPublishing,
    previewMode,
    canShare,
    isShareSidebarOpen,
    isLoadingSavedDocs,
  } = flags;
  return (
    <>
      {isEditRoute && hasUnpublishedChanges && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-7 text-gray-700 hover:text-foreground md:inline-flex"
                onClick={() => onSetActiveDialog("discard")}
                disabled={isDiscarding}
              />
            }
          >
            <IconSwap
              state={isDiscarding ? "b" : "a"}
              iconA={<RotateCcwIcon className="size-4 text-gray-700" strokeWidth={2} />}
              iconB={<Loader2Icon className="size-4 animate-spin text-gray-700" strokeWidth={2} />}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset to last published version</p>
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center gap-1">
        {canShare && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "hidden px-2.5 font-normal text-gray-700 hover:text-foreground md:inline-flex",
              isShareSidebarOpen && "bg-accent/50 text-foreground",
            )}
            onClick={onToggleShareSidebar}
          >
            Share
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="hidden text-gray-700 hover:text-foreground md:inline-flex"
          aria-label="Settings"
          onClick={onToggleSettingsSidebar}
        >
          <SettingsIcon
            fill="transparent"
            className="text-gray-700"
            stroke="var(--color-gray-700)"
          />
        </Button>

        {(isEditRoute || (workspaceId && formId)) && (
          <div className="ml-1 flex items-center gap-1">
            {isEditRoute ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden text-gray-700 hover:text-foreground md:inline-flex"
                      onClick={onTogglePreview}
                      aria-label={previewMode ? "Switch to editor" : "Switch to preview"}
                    />
                  }
                >
                  <IconSwap
                    state={previewMode ? "b" : "a"}
                    iconA={<EyeIcon className="text-gray-700" />}
                    iconB={<EyeOffIcon className="text-gray-700" />}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <p>{previewMode ? "Back to Editor" : "Preview Form"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatForDisplay(HOTKEYS.TOGGLE_PREVIEW)}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              workspaceId &&
              formId && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        to="/workspace/$workspaceId/form-builder/$formId/edit"
                        params={{ workspaceId, formId }}
                        search={(prev: Record<string, unknown>) => ({ ...prev, force: true })}
                        preload="intent"
                        aria-label="Edit form"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "text-gray-700 hover:text-foreground",
                        )}
                      />
                    }
                  >
                    <PencilIcon className="text-gray-700" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    <p>Edit Form</p>
                    <p className="text-xs text-muted-foreground">
                      {formatForDisplay(HOTKEYS.EDIT_FORM)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )
            )}
            <DropdownMenu
              open={activeMenu === "main"}
              onOpenChange={(open) => onSetActiveMenu(open ? "main" : null)}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 overflow-hidden rounded-lg p-1.25 hover:bg-secondary active:bg-secondary aria-expanded:bg-secondary"
                    aria-label="More options"
                  />
                }
              >
                <MoreHorizontalIcon className="text-gray-700" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
                {menuItems.map((item) => (
                  <DropdownMenuItem key={item.key} onClick={() => item.onClick()}>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {workspaceId && formId && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      className={cn(
                        "border-none py-1.5 pr-2 pl-2 text-[14px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all",
                        !isLoadingSavedDocs &&
                          (hasUnpublishedChanges || savedDocs?.[0]?.status !== "published")
                          ? "bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                      onClick={onPublish}
                      disabled={
                        isPublishing ||
                        (!hasUnpublishedChanges && savedDocs?.[0]?.status === "published")
                      }
                    />
                  }
                >
                  {isPublishing ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : savedDocs?.[0]?.status === "published" && !hasUnpublishedChanges ? (
                    <TextSwap key="Published">Published</TextSwap>
                  ) : (
                    <TextSwap key="Publish">Publish</TextSwap>
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <p className="text-xs text-muted-foreground">
                    {formatForDisplay(HOTKEYS.PUBLISH_FORM)}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </>
  );
};

interface AppHeaderDialogsProps {
  activeDialog: ActiveDialog;
  onDialogChange: (dialog: ActiveDialog) => void;
  onDeleteForm: () => Promise<void> | void;
  onDiscardChanges: () => Promise<void> | void;
}

const AppHeaderDialogs = ({
  activeDialog,
  onDialogChange,
  onDeleteForm,
  onDiscardChanges,
}: AppHeaderDialogsProps) => (
  <>
    <AlertDialog
      open={activeDialog === "delete"}
      onOpenChange={(open) => onDialogChange(open ? "delete" : null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete form</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this form? This action will move it to trash and cannot
            be easily undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDeleteForm}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={activeDialog === "discard"}
      onOpenChange={(open) => onDialogChange(open ? "discard" : null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unpublished changes?</AlertDialogTitle>
          <AlertDialogDescription>
            This will revert the form to the last published version. Any unsaved changes will be
            lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void onDiscardChanges();
              onDialogChange(null);
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);

interface AppHeaderHotkeysOptions {
  isFormBuilder: boolean;
  isLandingPage: boolean;
  isEditRoute: boolean;
  hasPublishedVersion: boolean;
  formId: string | undefined;
  hasUnpublishedChanges: boolean;
  isPublishing: boolean;
  workspaceId: string | undefined;
  canShare: boolean;
  toggleSettingsSidebar: () => void;
  toggleCustomizeSidebar: () => void;
  toggleVersionHistory: () => void;
  handleToggleFavorite: () => Promise<void> | void;
  handlePublish: () => Promise<void> | void;
  handleEditForm: () => void;
  togglePreview: () => void;
  toggleShareSidebar: () => void;
  handleDismissSidebars: () => void;
}

const useAppHeaderHotkeys = ({
  isFormBuilder,
  isLandingPage,
  isEditRoute,
  hasPublishedVersion,
  formId,
  hasUnpublishedChanges,
  isPublishing,
  workspaceId,
  canShare,
  toggleSettingsSidebar,
  toggleCustomizeSidebar,
  toggleVersionHistory,
  handleToggleFavorite,
  handlePublish,
  handleEditForm,
  togglePreview,
  toggleShareSidebar,
  handleDismissSidebars,
}: AppHeaderHotkeysOptions) => {
  useHotkey(HOTKEYS.TOGGLE_SETTINGS_SIDEBAR, () => toggleSettingsSidebar(), {
    enabled: isFormBuilder || isLandingPage,
  });

  useHotkey(HOTKEYS.TOGGLE_CUSTOMIZE_SIDEBAR, () => toggleCustomizeSidebar(), {
    enabled: (isFormBuilder && isEditRoute) || isLandingPage,
  });

  useHotkey(HOTKEYS.TOGGLE_VERSION_HISTORY, () => toggleVersionHistory(), {
    enabled: isFormBuilder && isEditRoute && hasPublishedVersion,
  });

  useHotkey(HOTKEYS.TOGGLE_FAVORITE, () => handleToggleFavorite(), {
    enabled: isFormBuilder && !!formId,
  });

  useHotkey(HOTKEYS.PUBLISH_FORM, () => handlePublish(), {
    enabled: isFormBuilder && (isEditRoute || hasUnpublishedChanges) && !isPublishing,
  });

  useHotkey(HOTKEYS.EDIT_FORM, () => handleEditForm(), {
    enabled: isFormBuilder && !isEditRoute && !!workspaceId && !!formId,
  });

  useHotkey(HOTKEYS.TOGGLE_PREVIEW, () => togglePreview(), {
    enabled: (isFormBuilder && isEditRoute) || isLandingPage,
  });

  useHotkey(HOTKEYS.TOGGLE_SHARE_SIDEBAR, () => toggleShareSidebar(), {
    enabled: isFormBuilder && isEditRoute && canShare,
  });

  useHotkey(HOTKEYS.DISMISS_SIDEBARS, () => handleDismissSidebars(), {
    enabled: isFormBuilder,
  });
};
