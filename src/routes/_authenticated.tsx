import { ThemedFormIcon } from "@/components/icon-picker/icon-picker-preview";
import { SidebarItem } from "@/components/sidebar-item";
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
import { AppHeader } from "@/components/ui/app-header";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  Loader2Icon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  Trash2Icon,
  Undo2Icon,
  UsersIcon,
  XIcon,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import Loader from "@/components/ui/loader";
import { LogoToggle } from "@/components/ui/logo";
import { NotFound } from "@/components/ui/not-found";
import {
  RIGHT_SIDEBAR_WIDTH_DEFAULT,
  RIGHT_SIDEBAR_WIDTH_KEY,
  RIGHT_SIDEBAR_WIDTH_MAX,
  RIGHT_SIDEBAR_WIDTH_MIN,
  RightSidebarResizeHandle,
} from "@/components/ui/right-sidebar-resize-handle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarSection, SidebarSectionResetProvider } from "@/components/ui/sidebar-section";
import { UserMenuMinimal } from "./_authenticated/-components/user-menu-minimal";
import type { WorkspaceWithForms } from "./_authenticated/-components/workspace-item-minimal";
import { WorkspaceItemMinimal } from "./_authenticated/-components/workspace-item-minimal";
import {
  EditorHeaderVisibilityProvider,
  useEditorHeaderVisibility,
} from "@/contexts/editor-header-visibility-context";
import { MinimalSidebarProvider, useMinimalSidebar } from "@/contexts/minimal-sidebar-context";
import { Search as LucideSearch } from "lucide-react";
import {
  createFormLocal,
  createWorkspaceLocal,
  deleteWorkspaceLocal,
  initCollections,
  isInitialized as isCollectionsInitialized,
  bulkPermanentDeleteFormsLocal,
  permanentDeleteFormLocal,
  reorderFavoriteLocal,
  reorderFormLocal,
  reorderWorkspaceLocal,
  restoreFormLocal,
  toggleFavoriteLocal,
  updateFormStatus,
  updateWorkspaceName,
} from "@/collections";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileRightDrawer } from "@/components/ui/mobile-right-drawer";
import {
  useArchivedForms,
  useFavoriteForms,
  useOrgForms,
  useOrgWorkspaces,
  useSubmissionCounts,
} from "@/hooks/use-live-hooks";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { auth, useSession } from "@/lib/auth/auth-client";
import {
  addFavorite,
  getFavorites as getFavoritesServer,
  removeFavorite,
  reorderFavorite,
} from "@/lib/server-fn/favorites";
import { getFormVersionContent, getFormVersions } from "@/lib/server-fn/form-versions";
import {
  createForm,
  bulkArchiveForms,
  bulkDeleteForms,
  deleteForm,
  getFormListings as getFormListingsServer,
  updateForm,
} from "@/lib/server-fn/forms";
import { useDuplicateForm } from "@/hooks/use-duplicate-form";
import { useSubmissionNotifications } from "@/hooks/use-submission-notifications";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import {
  workspacesCollectionQueryOptions,
  formListingsCollectionQueryOptions,
  favoritesCollectionQueryOptions,
} from "@/lib/server-fn/query-options";
import { getSubmissionsCount } from "@/lib/server-fn/submissions";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  reorderWorkspace,
  updateWorkspace,
} from "@/lib/server-fn/workspaces";
import { HOTKEYS } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { authMiddleware } from "@/lib/auth/middleware";
import { formatForDisplay, useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useLocation, useParams, useRouter } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { generateKeyBetween } from "fractional-indexing";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateOrderedIndexes, getLeadingSortIndex, sortByManualOrder } from "@/lib/sort-utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import type * as React from "react";
import { Activity, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { toast } from "sonner";

const LazySettingsDialog = lazy(() =>
  import("./_authenticated/-components/settings/settings-dialog").then((m) => ({
    default: m.SettingsDialog,
  })),
);
const LazyFormSettingsSidebar = lazy(() =>
  import("@/components/form-builder/form-settings-sidebar").then((m) => ({
    default: m.FormSettingsSidebar,
  })),
);
const LazyShareSummarySidebar = lazy(() =>
  import("@/components/form-builder/share-summary-sidebar").then((m) => ({
    default: m.ShareSummarySidebar,
  })),
);
const LazyVersionHistorySidebar = lazy(() =>
  import("@/components/form-builder/version-history-sidebar").then((m) => ({
    default: m.VersionHistorySidebar,
  })),
);
const LazyCustomizeSidebar = lazy(() =>
  import("@/components/ui/customize-sidebar").then((m) => ({
    default: m.CustomizeSidebar,
  })),
);

/**
 * Keeps each sidebar's React tree alive across activeSidebar toggles via
 * <Activity>, so switching settings ↔ share ↔ customize doesn't remount the
 * TanStack Form, lose scroll position, or reset transient field-level state.
 *
 * Per-sidebar epoch counters increment on every hidden→visible transition
 * and feed `SidebarSectionResetProvider`. Each `<SidebarSection>` consumes
 * that epoch as a `key` on its inner Accordion only — so reopening a sidebar
 * resets the expanded/collapsed state of all sections back to `initialOpen`
 * while everything above the Accordion (form provider, scroll container)
 * stays mounted. Best of both: cheap reopen, predictable expanded state.
 *
 * `key={formId}` on the inner sidebar ensures a hard remount when the user
 * navigates between forms, since per-sidebar form state is form-specific.
 *
 * `history` is excluded from the persistence path — it's a one-shot
 * view/restore action and rarely toggled.
 */
const PersistentSidebars = ({
  activeSidebar,
  formId,
}: {
  activeSidebar: ReturnType<typeof useEditorSidebar>["activeSidebar"];
  formId: string | undefined;
}) => {
  const showSettings = activeSidebar === "settings";
  const showShare = activeSidebar === "share";
  const showCustomize = activeSidebar === "customize";

  const [openedSettings, setOpenedSettings] = useState(showSettings);
  const [openedShare, setOpenedShare] = useState(showShare);
  const [openedCustomize, setOpenedCustomize] = useState(showCustomize);

  if (showSettings && !openedSettings) setOpenedSettings(true);
  if (showShare && !openedShare) setOpenedShare(true);
  if (showCustomize && !openedCustomize) setOpenedCustomize(true);

  const [settingsEpoch, setSettingsEpoch] = useState(0);
  const [shareEpoch, setShareEpoch] = useState(0);
  const [customizeEpoch, setCustomizeEpoch] = useState(0);
  const wasShowingSettings = useRef(showSettings);
  const wasShowingShare = useRef(showShare);
  const wasShowingCustomize = useRef(showCustomize);
  useEffect(() => {
    if (showSettings && !wasShowingSettings.current) setSettingsEpoch((e) => e + 1);
    wasShowingSettings.current = showSettings;
  }, [showSettings]);
  useEffect(() => {
    if (showShare && !wasShowingShare.current) setShareEpoch((e) => e + 1);
    wasShowingShare.current = showShare;
  }, [showShare]);
  useEffect(() => {
    if (showCustomize && !wasShowingCustomize.current) setCustomizeEpoch((e) => e + 1);
    wasShowingCustomize.current = showCustomize;
  }, [showCustomize]);

  return (
    <>
      {openedSettings && (
        <SidebarSectionResetProvider value={settingsEpoch}>
          <Activity mode={showSettings ? "visible" : "hidden"}>
            {formId && <LazyFormSettingsSidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
      {openedShare && (
        <SidebarSectionResetProvider value={shareEpoch}>
          <Activity mode={showShare ? "visible" : "hidden"}>
            {formId && <LazyShareSummarySidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
      {activeSidebar === "history" && formId && <LazyVersionHistorySidebar formId={formId} />}
      {openedCustomize && (
        <SidebarSectionResetProvider value={customizeEpoch}>
          <Activity mode={showCustomize ? "visible" : "hidden"}>
            {formId && <LazyCustomizeSidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
    </>
  );
};

const formatNotificationTime = (value: string) =>
  formatDistanceToNow(new Date(value), {
    addSuffix: true,
  });

const initCollectionsOnClient = createClientOnlyFn((queryClient: QueryClient) => {
  if (isCollectionsInitialized()) return;

  initCollections(queryClient, {
    getWorkspacesWithForms: async () => {
      const result = await getWorkspaces();
      return {
        workspaces: result.workspaces.map(
          // oxlint-disable-next-line typescript-eslint/no-explicit-any -- server type bridge
          (ws: any) => ({
            ...ws,
            forms: [],
          }),
        ),
      };
    },
    getFormListings: () => getFormListingsServer(),
    getFormDetail: async (formId: string) => {
      const { getFormbyIdQueryOption } = await import("@/lib/server-fn/forms");
      const result = await queryClient.ensureQueryData(getFormbyIdQueryOption(formId));
      // oxlint-disable-next-line typescript-eslint/no-explicit-any -- server type bridge
      return (result as { form?: any })?.form ?? null;
    },
    getFavorites: () => getFavoritesServer(),
    getVersionList: async (formId: string) => {
      const result = await getFormVersions({ data: { formId } });
      return result.versions;
    },
    getVersionContent: async (versionId: string) => {
      const result = await getFormVersionContent({ data: { versionId } });
      return result.version;
    },
    getSubmissionsCount: async (formId: string) => {
      const result = await getSubmissionsCount({ data: { formId } });
      return { total: result.total };
    },
    createWorkspace: async (data) => await createWorkspace({ data: data }),
    updateWorkspace: async (data) => await updateWorkspace({ data: data }),
    deleteWorkspace: async (data) => await deleteWorkspace({ data: data }),
    createForm: async (data) => await createForm({ data: data }),
    updateForm: async (data) => await updateForm({ data: data }),
    deleteForm: async (data) => await deleteForm({ data: data }),
    bulkArchiveForms: async (data) => await bulkArchiveForms({ data: data }),
    bulkDeleteForms: async (data) => await bulkDeleteForms({ data: data }),
    addFavorite: async (data) => await addFavorite({ data }),
    removeFavorite: async (data) => await removeFavorite({ data }),
    reorderFavorite: async (data) => await reorderFavorite({ data }),
    reorderWorkspace: async (data) => await reorderWorkspace({ data }),
  });
});

const AuthLayout = () => {
  const queryClient = useQueryClient();
  initCollectionsOnClient(queryClient);
  const pathname = useLocation({ select: (s) => s.pathname });
  const isEditRoute = pathname.includes("/form-builder/") && pathname.endsWith("/edit");

  return (
    <SidebarProvider style={{ "--app-header-height": "40px" } as React.CSSProperties}>
      <EditorHeaderVisibilityProvider enabled={isEditRoute}>
        <MinimalSidebarProvider>
          <AuthLayoutContent />
        </MinimalSidebarProvider>
      </EditorHeaderVisibilityProvider>
    </SidebarProvider>
  );
};

export const Route = createFileRoute("/_authenticated")({
  server: {
    middleware: [authMiddleware],
  },
  ssr: "data-only",
  loader: async ({ context }) => {
    const [orgResult] = await Promise.all([
      context.queryClient.ensureQueryData({
        ...orgDataForLayoutQueryOptions(),
        revalidateIfStale: true,
      }),
      // Prefetch collection data using the same query keys TanStack DB will use.
      // This seeds the query cache so collections find warm data on init.
      context.queryClient.ensureQueryData(workspacesCollectionQueryOptions()),
      context.queryClient.ensureQueryData(formListingsCollectionQueryOptions()),
      context.queryClient.ensureQueryData(favoritesCollectionQueryOptions()),
    ]);
    return { activeOrg: orgResult.activeOrg, orgsData: orgResult.orgsData };
  },
  staleTime: 500000, // 500 seconds
  component: AuthLayout,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});

const AuthLayoutContent = () => {
  const pathname = useLocation({ select: (s) => s.pathname });
  const isEditRoute = pathname.includes("/form-builder/") && pathname.endsWith("/edit");
  const { visible: isHeaderVisible, reportPointerActivity } = useEditorHeaderVisibility();

  const { formId } = useParams({ strict: false });

  const { activeSidebar, closeSidebar } = useEditorSidebar();
  const isMobile = useIsMobile();

  const isFormBuilder = pathname.includes("/form-builder/");
  // "history" and "customize" sidebars are edit-route-only (derived guard replaces useEffect cleanup)
  const isEditOnlySidebar = activeSidebar === "history" || activeSidebar === "customize";
  const showEditorSidebar = !!(
    activeSidebar &&
    isFormBuilder &&
    formId &&
    (!isEditOnlySidebar || isEditRoute)
  );
  const isDistractionHeaderHidden = isEditRoute && !isHeaderVisible;

  const [rightSidebarWidth, _setRightSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return RIGHT_SIDEBAR_WIDTH_DEFAULT;
    const stored = localStorage.getItem(RIGHT_SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (
        !Number.isNaN(parsed) &&
        parsed >= RIGHT_SIDEBAR_WIDTH_MIN &&
        parsed <= RIGHT_SIDEBAR_WIDTH_MAX
      ) {
        return parsed;
      }
    }
    return RIGHT_SIDEBAR_WIDTH_DEFAULT;
  });
  const [isRightResizing, setIsRightResizing] = useState(false);

  const setRightSidebarWidth = useCallback((width: number) => {
    const clamped = Math.round(
      Math.min(RIGHT_SIDEBAR_WIDTH_MAX, Math.max(RIGHT_SIDEBAR_WIDTH_MIN, width)),
    );
    _setRightSidebarWidth(clamped);
    localStorage.setItem(RIGHT_SIDEBAR_WIDTH_KEY, String(clamped));
  }, []);

  return (
    <>
      <AppSidebar />
      <SidebarInbox />

      <SidebarInset
        className="relative flex h-screen flex-col overflow-hidden"
        data-resizing={isRightResizing ? "" : undefined}
      >
        {isDistractionHeaderHidden && (
          <div
            className="fixed inset-x-0 top-0 z-1200 h-3 bg-transparent"
            onMouseEnter={reportPointerActivity}
            aria-hidden="true"
          />
        )}
        <div className="relative z-20 flex min-h-0 flex-1 overflow-hidden">
          {/* On mobile the right sidebar is a floating overlay (a drawer),
              so we don't pad the content out — that's what made the editor
              unreadably narrow on phones. Desktop keeps the push-to-resize
              behavior users expect on wide screens. */}
          <div
            className={cn(
              "z-50 flex min-w-0 flex-1 flex-col",
              !isRightResizing && "transition-[padding] duration-200 ease-linear",
            )}
            style={{
              paddingRight: !isMobile && showEditorSidebar ? rightSidebarWidth : 0,
            }}
          >
            <div className="relative z-0 shrink-0">
              <AppHeader isDistractionHidden={isDistractionHeaderHidden} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <Outlet key={formId} />
            </div>
          </div>
        </div>

        {/* Resize handle is desktop-only — there's nothing to resize when
            the sidebar is a drawer. */}
        {showEditorSidebar && !isMobile && (
          <RightSidebarResizeHandle
            sidebarWidth={rightSidebarWidth}
            setSidebarWidth={setRightSidebarWidth}
            setIsResizing={setIsRightResizing}
          />
        )}

        {(() => {
          const rightSidebarContent = (
            <Suspense fallback={null}>
              <PersistentSidebars activeSidebar={activeSidebar} formId={formId} />
            </Suspense>
          );
          if (isMobile) {
            return (
              <MobileRightDrawer open={showEditorSidebar} onClose={closeSidebar}>
                {rightSidebarContent}
              </MobileRightDrawer>
            );
          }
          return (
            <div
              className={cn(
                "fixed top-0 right-0 bottom-0 z-40 overflow-hidden bg-background",
                !isRightResizing && "transition-[width] duration-200 ease-linear",
                "[[data-resizing]_&]:transition-none",
                showEditorSidebar && "border-l border-sidebar-border",
                !showEditorSidebar && "pointer-events-none",
              )}
              style={{
                width: showEditorSidebar ? `${rightSidebarWidth}px` : 0,
              }}
            >
              <div className="size-full">{rightSidebarContent}</div>
            </div>
          );
        })()}
      </SidebarInset>
    </>
  );
};

const AppSidebar = () => {
  const { toggleSidebar } = useSidebar();
  const { isInboxOpen, toggleInbox, closeInbox } = useMinimalSidebar();
  const isMobile = useIsMobile();
  const pathname = useLocation({ select: (s) => s.pathname });
  const router = useRouter();
  const {
    toggle: togglePalette,
    isOpen: isPaletteOpen,
    setIsOpen: setIsPaletteOpen,
  } = useCommandPalette();

  const handleOpenSettings = useCallback(() => settingsDialogStore.open(), []);

  const handleOpenTrash = useCallback(() => setTrashDialogOpen(true), []);

  const [trashDialogOpen, setTrashDialogOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");

  const activeOrg = Route.useLoaderData({ select: (d) => d.activeOrg });
  const { data: workspacesData } = useOrgWorkspaces(activeOrg?.id);
  const { data: formsData } = useOrgForms(activeOrg?.id);
  const { unreadSubmissionCount } = useSubmissionNotifications({ poll: true });
  const { data: invitations } = useQuery(auth.organization.listUserInvitations.queryOptions());
  const pendingInvitationCount = useMemo(
    () => (invitations ?? []).filter((inv: { status: string }) => inv.status === "pending").length,
    [invitations],
  );
  const pendingCount = unreadSubmissionCount + pendingInvitationCount;

  const signOutMutation = useMutation(
    auth.signOut.mutationOptions({
      onSuccess: () => {
        void router.invalidate();
        void router.navigate({ to: "/" });
      },
    }),
  );

  useHotkey(HOTKEYS.TOGGLE_COMMAND_PALETTE, () => togglePalette(), {
    ignoreInputs: true,
  });

  // On mobile, tapping "Notifications" pushes an inbox view into the drawer
  // instead of opening the desktop floating panel (which has no sensible
  // anchor when the sidebar itself is a floating drawer).
  const showMobileInbox = isMobile && isInboxOpen;

  return (
    <>
      <Sidebar className="h-screen border-r-[0.5px] bg-background">
        {showMobileInbox ? (
          <InboxPanelBody
            onClose={closeInbox}
            headerLeft={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={closeInbox}
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
            }
          />
        ) : (
          <>
            <SidebarHeader className="flex h-12 flex-row items-center pt-2 pr-2 pb-0 pl-2">
              <Tooltip>
                <TooltipTrigger render={<LogoToggle direction="left" onClick={toggleSidebar} />} />
                <TooltipContent side="bottom" align="start">
                  <p>Collapse sidebar</p>
                  <p className="text-xs text-muted-foreground">
                    {formatForDisplay(HOTKEYS.DISMISS_SIDEBARS)}
                  </p>
                </TooltipContent>
              </Tooltip>
            </SidebarHeader>

            <SidebarContent className="gap-0">
              <SidebarGroup className="py-0 pt-2">
                <SidebarGroupContent className="">
                  <SidebarMenu className="gap-0">
                    <SidebarMenuItem>
                      <SidebarItem
                        prefix={<HomeIcon className="size-[18px] text-muted-foreground" />}
                        label="All"
                        linkOptions={{ to: "/dashboard" }}
                        isActive={pathname === "/dashboard"}
                      />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarItem
                        onClick={togglePalette}
                        prefix={<SearchIcon className="size-[18px] text-muted-foreground" />}
                        label="Search"
                      />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarItem
                        onClick={toggleInbox}
                        isActive={isInboxOpen}
                        prefix={<BellIcon className="size-[18px] text-muted-foreground" />}
                        label="Notifications"
                      >
                        {pendingCount > 0 && (
                          <span className="w-4 shrink-0 rounded-full bg-primary py-0.5 text-center text-[10px] font-semibold text-primary-foreground tabular-nums">
                            {pendingCount}
                          </span>
                        )}
                      </SidebarItem>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarItem
                        onClick={handleOpenSettings}
                        prefix={<SettingsIcon className="size-[18px] text-muted-foreground" />}
                        label="Settings"
                      />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="mt-[13px] px-2">
                <SidebarWorkspacesMinimal activeOrgId={activeOrg?.id} />
              </div>
            </SidebarContent>

            <SidebarFooter className="flex shrink-0 flex-col gap-4 p-0 px-2 py-3">
              <UserMenuMinimal onOpenTrash={handleOpenTrash} />
            </SidebarFooter>
          </>
        )}
      </Sidebar>

      {/* Command Palette - rendered only on client to avoid cmdk React 19 SSR issue */}
      {typeof window !== "undefined" && (
        <CommandDialog
          open={isPaletteOpen}
          onOpenChange={(open) => {
            setIsPaletteOpen(open);
            if (!open) setPaletteSearch("");
          }}
        >
          <Command>
            <CommandInput
              placeholder="Search for forms and help articles"
              value={paletteSearch}
              onValueChange={setPaletteSearch}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={async () => {
                    setIsPaletteOpen(false);
                    if (activeOrg && workspacesData) {
                      const orgWorkspaces = workspacesData;
                      if (orgWorkspaces.length > 0) {
                        const workspaceMatch = pathname.match(/\/workspace\/([^/]+)/);
                        const currentWorkspaceId = workspaceMatch?.[1];
                        const targetWorkspace = currentWorkspaceId
                          ? orgWorkspaces.find((ws) => ws.id === currentWorkspaceId) ||
                            orgWorkspaces[0]
                          : orgWorkspaces[0];

                        const { form: newForm } = createFormLocal(targetWorkspace.id);
                        void router.navigate({
                          to: "/workspace/$workspaceId/form-builder/$formId/edit",
                          params: {
                            workspaceId: targetWorkspace.id,
                            formId: newForm.id,
                          },
                        });
                      }
                    }
                  }}
                >
                  <PlusIcon className="size-4" />
                  <span>New form</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    if (activeOrg) {
                      const leadingSortIndex = generateKeyBetween(
                        null,
                        getLeadingSortIndex(workspacesData ?? []),
                      );
                      createWorkspaceLocal(activeOrg.id, "New Workspace", leadingSortIndex)
                        .then((workspace) => {
                          void router.navigate({
                            to: "/workspace/$workspaceId",
                            params: { workspaceId: workspace.id },
                          });
                        })
                        .catch(console.error);
                    }
                    setIsPaletteOpen(false);
                  }}
                >
                  <PlusIcon className="size-4" />
                  <span>New workspace</span>
                </CommandItem>
              </CommandGroup>
              {paletteSearch.trim().length > 0 && formsData && formsData.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Forms">
                    {formsData.map((form) => (
                      <CommandItem
                        key={form.id}
                        value={`${form.title || "Untitled form"} ${form.id}`}
                        onSelect={() => {
                          setIsPaletteOpen(false);
                          setPaletteSearch("");
                          void router.navigate({
                            to: "/workspace/$workspaceId/form-builder/$formId/edit",
                            params: {
                              workspaceId: form.workspaceId,
                              formId: form.id,
                            },
                          });
                        }}
                      >
                        <FileTextIcon className="size-4" />
                        <span>{form.title || "Untitled form"}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              <CommandSeparator />
              <CommandGroup heading="Navigation">
                <CommandItem
                  onSelect={() => {
                    void router.navigate({ to: "/dashboard" });
                    setIsPaletteOpen(false);
                  }}
                >
                  <HomeIcon className="size-4" />
                  <span>Go to home</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    settingsDialogStore.open();
                    setIsPaletteOpen(false);
                  }}
                >
                  <SettingsIcon className="size-4" />
                  <span>Go to settings</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setTrashDialogOpen(true);
                    setIsPaletteOpen(false);
                  }}
                >
                  <Trash2Icon className="size-4" />
                  <span>Trash</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    signOutMutation.mutate({});
                    setIsPaletteOpen(false);
                  }}
                >
                  <LogOutIcon className="size-4" />
                  <span>Sign out</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialog>
      )}

      <TrashDialog
        open={trashDialogOpen}
        onOpenChange={setTrashDialogOpen}
        activeOrgId={activeOrg?.id}
      />

      <Suspense fallback={null}>
        <LazySettingsDialog />
      </Suspense>
    </>
  );
};

const TrashDialog = ({
  open,
  onOpenChange,
  activeOrgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeOrgId?: string;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  // Per-row pending state — tracked separately so each restore/delete button
  // can show a spinner and disable independently while in flight.
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Trash list is a server-fetched query gated on dialog open — no payload
  // until the user actually wants to see it. Sidebar listings stay archived-free.
  const { data: archivedFormsData, isFetching: isFetchingArchived } = useArchivedForms(open);
  const { data: orgWorkspacesData } = useOrgWorkspaces(activeOrgId);

  const archivedForms = useMemo(() => {
    if (!activeOrgId || !archivedFormsData || !orgWorkspacesData) return [];

    const orgWorkspaceIds = new Set(orgWorkspacesData.map((ws) => ws.id));

    const lowerQuery = searchQuery.toLowerCase();
    return archivedFormsData
      .filter((form) => {
        if (!orgWorkspaceIds.has(form.workspaceId)) return false;
        if (!searchQuery) return true;
        return (form?.title ?? "").toLowerCase().includes(lowerQuery);
      })
      .toSorted((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [archivedFormsData, orgWorkspacesData, activeOrgId, searchQuery]);

  const workspaceNames = useMemo(() => {
    if (!orgWorkspacesData) return {};
    return orgWorkspacesData.reduce(
      (acc, ws) => {
        acc[ws.id] = ws.name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [orgWorkspacesData]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) setSelectedIds(new Set());
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((formId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === archivedForms.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(archivedForms.map((f) => f.id)));
    }
  }, [selectedIds.size, archivedForms]);

  const removeFromSelection = useCallback((formId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(formId);
      return next;
    });
  }, []);

  const handleRestore = useCallback(
    async (formId: string) => {
      if (restoringIds.has(formId) || deletingIds.has(formId)) return;
      setRestoringIds((prev) => new Set(prev).add(formId));
      try {
        await restoreFormLocal(formId);
        removeFromSelection(formId);
        toast.success("Form restored");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to restore form";
        toast.error(message);
      } finally {
        setRestoringIds((prev) => {
          const next = new Set(prev);
          next.delete(formId);
          return next;
        });
      }
    },
    [removeFromSelection, restoringIds, deletingIds],
  );

  const handlePermanentDelete = useCallback(
    async (formId: string) => {
      if (restoringIds.has(formId) || deletingIds.has(formId)) return;
      setDeletingIds((prev) => new Set(prev).add(formId));
      try {
        await permanentDeleteFormLocal(formId);
        removeFromSelection(formId);
        toast.success("Form deleted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete form";
        toast.error(message);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(formId);
          return next;
        });
      }
    },
    [removeFromSelection, restoringIds, deletingIds],
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsDeleting(true);
    setDeletingIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      await bulkPermanentDeleteFormsLocal(ids);
      toast.success(`Deleted ${ids.length} form${ids.length === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete forms";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
  }, [selectedIds]);

  const hasSelection = selectedIds.size > 0;

  // `allow` (not `replace`): dashboard registers the same hotkeys at document
  // level. `replace` would unregister those and leak — they'd be gone after
  // this dialog closes. With `allow`, both stay registered; the dashboard
  // handlers no-op when a dialog is open, so this one wins while open.
  useHotkey("Mod+A", handleSelectAll, {
    enabled: open,
    conflictBehavior: "allow",
    ignoreInputs: true,
  });

  useHotkeys(
    [
      { hotkey: "Backspace", callback: handleBulkDelete },
      { hotkey: "Delete", callback: handleBulkDelete },
    ],
    { enabled: open && hasSelection, conflictBehavior: "allow", ignoreInputs: true },
  );

  useHotkey(
    "Escape",
    () => {
      if (hasSelection) {
        setSelectedIds(new Set());
      } else {
        handleOpenChange(false);
      }
    },
    {
      enabled: open,
      conflictBehavior: "allow",
    },
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 border-foreground/10 bg-background p-0 sm:max-w-[500px]"
      >
        <div className="p-1.5 pb-0">
          {/* Matches CommandInput shell so trash search reads as the same
              search affordance used elsewhere in the app. */}
          <div className="flex h-[30px] w-full items-center gap-1.5 overflow-hidden rounded-xl bg-accent px-2.5 py-1.75">
            <LucideSearch
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search pages in Trash"
              aria-label="Search trash"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {archivedFormsData === undefined && isFetchingArchived ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2Icon className="mb-3 size-6 animate-spin opacity-60" />
              <p className="text-sm">Loading trash…</p>
            </div>
          ) : archivedForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trash2Icon className="mb-3 size-10 opacity-30" />
              <p className="text-sm">Trash is empty</p>
            </div>
          ) : (
            <div className="p-1">
              {archivedForms.map((form) => (
                <TrashRow
                  key={form.id}
                  form={form}
                  workspaceName={workspaceNames[form.workspaceId]}
                  isSelected={selectedIds.has(form.id)}
                  isRestoring={restoringIds.has(form.id)}
                  isDeleting={deletingIds.has(form.id)}
                  onToggleSelect={handleToggleSelect}
                  onRestore={handleRestore}
                  onPermanentDelete={handlePermanentDelete}
                />
              ))}
            </div>
          )}
        </div>

        <TrashFooter
          hasSelection={hasSelection}
          selectedCount={selectedIds.size}
          totalCount={archivedForms.length}
          isDeleting={isDeleting}
          onSelectAll={handleSelectAll}
          onBulkDelete={handleBulkDelete}
        />
      </DialogContent>
    </Dialog>
  );
};

interface TrashRowForm {
  id: string;
  title: string | null;
  workspaceId: string;
}

interface TrashRowProps {
  form: TrashRowForm;
  workspaceName: string | undefined;
  isSelected: boolean;
  isRestoring: boolean;
  isDeleting: boolean;
  onToggleSelect: (formId: string) => void;
  onRestore: (formId: string) => Promise<void> | void;
  onPermanentDelete: (formId: string) => Promise<void> | void;
}

const TrashRow = ({
  form,
  workspaceName,
  isSelected,
  isRestoring,
  isDeleting,
  onToggleSelect,
  onRestore,
  onPermanentDelete,
}: TrashRowProps) => {
  const isRowBusy = isRestoring || isDeleting;
  return (
    <div
      className={`group flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors ${isSelected ? "bg-muted/50" : "hover:bg-muted/50"} ${isRowBusy ? "pointer-events-none opacity-60" : ""}`}
      onClick={() => onToggleSelect(form.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggleSelect(form.id);
      }}
      role="option"
      aria-selected={isSelected}
      aria-busy={isRowBusy}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-5 shrink-0 items-center justify-center rounded">
          {isSelected ? (
            <div className="flex size-5 items-center justify-center rounded bg-foreground text-background transition-colors">
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </div>
          ) : (
            <>
              <FileTextIcon className="size-4 text-muted-foreground group-hover:hidden" />
              <div className="hidden size-5 items-center justify-center rounded bg-foreground/10 text-muted-foreground transition-colors group-hover:flex">
                <CheckIcon className="size-3.5" />
              </div>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-foreground">{form.title || "Untitled"}</p>
          <p className="truncate text-[11px] text-muted-foreground/60">
            {workspaceName || "Unknown workspace"}
          </p>
        </div>
      </div>
      <div
        className={`flex items-center gap-1 transition-opacity ${isSelected || isRowBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            void onRestore(form.id);
          }}
          disabled={isRowBusy}
          className="size-7"
          title="Restore"
          aria-label="Restore"
        >
          {isRestoring ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <Undo2Icon className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            void onPermanentDelete(form.id);
          }}
          disabled={isRowBusy}
          className="size-7 hover:bg-destructive/10 hover:text-destructive"
          title="Delete permanently"
          aria-label="Delete permanently"
        >
          {isDeleting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <Trash2Icon className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

interface TrashFooterProps {
  hasSelection: boolean;
  selectedCount: number;
  totalCount: number;
  isDeleting: boolean;
  onSelectAll: () => void;
  onBulkDelete: () => void;
}

const TrashFooter = ({
  hasSelection,
  selectedCount,
  totalCount,
  isDeleting,
  onSelectAll,
  onBulkDelete,
}: TrashFooterProps) => (
  <div className="flex items-center justify-between border-t border-foreground/5 bg-muted/20 px-4 py-3">
    {hasSelection ? (
      <>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {selectedCount === totalCount ? "Deselect all" : "Select all"}
          </button>
          <span className="text-[11px] text-muted-foreground/60">{selectedCount} selected</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBulkDelete}
          disabled={isDeleting}
          className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {isDeleting ? (
            <>
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete selected"
          )}
        </Button>
      </>
    ) : (
      <>
        <p className="text-[11px] text-muted-foreground/60">
          Pages in Trash for over 30 days will be automatically deleted
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground/40 hover:text-muted-foreground"
          aria-label="Help"
        >
          <HelpCircleIcon className="size-4" />
        </Button>
      </>
    )}
  </div>
);

// Inbox body — header + notifications + invitations. Extracted so it can be
// rendered in two contexts:
//   1. Floating panel beside the docked desktop sidebar (via `SidebarInbox`).
//   2. In-place inside the mobile drawer (push-navigation from the sidebar
//      nav view, with a back button instead of a close button).
interface InboxPanelBodyProps {
  onClose: () => void;
  // When supplied, rendered to the left of the title. Mobile uses this for a
  // back-arrow; desktop passes nothing (only the right-side close button).
  headerLeft?: React.ReactNode;
}

const InboxPanelBody = ({ onClose, headerLeft }: InboxPanelBodyProps) => {
  const queryClient = useQueryClient();

  const { data: invitations } = useQuery(auth.organization.listUserInvitations.queryOptions());
  const {
    notifications,
    readNotificationCount,
    openNotification,
    clearNotification,
    clearAllReadNotifications,
    isClearingAllRead,
    clearingFormId,
    readingFormId,
  } = useSubmissionNotifications();

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Something went wrong";
    toast.error(message);
    void queryClient.invalidateQueries({
      queryKey: auth.organization.listUserInvitations.queryKey(),
    });
  };

  const acceptMutation = useMutation(
    auth.organization.acceptInvitation.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation accepted!");
        void queryClient.invalidateQueries({
          queryKey: auth.organization.listUserInvitations.queryKey(),
        });
      },
      onError: handleError,
    }),
  );

  const rejectMutation = useMutation(
    auth.organization.rejectInvitation.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation declined");
        void queryClient.invalidateQueries({
          queryKey: auth.organization.listUserInvitations.queryKey(),
        });
      },
      onError: handleError,
    }),
  );

  const pendingInvitations = (invitations ?? []).filter(
    (inv: { status: string }) => inv.status === "pending",
  );
  const hasNotifications = notifications.length > 0;
  const hasPendingInvitations = pendingInvitations.length > 0;

  return (
    <div className="flex size-full flex-col">
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            {headerLeft}
            <h2 className="truncate pl-2.5 text-base text-foreground">Inbox</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        <div className="overflow-hidden px-1">
          {hasNotifications && (
            <>
              <div className="mb-3 flex items-center justify-between px-2">
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground/30 uppercase">
                  Submissions
                </p>
                {readNotificationCount > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    disabled={isClearingAllRead}
                    onClick={() => void clearAllReadNotifications()}
                  >
                    {isClearingAllRead ? "Clearing..." : "Clear all read"}
                  </Button>
                ) : null}
              </div>

              <div className="mb-4 flex flex-col gap-px overflow-hidden rounded-lg">
                {notifications.map((notification) => {
                  const isUnread = !notification.isRead && notification.unreadCount > 0;
                  const isBusy =
                    readingFormId === notification.formId || clearingFormId === notification.formId;

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      className="group flex min-h-8.5 w-full items-center gap-3 bg-secondary py-1.75 pr-[6px] pl-2.5 text-left transition-colors hover:bg-muted/80"
                      onClick={() => void openNotification(notification)}
                      disabled={readingFormId === notification.formId}
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-foreground/5">
                        <ThemedFormIcon
                          icon={notification.formIcon}
                          customization={undefined}
                          size="14"
                          iconSize="8"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-normal">
                          {notification.formTitle || "Untitled"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {isUnread ? (
                          <span className="text-[11px] text-foreground tabular-nums">
                            {notification.unreadCount === 1
                              ? "1 new"
                              : `${notification.unreadCount} new`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50">
                            {formatNotificationTime(notification.latestSubmissionAt)}
                          </span>
                        )}
                        {notification.isRead ? (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              void clearNotification(notification.formId);
                            }}
                            aria-label="Clear notification"
                          >
                            <XIcon className="size-3" />
                          </Button>
                        ) : (
                          <div className="size-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {hasPendingInvitations && (
            <>
              <p className="mb-3 px-2 text-[10px] font-bold tracking-widest text-muted-foreground/30 uppercase">
                Invitations
              </p>
              <div className="mb-4 space-y-1">
                {pendingInvitations.map((invitation) => {
                  const isProcessing =
                    (acceptMutation.isPending &&
                      acceptMutation.variables?.invitationId === invitation.id) ||
                    (rejectMutation.isPending &&
                      rejectMutation.variables?.invitationId === invitation.id);

                  return (
                    <div
                      key={invitation.id}
                      className="group flex flex-col gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-foreground/5 hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground/5">
                          <UsersIcon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-foreground">
                            You've been invited to join{" "}
                            <span className="font-bold">
                              {(
                                invitation as unknown as {
                                  organization?: { name?: string };
                                }
                              ).organization?.name ?? "an organization"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                            Role: <span className="capitalize">{invitation.role}</span>
                          </p>
                        </div>
                      </div>
                      <div className="ml-11 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-3 text-xs"
                          disabled={isProcessing}
                          onClick={() =>
                            acceptMutation.mutate({
                              invitationId: invitation.id,
                            })
                          }
                        >
                          {acceptMutation.isPending &&
                          acceptMutation.variables?.invitationId === invitation.id
                            ? "Accepting..."
                            : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-xs"
                          disabled={isProcessing}
                          onClick={() =>
                            rejectMutation.mutate({
                              invitationId: invitation.id,
                            })
                          }
                        >
                          {rejectMutation.isPending &&
                          rejectMutation.variables?.invitationId === invitation.id
                            ? "Declining..."
                            : "Decline"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!hasNotifications && !hasPendingInvitations ? (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
              <p className="text-base text-muted-foreground/50">No notifications yet</p>
              <p className="max-w-[220px] text-[11px] text-muted-foreground/40">
                Submission notifications appear here for forms where in-app notifications are
                enabled.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/**
 * Desktop-only floating Inbox panel. Docks beside the main sidebar (left-X
 * positioning follows the sidebar's collapsed/expanded width). On mobile we
 * return null — the inbox content is rendered inside the drawer instead, via
 * push-navigation in `AppSidebar`.
 */
const SidebarInbox = () => {
  const { isInboxOpen, closeInbox } = useMinimalSidebar();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const prevOpenRef = useRef(isInboxOpen);
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in JSX to apply exit animation styling
  const [isExiting, setIsExiting] = useState(false);
  const [applyExitClass, setApplyExitClass] = useState(false);

  const [lastIsInboxOpen, setLastIsInboxOpen] = useState(isInboxOpen);
  if (lastIsInboxOpen !== isInboxOpen) {
    setLastIsInboxOpen(isInboxOpen);
    if (isInboxOpen) {
      prevOpenRef.current = true;
      setIsExiting(false);
      setApplyExitClass(false);
    } else if (prevOpenRef.current) {
      setIsExiting(true);
      prevOpenRef.current = false;
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (!isExiting) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setApplyExitClass(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isExiting]);

  const EXIT_DURATION_MS = 250;
  useEffect(() => {
    if (!isExiting) return;
    const timeoutId = setTimeout(() => setIsExiting(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [isExiting]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === "transform") setIsExiting(false);
  }, []);

  if (isMobile) return null;
  if (!isInboxOpen && !isExiting && !prevOpenRef.current) return null;

  return (
    <div
      className={cn(
        "fixed top-0 bottom-0 z-40 flex w-80 flex-col border-r border-foreground/5 bg-background select-none",
        "transition-[left,opacity] duration-150 ease-out [[data-resizing]_&]:transition-none",
        state === "expanded" ? "left-(--sidebar-width)" : "left-(--sidebar-width-icon)",
        applyExitClass && "opacity-0",
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <InboxPanelBody onClose={closeInbox} />
    </div>
  );
};

interface UseSortedWorkspacesWithFormsOptions {
  workspacesData: ReturnType<typeof useOrgWorkspaces>["data"];
  formsData: ReturnType<typeof useOrgForms>["data"];
  activeOrgId: string | undefined;
  isDataReady: boolean;
  sortMode: "recent" | "oldest" | "alphabetical" | "manual";
}

const arraysAreShallowEqual = <T,>(a: readonly T[], b: readonly T[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const useSortedWorkspacesWithForms = ({
  workspacesData,
  formsData,
  activeOrgId,
  isDataReady,
  sortMode,
}: UseSortedWorkspacesWithFormsOptions) => {
  // Cache workspace + forms-array identities by id so a live-query notification
  // that doesn't actually change content (just the array reference) doesn't
  // cascade new identities into every consumer downstream.
  const workspaceCacheRef = useRef(new Map<string, WorkspaceWithForms>());
  const formsArrayCacheRef = useRef(new Map<string, WorkspaceWithForms["forms"]>());

  const workspaces: WorkspaceWithForms[] = useMemo(() => {
    if (!activeOrgId || !isDataReady) return [];

    const formsByWorkspace = (formsData || []).reduce(
      (acc, form) => {
        if (!acc[form.workspaceId]) acc[form.workspaceId] = [];
        acc[form.workspaceId].push(form as unknown as WorkspaceWithForms["forms"][0]);
        return acc;
      },
      {} as Record<string, WorkspaceWithForms["forms"]>,
    );

    const orderedWorkspaces = sortByManualOrder(
      workspacesData || [],
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const nextWorkspaceCache = new Map<string, WorkspaceWithForms>();
    const nextFormsCache = new Map<string, WorkspaceWithForms["forms"]>();

    const result = orderedWorkspaces.map((ws) => {
      const forms = formsByWorkspace[ws.id] || [];
      let sortedForms: WorkspaceWithForms["forms"];
      if (sortMode === "manual") {
        sortedForms = sortByManualOrder(
          forms,
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      } else {
        sortedForms = forms.toSorted(
          (a: WorkspaceWithForms["forms"][0], b: WorkspaceWithForms["forms"][0]) => {
            switch (sortMode) {
              case "oldest":
                return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
              case "alphabetical":
                return (a.title || "").localeCompare(b.title || "");
              case "recent":
              default:
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
          },
        );
      }

      // Reuse the previous forms array if every form item is the same reference
      // in the same order — this stabilises both the array and any per-form
      // identity churn upstream.
      const previousForms = formsArrayCacheRef.current.get(ws.id);
      if (previousForms && arraysAreShallowEqual(previousForms, sortedForms)) {
        sortedForms = previousForms;
      }
      nextFormsCache.set(ws.id, sortedForms);

      const previousWorkspace = workspaceCacheRef.current.get(ws.id);
      if (
        previousWorkspace &&
        previousWorkspace.forms === sortedForms &&
        previousWorkspace.name === ws.name &&
        previousWorkspace.sortIndex === ws.sortIndex &&
        previousWorkspace.organizationId === ws.organizationId &&
        previousWorkspace.updatedAt === ws.updatedAt &&
        previousWorkspace.createdAt === ws.createdAt &&
        previousWorkspace.createdByUserId === ws.createdByUserId
      ) {
        nextWorkspaceCache.set(ws.id, previousWorkspace);
        return previousWorkspace;
      }
      const fresh = { ...ws, forms: sortedForms };
      nextWorkspaceCache.set(ws.id, fresh);
      return fresh;
    });

    workspaceCacheRef.current = nextWorkspaceCache;
    formsArrayCacheRef.current = nextFormsCache;
    return result;
  }, [workspacesData, formsData, activeOrgId, isDataReady, sortMode]);

  // Same content-stability trick: keep the previous summaries array when every
  // (id, name) tuple is unchanged so memoised children skip re-rendering.
  const allWorkspaceSummariesRef = useRef<Array<Pick<WorkspaceWithForms, "id" | "name">>>([]);
  const allWorkspaceSummaries = useMemo(() => {
    const next = workspaces.map((w) => ({ id: w.id, name: w.name }));
    const previous = allWorkspaceSummariesRef.current;
    if (
      previous.length === next.length &&
      previous.every((p, i) => p.id === next[i].id && p.name === next[i].name)
    ) {
      return previous;
    }
    allWorkspaceSummariesRef.current = next;
    return next;
  }, [workspaces]);

  return { workspaces, allWorkspaceSummaries };
};

interface UseSidebarWorkspaceDialogsOptions {
  router: ReturnType<typeof useRouter>;
  pathname: string;
  duplicateForm: ReturnType<typeof useDuplicateForm>;
}

const useSidebarWorkspaceDialogs = ({
  router,
  pathname,
  duplicateForm,
}: UseSidebarWorkspaceDialogsOptions) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceWithForms | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<WorkspaceWithForms | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const [formDeleteDialogOpen, setFormDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  // Pending state for destructive dialogs — prevents double-submission and
  // gives the action button a spinner while the server fn is in flight.
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [isDeletingForm, setIsDeletingForm] = useState(false);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) setDeleteConfirmName("");
  }, []);

  const handleDeleteConfirmNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDeleteConfirmName(e.target.value),
    [],
  );

  const handleNewWorkspaceNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewWorkspaceName(e.target.value),
    [],
  );

  const handleCloseRenameDialog = useCallback(() => setRenameDialogOpen(false), []);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!workspaceToDelete || deleteConfirmName !== workspaceToDelete.name) return;
    if (isDeletingWorkspace) return;
    setIsDeletingWorkspace(true);
    try {
      await deleteWorkspaceLocal(workspaceToDelete.id);
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      setDeleteConfirmName("");
      void router.navigate({ to: "/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete workspace";
      toast.error(message);
    } finally {
      setIsDeletingWorkspace(false);
    }
  }, [workspaceToDelete, deleteConfirmName, router, isDeletingWorkspace]);

  const handleRenameWorkspace = useCallback(async () => {
    if (!workspaceToRename || !newWorkspaceName.trim() || isRenamingWorkspace) return;
    setIsRenamingWorkspace(true);
    try {
      await updateWorkspaceName(workspaceToRename.id, newWorkspaceName.trim());
      setRenameDialogOpen(false);
      setWorkspaceToRename(null);
      setNewWorkspaceName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename workspace";
      toast.error(message);
    } finally {
      setIsRenamingWorkspace(false);
    }
  }, [workspaceToRename, newWorkspaceName, isRenamingWorkspace]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        void handleRenameWorkspace();
      }
    },
    [handleRenameWorkspace],
  );

  const openRenameDialog = useCallback((workspace: WorkspaceWithForms) => {
    setWorkspaceToRename(workspace);
    setNewWorkspaceName(workspace.name);
    setRenameDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((workspace: WorkspaceWithForms) => {
    setWorkspaceToDelete(workspace);
    setDeleteConfirmName("");
    setDeleteDialogOpen(true);
  }, []);

  const duplicatingIdsRef = useRef(duplicatingIds);
  duplicatingIdsRef.current = duplicatingIds;

  const handleDuplicateForm = useCallback(
    async (form: WorkspaceWithForms["forms"][0]) => {
      if (duplicatingIdsRef.current.has(form.id)) return;
      setDuplicatingIds((prev) => new Set(prev).add(form.id));
      try {
        await duplicateForm(form.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to duplicate form";
        toast.error(message);
      } finally {
        setDuplicatingIds((prev) => {
          const next = new Set(prev);
          next.delete(form.id);
          return next;
        });
      }
    },
    [duplicateForm],
  );

  const isFormDuplicating = useCallback(
    (formId: string) => duplicatingIds.has(formId),
    [duplicatingIds],
  );

  const handleDeleteForm = useCallback((form: WorkspaceWithForms["forms"][0]) => {
    setFormToDelete({ id: form.id, title: form.title || "Untitled" });
    setFormDeleteDialogOpen(true);
  }, []);

  const handleConfirmDeleteForm = useCallback(async () => {
    if (!formToDelete || isDeletingForm) return;
    setIsDeletingForm(true);
    try {
      await updateFormStatus(formToDelete.id, "archived");
      toast.success("Form deleted");
      // Navigate to dashboard if user is on the deleted form's page
      if (pathname.includes(`/form-builder/${formToDelete.id}`)) {
        void router.navigate({ to: "/dashboard" });
      }
      setFormDeleteDialogOpen(false);
      setFormToDelete(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete form";
      toast.error(message);
    } finally {
      setIsDeletingForm(false);
    }
  }, [formToDelete, pathname, router, isDeletingForm]);

  return {
    deleteDialogOpen,
    workspaceToDelete,
    deleteConfirmName,
    isDeletingWorkspace,
    renameDialogOpen,
    setRenameDialogOpen,
    newWorkspaceName,
    isRenamingWorkspace,
    formDeleteDialogOpen,
    setFormDeleteDialogOpen,
    formToDelete,
    isDeletingForm,
    handleDeleteDialogOpenChange,
    handleDeleteConfirmNameChange,
    handleNewWorkspaceNameChange,
    handleCloseRenameDialog,
    handleDeleteWorkspace,
    handleRenameWorkspace,
    handleRenameKeyDown,
    openRenameDialog,
    openDeleteDialog,
    handleDuplicateForm,
    isFormDuplicating,
    handleDeleteForm,
    handleConfirmDeleteForm,
  };
};

const SidebarWorkspacesMinimal = ({ activeOrgId }: { activeOrgId?: string }) => {
  const router = useRouter();
  const pathname = useLocation({ select: (s) => s.pathname });
  const duplicateForm = useDuplicateForm();
  const { data: session } = useSession();

  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "alphabetical" | "manual">(() => {
    if (typeof window !== "undefined") {
      return (
        (localStorage.getItem("sidebar-sort-mode") as
          | "recent"
          | "oldest"
          | "alphabetical"
          | "manual") || "recent"
      );
    }
    return "recent";
  });
  const handleSortChange = useCallback((mode: "recent" | "oldest" | "alphabetical" | "manual") => {
    setSortMode(mode);
    localStorage.setItem("sidebar-sort-mode", mode);
  }, []);

  const { data: workspacesData, isLoading: workspacesLoading } = useOrgWorkspaces(activeOrgId);
  const { data: formsData, isLoading: formsLoading } = useOrgForms(activeOrgId);
  const submissionCounts = useSubmissionCounts();

  const favoriteForms = useFavoriteForms(session?.user?.id);

  // Derive a stable Set of favorited form ids so individual sidebar rows can
  // read a primitive `isFavorite` prop instead of each spinning up its own
  // `useIsFavorite` live-query subscription. The Set identity is reused when
  // the membership is unchanged so the prop chain stays referentially stable.
  const favoriteFormIdsRef = useRef<Set<string>>(new Set());
  const favoriteFormIds = useMemo(() => {
    const next = new Set<string>();
    for (const f of favoriteForms) next.add(f.id);
    const previous = favoriteFormIdsRef.current;
    if (previous.size === next.size) {
      let identical = true;
      for (const id of next) {
        if (!previous.has(id)) {
          identical = false;
          break;
        }
      }
      if (identical) return previous;
    }
    favoriteFormIdsRef.current = next;
    return next;
  }, [favoriteForms]);

  // Pull the active form id once at the parent so each form row can read a
  // primitive `isActive` prop instead of subscribing to `useLocation`.
  const activeFormId = useMemo(() => {
    const match = pathname.match(/\/form-builder\/([^/]+)/);
    return match?.[1];
  }, [pathname]);

  const isLoading = workspacesLoading || formsLoading;
  const isDataReady = !isLoading && workspacesData !== undefined && formsData !== undefined;

  const { workspaces, allWorkspaceSummaries } = useSortedWorkspacesWithForms({
    workspacesData,
    formsData,
    activeOrgId,
    isDataReady,
    sortMode,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const workspaceIds = useMemo(() => workspaces.map((w) => w.id), [workspaces]);

  // Read-only ref so drag handlers can read the freshest workspaces snapshot
  // without re-binding their identity (and re-rendering every WorkspaceItemMinimal)
  // each time the live-query data churns.
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const sortModeRef = useRef(sortMode);
  sortModeRef.current = sortMode;

  const handleWorkspaceDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = workspacesRef.current;
    const oldIdx = current.findIndex((w) => w.id === active.id);
    const newIdx = current.findIndex((w) => w.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = [...current];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);

    try {
      const indexes = generateOrderedIndexes(reordered.length);
      reordered.forEach((ws, i) => {
        if ((ws.sortIndex ?? null) !== indexes[i]) {
          reorderWorkspaceLocal(ws.id, indexes[i]).catch(() =>
            toast.error("Failed to reorder workspace"),
          );
        }
      });
    } catch (err) {
      console.error("Failed to compute workspace sort indexes", err);
    }
  }, []);

  const handleFormDragEnd = useCallback(
    (workspaceId: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ws = workspacesRef.current.find((w) => w.id === workspaceId);
      if (!ws) return;

      const oldIdx = ws.forms.findIndex((f) => f.id === active.id);
      const newIdx = ws.forms.findIndex((f) => f.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;

      const reordered = [...ws.forms];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      try {
        const indexes = generateOrderedIndexes(reordered.length);
        reordered.forEach((form, i) => {
          if ((form.sortIndex ?? null) !== indexes[i]) {
            reorderFormLocal(form.id, indexes[i]).catch(() =>
              toast.error("Failed to reorder form"),
            );
          }
        });
        // Auto-switch sidebar to manual mode so the reorder "sticks" visually
        if (sortModeRef.current !== "manual") handleSortChange("manual");
      } catch (err) {
        console.error("Failed to compute form sort indexes", err);
      }
    },
    [handleSortChange],
  );

  const dialogs = useSidebarWorkspaceDialogs({ router, pathname, duplicateForm });
  const {
    deleteDialogOpen,
    workspaceToDelete,
    deleteConfirmName,
    isDeletingWorkspace,
    renameDialogOpen,
    setRenameDialogOpen,
    newWorkspaceName,
    isRenamingWorkspace,
    formDeleteDialogOpen,
    setFormDeleteDialogOpen,
    formToDelete,
    isDeletingForm,
    handleDeleteDialogOpenChange,
    handleDeleteConfirmNameChange,
    handleNewWorkspaceNameChange,
    handleCloseRenameDialog,
    handleDeleteWorkspace,
    handleRenameWorkspace,
    handleRenameKeyDown,
    openRenameDialog,
    openDeleteDialog,
    handleDuplicateForm,
    isFormDuplicating,
    handleDeleteForm,
    handleConfirmDeleteForm,
  } = dialogs;

  return (
    <>
      <div className="flex flex-col">
        {favoriteForms.length > 0 && session?.user?.id && (
          <SortableFavoritesSection userId={session.user.id} favoriteForms={favoriteForms} />
        )}

        <div className="mt-[15px] space-y-4">
          {isLoading ? (
            ["collection-skeleton-1", "collection-skeleton-2"].map((key) => (
              <div key={key} className="flex items-center gap-2 px-2 py-1.5">
                <div className="size-4 animate-pulse rounded bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleWorkspaceDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={workspaceIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {workspaces.map((workspace) => (
                    <WorkspaceItemMinimal
                      key={workspace.id}
                      workspace={workspace}
                      allWorkspaces={allWorkspaceSummaries}
                      submissionCounts={submissionCounts}
                      favoriteFormIds={favoriteFormIds}
                      activeFormId={activeFormId}
                      sortMode={sortMode}
                      onSortChange={handleSortChange}
                      onRename={openRenameDialog}
                      onDelete={openDeleteDialog}
                      onDuplicateForm={handleDuplicateForm}
                      onDeleteForm={handleDeleteForm}
                      onFormDragEnd={handleFormDragEnd}
                      isFormDuplicating={isFormDuplicating}
                    />
                  ))}
                  {workspaces.length === 0 && (
                    <span className="px-2 py-1 text-[11px] text-muted-foreground/50 italic">
                      No workspaces yet
                    </span>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <WorkspaceDeleteConfirmDialog
        open={deleteDialogOpen}
        workspace={workspaceToDelete}
        confirmName={deleteConfirmName}
        isDeleting={isDeletingWorkspace}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirmNameChange={handleDeleteConfirmNameChange}
        onDelete={handleDeleteWorkspace}
      />

      <WorkspaceRenameDialog
        open={renameDialogOpen}
        name={newWorkspaceName}
        isRenaming={isRenamingWorkspace}
        onOpenChange={setRenameDialogOpen}
        onNameChange={handleNewWorkspaceNameChange}
        onClose={handleCloseRenameDialog}
        onRename={handleRenameWorkspace}
        onKeyDown={handleRenameKeyDown}
      />

      <FormDeleteConfirmDialog
        open={formDeleteDialogOpen}
        form={formToDelete}
        isDeleting={isDeletingForm}
        onOpenChange={setFormDeleteDialogOpen}
        onConfirm={handleConfirmDeleteForm}
      />
    </>
  );
};

interface WorkspaceDeleteConfirmDialogProps {
  open: boolean;
  workspace: WorkspaceWithForms | null;
  confirmName: string;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

const WorkspaceDeleteConfirmDialog = ({
  open,
  workspace,
  confirmName,
  isDeleting,
  onOpenChange,
  onConfirmNameChange,
  onDelete,
}: WorkspaceDeleteConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete workspace</AlertDialogTitle>
        <AlertDialogDescription render={<div className="space-y-4" />}>
          <p>
            This will permanently delete <strong>"{workspace?.name}"</strong> and{" "}
            <strong>
              {workspace?.forms?.length || 0} form
              {(workspace?.forms?.length || 0) !== 1 ? "s" : ""}
            </strong>
            within it. This action cannot be undone.
          </p>
          <div className="space-y-2">
            <p className="text-sm">
              Type <strong>{workspace?.name}</strong> to confirm:
            </p>
            <Input
              value={confirmName}
              onChange={onConfirmNameChange}
              placeholder="Type workspace name to confirm"
              aria-label="Type to confirm deletion"
              className="mt-2"
            />
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onDelete}
          disabled={confirmName !== workspace?.name || isDeleting}
          className="bg-destructive text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <>
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete workspace"
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

interface WorkspaceRenameDialogProps {
  open: boolean;
  name: string;
  isRenaming: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onRename: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const WorkspaceRenameDialog = ({
  open,
  name,
  isRenaming,
  onOpenChange,
  onNameChange,
  onClose,
  onRename,
  onKeyDown,
}: WorkspaceRenameDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="gap-4 sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Rename workspace</DialogTitle>
        <DialogDescription>Enter a new name for this workspace.</DialogDescription>
      </DialogHeader>
      <Input
        value={name}
        onChange={onNameChange}
        placeholder="Workspace name"
        aria-label="Workspace name"
        onKeyDown={onKeyDown}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isRenaming}>
          Cancel
        </Button>
        <Button onClick={onRename} disabled={!name.trim() || isRenaming}>
          {isRenaming ? (
            <>
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface FormDeleteConfirmDialogProps {
  open: boolean;
  form: { id: string; title: string } | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const FormDeleteConfirmDialog = ({
  open,
  form,
  isDeleting,
  onOpenChange,
  onConfirm,
}: FormDeleteConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete form</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete "{form?.title}"? This action will move it to trash.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={isDeleting}
          className="bg-destructive text-white hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <>
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete"
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type FavoriteFormItem = {
  id: string;
  title: string | null;
  workspaceId: string;
  status: string;
  updatedAt: string;
  icon: string | null;
  customization: unknown;
  favoriteId: string;
  favoriteSortIndex: string | null;
  favoriteCreatedAt: string;
};

const SortableFavoritesSection = ({
  userId,
  favoriteForms,
}: {
  userId: string;
  favoriteForms: FavoriteFormItem[];
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = useMemo(
    () =>
      sortByManualOrder(
        favoriteForms.map((f) => ({ ...f, sortIndex: f.favoriteSortIndex })),
        (a, b) => new Date(a.favoriteCreatedAt).getTime() - new Date(b.favoriteCreatedAt).getTime(),
      ),
    [favoriteForms],
  );

  const favIds = useMemo(() => sorted.map((f) => f.favoriteId), [sorted]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIdx = sorted.findIndex((f) => f.favoriteId === active.id);
      const newIdx = sorted.findIndex((f) => f.favoriteId === over.id);
      if (oldIdx < 0 || newIdx < 0) return;

      const reordered = [...sorted];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      try {
        const indexes = generateOrderedIndexes(reordered.length);
        reordered.forEach((fav, i) => {
          if ((fav.favoriteSortIndex ?? null) !== indexes[i]) {
            reorderFavoriteLocal(fav.favoriteId, indexes[i]).catch(() =>
              toast.error("Failed to reorder favorite"),
            );
          }
        });
      } catch (err) {
        console.error("Failed to compute favorite sort indexes", err);
      }
    },
    [sorted],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SidebarSection label="Favorites" initialOpen action={<></>}>
        <SortableContext items={favIds} strategy={verticalListSortingStrategy}>
          {sorted.map((form) => (
            <SortableFavoriteItem key={form.favoriteId} form={form} userId={userId} />
          ))}
        </SortableContext>
      </SidebarSection>
    </DndContext>
  );
};

const SortableFavoriteItem = ({
  form,
  userId,
}: {
  form: FavoriteFormItem & { sortIndex: string | null };
  userId: string;
}) => {
  const pathname = useLocation({ select: (s) => s.pathname });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: form.favoriteId,
    data: { type: "favorite" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isFavActive = pathname.startsWith(`/workspace/${form.workspaceId}/form-builder/${form.id}`);

  const handleUnfavorite = useCallback(() => {
    toggleFavoriteLocal(userId, form.id).catch(() => toast.error("Failed to unfavorite"));
  }, [userId, form.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group/row relative"
    >
      <SidebarItem
        label={form.title || "Untitled"}
        linkOptions={{
          to:
            form.status === "published"
              ? "/workspace/$workspaceId/form-builder/$formId/submissions"
              : "/workspace/$workspaceId/form-builder/$formId/edit",
          params: { workspaceId: form.workspaceId, formId: form.id },
        }}
        isActive={isFavActive}
        prefix={
          <ThemedFormIcon
            icon={form.icon}
            customization={form.customization as Record<string, string> | null | undefined}
          />
        }
        className="group-hover/row:pe-7 group-has-[[data-state=open]]/row:pe-7"
      />
      <button
        type="button"
        aria-label="Remove from favorites"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleUnfavorite();
        }}
        className="hover:bg-sidebar-active absolute top-1/2 right-2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground"
      >
        <StarIcon className="size-3.5" />
      </button>
    </div>
  );
};
