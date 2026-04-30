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
import { useState } from "react";
import { toast } from "sonner";
import { LogoToggle } from "./logo";
import { useSidebarSafe } from "./sidebar";

interface AppHeaderProps {
  isDistractionHidden?: boolean;
}

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
  const { pathname } = useLocation();
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
  type ActiveDialog = "delete" | "discard" | null;
  type ActiveMenu = "main" | "local" | null;
  const [workflowState, setWorkflowState] = useState<WorkflowState>("idle");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);

  const isDiscarding = workflowState === "discarding";
  const isPublishing = workflowState === "publishing";

  useIsFavorite(session?.user?.id, formId);

  const handleToggleFavorite = async () => {
    if (!session?.user?.id || !formId) return;
    await toggleFavoriteLocal(session.user.id, formId);
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

  const handleEditForm = () => {
    if (workspaceId && formId) {
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId, formId },
        search: (prev: Record<string, unknown>) => ({ ...prev, force: true }),
      });
    }
  };

  useHotkey(HOTKEYS.EDIT_FORM, () => handleEditForm(), {
    enabled: isFormBuilder && !isEditRoute && !!workspaceId && !!formId,
  });

  useHotkey(HOTKEYS.TOGGLE_PREVIEW, () => togglePreview(), {
    enabled: (isFormBuilder && isEditRoute) || isLandingPage,
  });

  useHotkey(HOTKEYS.TOGGLE_SHARE_SIDEBAR, () => toggleShareSidebar(), {
    enabled: isFormBuilder && isEditRoute && canShare,
  });

  const isLeftSidebarOpen = state === "expanded";

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

  useHotkey(HOTKEYS.DISMISS_SIDEBARS, () => handleDismissSidebars(), {
    enabled: isFormBuilder,
  });

  const menuItems = [
    {
      key: "favorite",
      label: "Favorite",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_FAVORITE),
      onClick: () => handleToggleFavorite(),
    },
    {
      key: "analytics",
      label: "Analytics",
      onClick: () => {
        if (workspaceId && formId) {
          void navigate({
            to: "/workspace/$workspaceId/form-builder/$formId/insights",
            params: { workspaceId, formId },
          });
        }
      },
    },
    {
      key: "customization",
      label: "Customization",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_CUSTOMIZE_SIDEBAR),
      onClick: () => toggleCustomizeSidebar(),
      show: isEditRoute,
    },
    {
      key: "versionHistory",
      label: "Version History",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_VERSION_HISTORY),
      onClick: () => toggleVersionHistory(),
      show: isEditRoute && hasPublishedVersion,
    },
    // Share + Settings buttons are hidden from the header on mobile. Surface
    // them in the menu only when the header button isn't visible — no
    // duplicate entry point on desktop.
    {
      key: "share",
      label: "Share",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_SHARE_SIDEBAR),
      onClick: () => toggleShareSidebar(),
      show: isMobile && canShare,
    },
    {
      key: "settings",
      label: "Settings",
      shortcut: formatForDisplay(HOTKEYS.TOGGLE_SETTINGS_SIDEBAR),
      onClick: () => toggleSettingsSidebar(),
      show: isMobile,
    },
    // Mirror of the standalone icon buttons that are hidden on mobile. Kept
    // in the menu on desktop too so there's a single discoverable surface for
    // these actions — and so the mobile experience never loses functionality.
    {
      key: "discard",
      label: "Discard changes",
      onClick: () => setActiveDialog("discard"),
      show: hasUnpublishedChanges,
    },
    {
      key: "delete",
      label: "Delete form",
      onClick: () => setActiveDialog("delete"),
    },
  ].filter((item) => item.show ?? true);

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
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center text-sm">
              {workspace && (
                <>
                  <Link
                    to="/dashboard"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "hidden max-w-[150px] shrink truncate px-1.5 font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground md:inline-flex",
                    )}
                  >
                    <span className="truncate">{workspace.name}</span>
                  </Link>
                  <span
                    aria-hidden="true"
                    className="hidden shrink-0 px-0.5 text-muted-foreground/40 md:inline"
                  >
                    /
                  </span>
                </>
              )}
              {savedDocs?.[0].status === "published" && workspaceId && formId ? (
                <Link
                  to="/workspace/$workspaceId/form-builder/$formId/submissions"
                  params={{ workspaceId, formId }}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "max-w-[140px] min-w-0 shrink justify-start px-1.5 font-normal text-foreground hover:bg-accent/60 sm:max-w-[200px]",
                  )}
                >
                  <span className="truncate">{savedDocs?.[0].title || "Untitled"}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "max-w-[140px] min-w-0 shrink cursor-default justify-start px-1.5 font-normal hover:bg-transparent sm:max-w-[200px]",
                  )}
                >
                  <span className="truncate">{savedDocs?.[0].title || "Untitled"}</span>
                </span>
              )}
              {!isEditorSidebarOpen && (
                <>
                  <span
                    aria-hidden="true"
                    className="hidden shrink-0 px-0.5 text-muted-foreground/40 lg:inline"
                  >
                    /
                  </span>
                  <span
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "hidden shrink-0 cursor-default px-1.5 font-normal text-muted-foreground hover:bg-transparent lg:inline-flex",
                    )}
                  >
                    {breadcrumbLabel}
                  </span>
                </>
              )}
            </nav>
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
                {formatDistanceToNow(parseTimestampAsUTC(savedDocs?.[0]?.updatedAt) ?? new Date())}{" "}
                ago
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                <div className="space-y-1">
                  <p className="text-xs text-background/70">
                    Edited by{" "}
                    <span className="text-background">{session?.user?.name ?? "You"}</span>{" "}
                    {formatDistanceToNow(
                      parseTimestampAsUTC(savedDocs?.[0]?.updatedAt) ?? new Date(),
                    )}{" "}
                    ago
                  </p>
                  {savedDocs?.[0]?.createdAt && (
                    <p className="text-xs text-background/70">
                      Created by{" "}
                      <span className="text-background">{session?.user?.name ?? "You"}</span>{" "}
                      {format(
                        parseTimestampAsUTC(savedDocs?.[0]?.createdAt) ?? new Date(),
                        "MMM d, yyyy",
                      )}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {isDashboard && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-2.5 font-normal text-muted-foreground hover:text-foreground",
                activeSidebar === "about" && "bg-accent/50 text-foreground",
              )}
              onClick={() => toggleEditorSidebar("about")}
            >
              About
            </Button>
          )}

          {isLandingPage && (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "px-2.5 font-normal text-muted-foreground hover:text-foreground",
                        previewMode && "bg-accent/50 text-foreground",
                      )}
                      onClick={togglePreview}
                    />
                  }
                >
                  {previewMode ? "Editor" : "Preview"}
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <p>{previewMode ? "Back to Editor" : "Preview Form"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatForDisplay(HOTKEYS.TOGGLE_PREVIEW)}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-2.5 font-normal text-muted-foreground hover:text-foreground",
                  activeSidebar === "about" && "bg-accent/50 text-foreground",
                )}
                onClick={() => toggleEditorSidebar("about")}
              >
                About
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => toggleEditorSidebar("settings")}
                aria-label="Settings"
              >
                <SettingsIcon fill="transparent" />
              </Button>
              <DropdownMenu
                open={activeMenu === "local"}
                onOpenChange={(open) => setActiveMenu(open ? "local" : null)}
              >
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label="More options"
                    />
                  }
                >
                  <MoreHorizontalIcon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
                  <DropdownMenuItem onClick={() => toggleEditorSidebar("customize")}>
                    <span className="flex-1 text-left">Customization</span>
                    <DropdownMenuShortcut>
                      {formatForDisplay(HOTKEYS.TOGGLE_CUSTOMIZE_SIDEBAR)}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/login" })}>
                    <span className="flex-1 text-left">Sign in</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                className="ml-1 rounded-[8px] border-none bg-black py-1.5 pr-2 pl-2.5 text-[14px] text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                onClick={() => navigate({ to: "/login" })}
              >
                Publish
              </Button>
            </>
          )}

          {isFormBuilder && (
            <>
              {hasUnpublishedChanges && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hidden h-7 w-7 text-muted-foreground hover:text-foreground md:inline-flex"
                        onClick={() => setActiveDialog("discard")}
                        disabled={isDiscarding}
                      />
                    }
                  >
                    {isDiscarding ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <RotateCcwIcon className="h-4 w-4" strokeWidth={2} />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset to last published version</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center gap-1">
                {isEditRoute && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "px-2.5 font-normal text-muted-foreground hover:text-foreground",
                            previewMode && "bg-accent/50 text-foreground",
                          )}
                          onClick={togglePreview}
                        />
                      }
                    >
                      {previewMode ? "Editor" : "Preview"}
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      <p>{previewMode ? "Back to Editor" : "Preview Form"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatForDisplay(HOTKEYS.TOGGLE_PREVIEW)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}

                {canShare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "hidden px-2.5 font-normal text-muted-foreground hover:text-foreground md:inline-flex",
                      isShareSidebarOpen && "bg-accent/50 text-foreground",
                    )}
                    onClick={() => toggleShareSidebar()}
                  >
                    Share
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
                  aria-label="Settings"
                  onClick={() => toggleSettingsSidebar()}
                >
                  <SettingsIcon fill="transparent" />
                </Button>

                <DropdownMenu
                  open={activeMenu === "main"}
                  onOpenChange={(open) => setActiveMenu(open ? "main" : null)}
                >
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-sidebar-active mr-1 overflow-hidden rounded-lg p-[5px] text-muted-foreground hover:text-foreground"
                        aria-label="More options"
                      />
                    }
                  >
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
                    {menuItems.map((item) => (
                      <DropdownMenuItem key={item.key} onClick={() => item.onClick()}>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.shortcut && (
                          <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {isEditRoute || hasUnpublishedChanges ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="sm"
                        className={cn(
                          "ml-1 rounded-[8px] border-none py-1.5 pr-2 pl-2 text-[14px] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all",
                          !isLoadingSavedDocs &&
                            (hasUnpublishedChanges || savedDocs?.[0]?.status !== "published")
                            ? "bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                            : "bg-muted text-muted-foreground hover:bg-muted/80",
                        )}
                        onClick={handlePublish}
                        disabled={
                          isPublishing ||
                          (!hasUnpublishedChanges && savedDocs?.[0]?.status === "published")
                        }
                      />
                    }
                  >
                    {isPublishing ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : savedDocs?.[0]?.status === "published" && !hasUnpublishedChanges ? (
                      "Published"
                    ) : (
                      "Publish"
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    <p className="text-xs text-muted-foreground">
                      {formatForDisplay(HOTKEYS.PUBLISH_FORM)}
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
                          params={() => ({ workspaceId, formId })}
                          search={(prev) => ({ ...prev, force: true })}
                          aria-label="Edit form"
                          className={cn(
                            buttonVariants({ size: "sm" }),
                            "ml-1 rounded-lg border-none bg-black text-base text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-all hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200",
                          )}
                        />
                      }
                    >
                      <span data-icon="inline-start" className="shrink-0 [&_svg]:size-[1em]!">
                        <PencilIcon />
                      </span>
                      Edit
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      <p className="text-xs text-muted-foreground">
                        {formatForDisplay(HOTKEYS.EDIT_FORM)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              )}
            </>
          )}
        </div>
      </header>

      <AlertDialog
        open={activeDialog === "delete"}
        onOpenChange={(open) => setActiveDialog(open ? "delete" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this form? This action will move it to trash and
              cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteForm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={activeDialog === "discard"}
        onOpenChange={(open) => setActiveDialog(open ? "discard" : null)}
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
                void handleDiscardChanges();
                setActiveDialog(null);
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
};
