import { ThemedFormIcon } from "@/components/icon-picker/icon-picker-preview";
import { NumberPopIn } from "@/components/transitions/number-pop-in";
import { SidebarItem } from "@/components/sidebar-item";
import { AppHeader } from "@/components/ui/app-header";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  ArrowLeftIcon,
  BellIcon,
  HomeIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
} from "@/components/ui/icons";
import { FigTilesIcon } from "@/components/dashboard/dashboard-icons";
import { useRecentFormIds } from "@/lib/recent-forms";
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
import { SidebarSectionResetProvider } from "@/components/ui/sidebar-section";
import { UserMenuMinimal } from "./_authenticated/-components/user-menu-minimal";
import { TrashDialog } from "./_authenticated/-components/trash-dialog";
import { InboxPanelBody, SidebarInbox } from "./_authenticated/-components/sidebar-inbox";
import { SidebarWorkspacesMinimal } from "./_authenticated/-components/sidebar-workspaces-minimal";
import {
  EditorHeaderVisibilityProvider,
  useEditorHeaderVisibility,
} from "@/contexts/editor-header-visibility-context";
import { MinimalSidebarProvider, useMinimalSidebar } from "@/contexts/minimal-sidebar-context";
import { log } from "evlog";
import {
  createFormLocal,
  createWorkspaceLocal,
  initCollections,
  isInitialized as isCollectionsInitialized,
} from "@/collections";
import type { Form } from "@/collections";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileRightDrawer } from "@/components/ui/mobile-right-drawer";
import { useOrgForms, useOrgWorkspaces, useSubmissionCounts } from "@/hooks/use-live-hooks";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { auth } from "@/lib/auth/auth-client";
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
import { useSubmissionNotifications } from "@/hooks/use-submission-notifications";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import {
  workspacesCollectionQueryOptions,
  formListingsCollectionQueryOptions,
  favoritesCollectionQueryOptions,
  fetchWorkspacesWithEmptyForms,
} from "@/lib/server-fn/query-options";
import { getSubmissionsCount } from "@/lib/server-fn/submissions";
import {
  createWorkspace,
  deleteWorkspace,
  reorderWorkspace,
  updateWorkspace,
} from "@/lib/server-fn/workspaces";
import { HOTKEYS } from "@/lib/hotkeys";
import { cn } from "@/lib/utils";
import { authMiddleware } from "@/lib/auth/middleware";
import { formatForDisplay, HotkeysProvider, useHotkey } from "@tanstack/react-hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useLocation, useParams, useRouter } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { generateKeyBetween } from "fractional-indexing";
import { getLeadingSortIndex } from "@/lib/sort-utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type * as React from "react";
import { Activity, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SettingsDialog } from "./_authenticated/-components/settings/settings-dialog";
import { FormSettingsSidebar } from "@/components/form-builder/form-settings-sidebar";
import { ShareSummarySidebar } from "@/components/form-builder/share-summary-sidebar";
import { VersionHistorySidebar } from "@/components/form-builder/version-history-sidebar";
import { CustomizeSidebar } from "@/components/ui/customize-sidebar";

/**
 * <Activity> keeps each sidebar tree alive across toggles — no Form remount, scroll/field state preserved.
 * Per-sidebar epoch counter (hidden→visible) keys inner Accordion only: reopen resets section expand to initialOpen, form/scroll stay mounted.
 * key={formId} hard-remounts on form nav. `history` excluded — one-shot, rarely toggled.
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
            {formId && <FormSettingsSidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
      {openedShare && (
        <SidebarSectionResetProvider value={shareEpoch}>
          <Activity mode={showShare ? "visible" : "hidden"}>
            {formId && <ShareSummarySidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
      {activeSidebar === "history" && formId && <VersionHistorySidebar formId={formId} />}
      {openedCustomize && (
        <SidebarSectionResetProvider value={customizeEpoch}>
          <Activity mode={showCustomize ? "visible" : "hidden"}>
            {formId && <CustomizeSidebar key={formId} formId={formId} />}
          </Activity>
        </SidebarSectionResetProvider>
      )}
    </>
  );
};

const initCollectionsOnClient = createClientOnlyFn((queryClient: QueryClient) => {
  if (isCollectionsInitialized()) return;

  initCollections(queryClient, {
    getWorkspacesWithForms: async () => ({
      workspaces: await fetchWorkspacesWithEmptyForms(),
    }),
    getFormListings: () => getFormListingsServer(),
    getFormDetail: async (formId: string) => {
      const { getFormbyIdQueryOption } = await import("@/lib/server-fn/forms-queries");
      const result = await queryClient.ensureQueryData(getFormbyIdQueryOption(formId));
      // FLAG: `result.form` is the serialized DB row, which lacks `liveSettings`, so it is NOT a full
      // `Form`. The declared `getFormDetail: Promise<Form | null>` contract genuinely diverges from
      // the real server shape. Fully closing the gap means changing that contract (collections/
      // _state.ts) + aligning formToListing (collections/operations.ts) — out of this file's scope,
      // so the divergence is asserted at this single boundary instead of hidden behind `any`.
      return (result?.form ?? null) as unknown as Form | null;
    },
    getFavorites: () => getFavoritesServer(),
    getVersionList: async (formId: string) => {
      const result = await getFormVersions({ data: { formId } });
      return result?.versions ?? [];
    },
    getVersionContent: async (versionId: string) => {
      const result = await getFormVersionContent({ data: { versionId } });
      return result?.version ?? null;
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

  // HotkeysProvider mounted here (not in __root) so @tanstack/react-hotkeys (~44.6 kB gz) only
  // lands in the authenticated chunk — public-form routes ($shortId, $slug, f/$formId) skip it.
  return (
    <HotkeysProvider defaultOptions={{ hotkey: { preventDefault: true } }}>
      <SidebarProvider style={{ "--app-header-height": "44px" } as React.CSSProperties}>
        <EditorHeaderVisibilityProvider enabled={isEditRoute}>
          <MinimalSidebarProvider>
            <AuthLayoutContent />
          </MinimalSidebarProvider>
        </EditorHeaderVisibilityProvider>
      </SidebarProvider>
    </HotkeysProvider>
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
      // Prefetch via TanStack DB's query keys — seeds cache so collections init warm.
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
  // history/customize sidebars edit-route-only — derived guard, not useEffect cleanup.
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
          {/* Mobile: sidebar is a drawer overlay, don't pad content (was too narrow on phones). Desktop: push-to-resize. */}
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

        {/* Resize handle desktop-only — nothing to resize when sidebar is a drawer. */}
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

  const [trashDialogOpen, setTrashDialogOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");

  const handleOpenTrash = useCallback(() => setTrashDialogOpen(true), []);

  // Subscribe to loader-primed org query (not loader data) to stay active: refetch on focus/reconnect, react to invalidation, no GC while on screen.
  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });
  const { data: workspacesData } = useOrgWorkspaces(activeOrg?.id);
  const { data: formsData } = useOrgForms(activeOrg?.id);
  const submissionCounts = useSubmissionCounts();
  // Recently-opened forms (localStorage, no DB round-trip) resolved against the live listings; fall
  // back to most-recently-updated when there's no open history yet. Top 4 feed Recent Searches.
  const recentFormIds = useRecentFormIds();
  const formById = useMemo(
    () => new Map((formsData ?? []).map((form) => [form.id, form])),
    [formsData],
  );
  const recentForms = useMemo(() => {
    const opened = recentFormIds
      .map((id) => formById.get(id))
      .filter((form): form is NonNullable<typeof form> => Boolean(form));
    return (opened.length > 0 ? opened : (formsData ?? [])).slice(0, 4);
  }, [recentFormIds, formById, formsData]);
  const { unreadSubmissionCount } = useSubmissionNotifications({ poll: true });

  // Figma 26612:40177 — file-doc + title + right-aligned meta (response count, or "Draft").
  const renderPaletteForm = (form: NonNullable<typeof formsData>[number]) => {
    const count = submissionCounts.get(form.id) ?? 0;
    const meta =
      form.status === "draft" ? "Draft" : `${count} ${count === 1 ? "response" : "responses"}`;
    const isPublished = form.status === "published";
    return (
      <CommandItem
        key={form.id}
        value={`${form.title || "Untitled form"} ${form.id}`}
        onSelect={() => {
          setIsPaletteOpen(false);
          setPaletteSearch("");
          void router.navigate({
            to: isPublished
              ? "/workspace/$workspaceId/form-builder/$formId/submissions"
              : "/workspace/$workspaceId/form-builder/$formId/edit",
            params: { workspaceId: form.workspaceId, formId: form.id },
          });
        }}
      >
        <ThemedFormIcon
          icon={form.icon}
          customization={form.customization as Record<string, string> | undefined}
          monochrome
          size="16"
          iconSize="16"
        />
        <span className="min-w-0 flex-1 truncate">{form.title || "Untitled form"}</span>
        <CommandShortcut className="shrink-0">{meta}</CommandShortcut>
      </CommandItem>
    );
  };
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

  // Mobile: Notifications pushes inbox into the drawer (floating panel has no anchor when sidebar is a drawer).
  const showMobileInbox = isMobile && isInboxOpen;

  return (
    <>
      {/* [font-variation-settings:normal] un-pins the global opsz20/wght450 so font-weight utils apply */}
      <Sidebar className="h-screen border-r-[0.5px] bg-background [font-variation-settings:normal]">
        {showMobileInbox ? (
          <InboxPanelBody
            onClose={closeInbox}
            headerLeft={
              <Button
                variant="ghost-flat"
                size="icon"
                className="size-7 rounded-lg p-1.25 text-gray-800 hover:text-foreground"
                onClick={closeInbox}
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-4.5" />
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
                          <span className="w-4 shrink-0 rounded-full bg-primary py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
                            <NumberPopIn value={pendingCount} />
                          </span>
                        )}
                      </SidebarItem>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="mt-[13px] px-2">
                <SidebarWorkspacesMinimal
                  activeOrgId={activeOrg?.id}
                  submissionCounts={submissionCounts}
                />
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
              placeholder="Search forms..."
              value={paletteSearch}
              onValueChange={setPaletteSearch}
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {/* Recent Searches (default) → recent forms with response counts; while searching,
                  the same rows cover all forms (Figma 26612:40174). */}
              {paletteSearch.trim().length === 0
                ? recentForms.length > 0 && (
                    <CommandGroup heading="Recent Searches">
                      {recentForms.map(renderPaletteForm)}
                    </CommandGroup>
                  )
                : formsData &&
                  formsData.length > 0 && (
                    <CommandGroup heading="Forms">{formsData.map(renderPaletteForm)}</CommandGroup>
                  )}

              {/* Quick Actions (Figma 26612:40201) */}
              <CommandGroup heading="Quick Actions">
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
                  <span>Create a new form</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    void router.navigate({ to: "/templates" });
                    setIsPaletteOpen(false);
                  }}
                >
                  <FigTilesIcon className="size-4" />
                  <span>Browse templates</span>
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
                        .catch((error) =>
                          log.error({
                            tag: "_authenticated",
                            msg: "create workspace failed",
                            error,
                          }),
                        );
                    }
                    setIsPaletteOpen(false);
                  }}
                >
                  <PlusIcon className="size-4" />
                  <span>New workspace</span>
                </CommandItem>
              </CommandGroup>
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
            <CommandFooter />
          </Command>
        </CommandDialog>
      )}

      <TrashDialog
        open={trashDialogOpen}
        onOpenChange={setTrashDialogOpen}
        activeOrgId={activeOrg?.id}
      />

      <Suspense fallback={null}>
        <SettingsDialog />
      </Suspense>
    </>
  );
};
