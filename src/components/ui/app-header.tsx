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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckIcon,
  ChevronRightIcon,
  EditLineSmIcon,
  FolderIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlayIcon,
} from "@/components/ui/icons";
import { FigAddSmIcon } from "@/components/dashboard/dashboard-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TextSwap } from "@/components/transitions/text-swap";
import { useProPublishGate } from "@/components/form-builder/pro-publish-gate";
import type { PublishOptions } from "@/components/form-builder/pro-publish-gate";
import { toggleFavoriteLocal, createFormLocal, updateFormStatus } from "@/collections";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import { sortByManualOrder } from "@/lib/sort-utils";
import {
  discardChanges,
  publishForm,
  publishFormSettings,
  useFormPublishStatus,
  useHasUnpublishedChanges,
} from "@/hooks/use-form-versions";
import { parseError } from "@/lib/errors/parse";
import { useForm, useIsFavorite, useOrgWorkspaces, useWorkspace } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { HOTKEYS, formatForDisplay } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { log } from "evlog";
import { useGlimm } from "glimm/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LogoToggle } from "./logo";
import { useSidebarSafe } from "./sidebar";

interface AppHeaderProps {
  isDistractionHidden?: boolean;
}

// Header icon buttons (⋯, preview, edit): 28×28, 5px padding, 8px radius, gray-800 icon (Figma system-flat).
// Color lives here so hover:text-foreground reaches the icon via currentColor — icons must NOT pin their own color.
const HEADER_ICON_BUTTON_CLS = "size-7 rounded-lg p-1.25 text-gray-800 hover:text-foreground";

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
  const isTemplatesRoute = pathname === "/templates" || pathname.startsWith("/templates/");
  const isLandingPage = pathname === "/";
  const isFormBuilder = pathname.startsWith("/form-builder") || pathname.includes("/form-builder/");
  const isEditRoute = pathname.endsWith("/edit");
  const isSettingsRoute = pathname.endsWith("/settings");
  const isSubmissionsRoute = pathname.endsWith("/submissions");
  const isAnalyticsRoute = pathname.endsWith("/analytics");
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
  // Form-level settings is a full page (not the right sidebar). Navigate there.
  const toggleSettingsSidebar = () => {
    if (workspaceId && formId) {
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/settings",
        params: { workspaceId, formId },
      });
    }
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
    proPublishDialog,
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

  // Preview (▷) is always shown. On /edit it toggles the inline preview drawer; elsewhere
  // (e.g. submissions) there's no drawer, so it enters preview and navigates into the editor.
  const handlePreviewForm = () => {
    if (isEditRoute) {
      togglePreview();
      return;
    }
    if (workspaceId && formId) {
      enterPreview();
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId, formId },
        search: { force: true },
      });
    }
  };

  const menuItems = buildFormBuilderMenuItems({
    isEditRoute,
    hasPublishedVersion,
    workspaceId,
    formId,
    onNavigateInsights: () => {
      if (workspaceId && formId) {
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/analytics",
          params: { workspaceId, formId },
        });
      }
    },
    onToggleVersionHistory: toggleVersionHistory,
    onToggleCustomizeSidebar: toggleCustomizeSidebar,
    onToggleSettingsSidebar: toggleSettingsSidebar,
    onSetActiveDialog: setActiveDialog,
  });

  return (
    <>
      <header
        className={cn(
          "group/header -z-10 flex h-11 w-full shrink-0 items-center justify-between bg-background pr-2 pl-4 text-[13px] transition-opacity duration-150 select-none",
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
          {isDashboard && (
            <span className="inline-flex items-center rounded-lg p-1 text-base font-[450] tracking-[0.14px] text-gray-800">
              Home
            </span>
          )}
          {isTemplatesRoute && (
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-base">
              <Link
                to="/dashboard"
                className="rounded-lg p-1 font-[450] tracking-[0.14px] text-gray-500 hover:text-foreground"
              >
                Home
              </Link>
              <span aria-hidden className="shrink-0 px-0.5 text-gray-400">
                /
              </span>
              <Link
                to="/templates"
                className="rounded-lg p-1 font-[450] tracking-[0.14px] text-gray-800 hover:text-foreground"
              >
                Templates
              </Link>
            </nav>
          )}
          {isFormBuilder && savedDocs?.[0] && (
            <HeaderBreadcrumb
              workspace={workspace}
              savedDoc={savedDocs[0]}
              workspaceId={workspaceId}
              formId={formId}
              isEditRoute={isEditRoute}
              isSettingsRoute={isSettingsRoute}
              isSubmissionsRoute={isSubmissionsRoute}
              isAnalyticsRoute={isAnalyticsRoute}
            />
          )}
        </div>

        {/* Header stays constant — preview now lives in its own full-page drawer, so the
            Share sidebar no longer collapses it to a "Preview" label or hides actions. */}
        <div className="flex shrink-0 items-center gap-2">
          {isDashboard && <DashboardHeaderActions />}

          {isLandingPage && (
            <LandingPageActions
              previewMode={previewMode}
              activeMenu={activeMenu}
              onTogglePreview={togglePreview}
              onToggleEditorSidebar={toggleEditorSidebar}
              onSetActiveMenu={setActiveMenu}
              onSignIn={() => navigate({ to: "/login" })}
            />
          )}

          {isFormBuilder &&
            (isSettingsRoute ? (
              // Settings page: hide editor actions, show only a settings-only Save (Figma 26095-19007).
              <SettingsHeaderActions formId={formId} />
            ) : (
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
                onTogglePreview={handlePreviewForm}
                onToggleShareSidebar={toggleShareSidebar}
                onPublish={handlePublish}
                onSetActiveMenu={setActiveMenu}
              />
            ))}
        </div>
      </header>

      <AppHeaderDialogs
        activeDialog={activeDialog}
        onDialogChange={setActiveDialog}
        onDeleteForm={handleDeleteForm}
        onDiscardChanges={handleDiscardChanges}
      />
      {proPublishDialog}
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
  handleCloseSidebar: () => void;
  toggleMainSidebar: () => void;
  toggleShareSidebar: () => void;
  setWorkflowState: (state: "idle" | "publishing" | "discarding") => void;
}

// Figma `system-flat` 26701:11571 — dark pill toast, centered along the bottom.
const showPublishedToast = () =>
  toast.custom(
    () => (
      <div className="flex items-center gap-1.5 rounded-[8px] bg-[#171717] py-2 pr-3 pl-2.5 text-white elevation-md">
        <CheckIcon className="size-4" />
        <span className="text-base">Changes Published</span>
      </div>
    ),
    { position: "bottom-center" },
  );

const useAppHeaderFormActions = ({
  formId,
  workspaceId,
  sessionUserId,
  isEditorSidebarOpen,
  isLeftSidebarOpen,
  navigate,
  handleCloseSidebar,
  toggleMainSidebar,
  toggleShareSidebar,
  setWorkflowState,
}: UseAppHeaderFormActionsOptions) => {
  const { sweep } = useGlimm();

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

  // Soft Pro gate: free drafts can hold Pro styles; publishing asks upgrade-or-strip first.
  const { guardPublish, proPublishDialog } = useProPublishGate(formId);

  const performPublish = async ({ stripProStyles }: PublishOptions) => {
    if (!formId || !workspaceId) return;
    setWorkflowState("publishing");
    // Sweep fires on click for instant feedback; glimm awaits the midpoint
    // callback, so the band holds at peak coverage until publish resolves,
    // then fades out — no navigation, stay on the editor.
    const handle = sweep(
      async () => {
        try {
          const tx = publishForm(formId, { stripProStyles });
          // Capture the content thumbnail during the publish round-trip; canvas stays mounted (no
          // nav). Dynamic import keeps the browser-only capture lib + its server-fn out of SSR.
          const previewPromise = import("@/lib/og/capture-form-preview")
            .then((m) => m.captureAndUploadFormPreview(formId))
            .catch((error) =>
              log.error({ tag: "app-header", msg: "preview capture failed", error }),
            );
          await tx.isPersisted.promise;
          showPublishedToast();
          // Best-effort: thumbnail (card preview + OG) finishes in the background. Never faults publish.
          void previewPromise;
        } catch (error) {
          toast.error("Failed to publish form");
          log.error({ tag: "app-header", msg: "publish form failed", error });
        }
      },
      { palette: "prism" },
    );
    try {
      await handle.done;
    } finally {
      // Always clear the spinner, even if the sweep promise rejects/never settles cleanly.
      setWorkflowState("idle");
    }
  };

  const handlePublish = () => guardPublish((opts) => void performPublish(opts));

  const handleDiscardChanges = async () => {
    if (formId) {
      setWorkflowState("discarding");
      try {
        await discardChanges(formId);
        toast.info("Changes discarded, reverted to last published version");
      } catch (error) {
        toast.error("Failed to discard changes");
        log.error({ tag: "app-header", msg: "discard changes failed", error });
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
    proPublishDialog,
    handleDiscardChanges,
    handleEditForm,
    handleDismissSidebars,
  };
};

interface BuildFormBuilderMenuItemsOptions {
  isEditRoute: boolean;
  hasPublishedVersion: boolean;
  workspaceId: string | undefined;
  formId: string | undefined;
  onNavigateInsights: () => void;
  onToggleVersionHistory: () => void;
  onToggleCustomizeSidebar: () => void;
  onToggleSettingsSidebar: () => void;
  onSetActiveDialog: (dialog: ActiveDialog) => void;
}

// Overflow menu for the form-builder header (the ⋯ button). Customize lives here now
// (palette button removed); Share moved out to a standalone header text button.
const buildFormBuilderMenuItems = ({
  isEditRoute,
  hasPublishedVersion,
  onNavigateInsights,
  onToggleVersionHistory,
  onToggleCustomizeSidebar,
  onToggleSettingsSidebar,
  onSetActiveDialog,
}: BuildFormBuilderMenuItemsOptions): MenuItem[] =>
  // Order follows Figma (node 25300-1772): Analytics · Settings · Customize · Version history · Delete.
  [
    {
      key: "analytics",
      label: "Analytics",
      onClick: onNavigateInsights,
      // Analytics is empty until first publish, and /insights for an unpublished form crashes
      // the Recharts bundle — gate on the same flag as share + version history.
      show: hasPublishedVersion,
    },
    {
      key: "settings",
      label: "Settings",
      onClick: onToggleSettingsSidebar,
    },
    {
      key: "customize",
      label: "Customize",
      onClick: onToggleCustomizeSidebar,
      show: isEditRoute,
    },
    {
      key: "versionHistory",
      label: "Version history",
      onClick: onToggleVersionHistory,
      show: isEditRoute && hasPublishedVersion,
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
  isSettingsRoute?: boolean;
  isSubmissionsRoute?: boolean;
  isAnalyticsRoute?: boolean;
}

const HeaderBreadcrumb = ({
  workspace,
  savedDoc,
  workspaceId,
  formId,
  isEditRoute,
  isSettingsRoute,
  isSubmissionsRoute,
  isAnalyticsRoute,
}: HeaderBreadcrumbProps) => {
  const titleText = savedDoc.title || "Untitled";
  const linkClassName = cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "max-w-[140px] min-w-0 shrink justify-start px-1.5 text-[14px] font-medium text-gray-800 hover:bg-accent/60 sm:max-w-[200px]",
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
              "hidden max-w-[150px] shrink truncate px-1.5 text-[14px] font-medium text-gray-500 hover:bg-accent/60 hover:text-foreground md:inline-flex",
            )}
          >
            <span className="truncate">{workspace.name}</span>
          </Link>
          <span
            aria-hidden="true"
            className="hidden shrink-0 px-0.5 text-[16px] text-gray-500 md:inline"
          >
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
            "max-w-[140px] min-w-0 shrink cursor-default justify-start px-1.5 text-[14px] font-medium text-gray-800 hover:bg-transparent sm:max-w-[200px]",
          )}
        >
          <span className="truncate">{titleText}</span>
        </span>
      )}
      {(isSettingsRoute || isSubmissionsRoute || isAnalyticsRoute) && (
        <>
          <span
            aria-hidden="true"
            className="hidden shrink-0 px-0.5 text-[16px] text-gray-500 sm:inline"
          >
            /
          </span>
          <span
            aria-current="page"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden shrink-0 cursor-default px-1.5 text-[14px] font-medium text-gray-800 hover:bg-transparent sm:inline-flex",
            )}
          >
            {isSettingsRoute ? "Settings" : isSubmissionsRoute ? "Submissions" : "Analytics"}
          </span>
        </>
      )}
    </nav>
  );
};

interface LandingPageActionsProps {
  previewMode: boolean;
  activeMenu: ActiveMenu;
  onTogglePreview: () => void;
  onToggleEditorSidebar: (id: "about" | "settings" | "customize") => void;
  onSetActiveMenu: (menu: ActiveMenu) => void;
  onSignIn: () => void;
}

// Settings-route header: a single settings-only Save (commits draftSettings → live form_settings
// without publishing content). Disabled when nothing changed — dirty via the same flag the global
// Publish uses (now reliable: _getFormById carries liveSettings, so no listing load-order race).
const SettingsHeaderActions = ({ formId }: { formId: string | undefined }) => {
  const { hasSettingsChanges } = useFormPublishStatus(formId);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!formId || !hasSettingsChanges || saving) return;
    setSaving(true);
    try {
      const tx = publishFormSettings(formId);
      await tx.isPersisted.promise;
      toast.success("Settings saved");
    } catch (error) {
      toast.error(parseError(error).message || "Couldn't save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button
      size="sm"
      disabled={!hasSettingsChanges || saving}
      onClick={onSave}
      className="rounded-[8px] border-none bg-neutral-950 py-1.5 pr-2 pl-2.5 text-[14px] font-medium text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-stone-200"
    >
      {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}
    </Button>
  );
};

const LandingPageActions = ({
  previewMode,
  activeMenu,
  onTogglePreview,
  onToggleEditorSidebar,
  onSetActiveMenu,
  onSignIn,
}: LandingPageActionsProps) => (
  <>
    {/* ⋯ overflow menu — houses About + Settings + Customize (Figma layout: ⋯ · ▷ · Publish) */}
    <DropdownMenu
      open={activeMenu === "local"}
      onOpenChange={(open) => onSetActiveMenu(open ? "local" : null)}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost-flat"
            size="sm"
            className={HEADER_ICON_BUTTON_CLS}
            aria-label="More options"
          />
        }
      >
        <MoreHorizontalIcon className="size-[18px]" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
        <DropdownMenuItem onClick={() => onToggleEditorSidebar("about")}>
          <span className="flex-1 text-left">About</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleEditorSidebar("settings")}>
          <span className="flex-1 text-left">Settings</span>
          <DropdownMenuShortcut>
            {formatForDisplay(HOTKEYS.TOGGLE_SETTINGS_SIDEBAR)}
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggleEditorSidebar("customize")}>
          <span className="flex-1 text-left">Customize</span>
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
    {/* Preview — play icon (Figma system-flat) */}
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost-flat"
            size="sm"
            className={cn(HEADER_ICON_BUTTON_CLS, previewMode && "bg-secondary text-foreground")}
            onClick={onTogglePreview}
            aria-label={previewMode ? "Back to Editor" : "Preview Form"}
          />
        }
      >
        <PlayIcon className="size-[18px]" />
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <p>{previewMode ? "Back to Editor" : "Preview Form"}</p>
      </TooltipContent>
    </Tooltip>
    {/* Publish */}
    <Button
      size="sm"
      className="rounded-[8px] border-none bg-neutral-950 py-1.5 pr-2 pl-2.5 text-[14px] font-medium text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
      onClick={onSignIn}
    >
      Publish
    </Button>
  </>
);

// Dashboard header actions (Figma 26208:8017): Search field (writes /dashboard?q=, debounced) +
// New Form button (Figma 26247:7573). One simple button: with a single workspace it creates
// straight in the default (top) workspace; with multiple it opens a picker dialog first.
// Renders only on /dashboard.
const DashboardHeaderActions = () => {
  const navigate = useNavigate();
  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });
  const { data: liveWorkspaces } = useOrgWorkspaces(activeOrg?.id);

  const orderedWorkspaces = useMemo(
    () =>
      sortByManualOrder(
        liveWorkspaces ?? [],
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [liveWorkspaces],
  );

  const topWorkspace = orderedWorkspaces[0];
  const hasMultipleWorkspaces = orderedWorkspaces.length > 1;
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);

  const handleCreateForm = (workspaceId?: string) => {
    const targetId = workspaceId ?? topWorkspace?.id;
    if (!targetId) return;
    const { form: newForm } = createFormLocal(targetId);
    void navigate({
      to: "/workspace/$workspaceId/form-builder/$formId/edit",
      params: { workspaceId: targetId, formId: newForm.id },
    });
  };

  // One button: multiple workspaces → ask which one first; otherwise create in the default workspace.
  const handleNewForm = () => {
    if (hasMultipleWorkspaces) {
      setWorkspaceDialogOpen(true);
      return;
    }
    handleCreateForm();
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    setWorkspaceDialogOpen(false);
    handleCreateForm(workspaceId);
  };

  return (
    <div className="flex items-center gap-2">
      {/* New Form — Figma 26247:7573 (dark primary #141414, add-sm icon, 28px tall, 8px/10px padding,
          8px radius). Search moved into the All Forms toolbar (dashboard route). */}
      <Button
        size="sm"
        prefix={<FigAddSmIcon className="size-4" />}
        className="rounded-[8px] ps-2! font-case text-base tracking-[0.14px]"
        onClick={handleNewForm}
      >
        New Form
      </Button>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
            <DialogDescription>Choose a workspace for your new form.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-1">
            {orderedWorkspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSelectWorkspace(ws.id)}
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-base font-[450] tracking-[0.14px] text-gray-800">
                  {ws.name}
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

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
  onPublish: () => Promise<void> | void;
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
  onPublish,
  onSetActiveMenu,
}: FormBuilderHeaderActionsProps) => {
  const {
    isEditRoute,
    hasUnpublishedChanges,
    isPublishing,
    previewMode,
    canShare,
    isShareSidebarOpen,
    isLoadingSavedDocs,
  } = flags;
  const showPublish = workspaceId && formId;
  const isUnpublished =
    !isLoadingSavedDocs && (hasUnpublishedChanges || savedDocs?.[0]?.status !== "published");

  // Figma logged-in header: ⋯ · ▷ (preview) · Share · Publish. Customize/Settings/
  // Version history/Discard live in the ⋯ menu.
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu
        open={activeMenu === "main"}
        onOpenChange={(open) => onSetActiveMenu(open ? "main" : null)}
      >
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost-flat"
              size="sm"
              className={cn(HEADER_ICON_BUTTON_CLS, "aria-expanded:bg-secondary")}
              aria-label="More options"
            />
          }
        >
          <MoreHorizontalIcon className="size-[18px]" strokeWidth={1.5} />
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

      {/* Preview (▷) — always shown (Figma 26835-9771). On /edit it toggles the inline preview;
          elsewhere it enters preview and navigates into the editor (handled by onTogglePreview). */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost-flat"
              size="sm"
              className={cn(
                HEADER_ICON_BUTTON_CLS,
                // Share opening enters preview for its inline pane — don't light up the play button for that.
                previewMode && !isShareSidebarOpen && "bg-secondary text-foreground",
              )}
              onClick={onTogglePreview}
              aria-label={previewMode && !isShareSidebarOpen ? "Back to Editor" : "Preview Form"}
            />
          }
        >
          <PlayIcon className="size-[18px]" />
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <p>{previewMode && !isShareSidebarOpen ? "Back to Editor" : "Preview Form"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Always shown; disabled until published, and while the Share tab is open (it's a trigger only —
          the tab's own ✕ closes it). */}
      <Button
        variant="ghost-flat"
        size="sm"
        className="hidden rounded-lg px-2 py-1.5 text-[14px] font-medium tracking-[0.14px] text-foreground hover:text-foreground md:inline-flex"
        onClick={onToggleShareSidebar}
        disabled={!canShare || isShareSidebarOpen}
        title={canShare ? undefined : "Publish your form to share it"}
      >
        Share
      </Button>

      {/* Primary CTA: on /edit, Publish. Elsewhere (submissions), an "Edit form" button — you can
          only publish from inside the editor (Figma 26835-9771). */}
      {isEditRoute
        ? showPublish && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    className={cn(
                      "rounded-[8px] border-none py-1.5 pr-2 pl-2.5 text-[14px] font-medium shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all",
                      isUnpublished
                        ? "bg-neutral-950 text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
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
                {/* Always "Publish" — the disabled + muted state alone signals already-published. */}
                {isPublishing ? (
                  <Loader2Icon className="size-4 animate-spin" />
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
          )
        : workspaceId &&
          formId && (
            <Link
              to="/workspace/$workspaceId/form-builder/$formId/edit"
              params={{ workspaceId, formId }}
              search={(prev: Record<string, unknown>) => ({ ...prev, force: true })}
              preload="intent"
              aria-label="Edit form"
              // Figma 26835:9809 — gray/950 #141414 pill, px-8/py-6, gap-6, 16px edit icon + 14px/450 white.
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-gray-950 px-2 py-1.5 font-case text-[14px] font-[450] tracking-[0.14px] text-white transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-white dark:text-black dark:hover:bg-stone-200"
            >
              <EditLineSmIcon className="size-4" />
              Edit form
            </Link>
          )}
    </div>
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
