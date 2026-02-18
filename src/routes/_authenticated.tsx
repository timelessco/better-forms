import { FormSettingsSidebar } from "@/components/form-builder/form-settings-sidebar";
import { ShareSummarySidebar } from "@/components/form-builder/share-summary-sidebar";
import { VersionHistorySidebar } from "@/components/form-builder/version-history-sidebar";
import { useTheme } from "@/components/ThemeProvider";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import {
  type ImperativePanelHandle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlphabeticalIcon,
  BellIcon,
  CalendarIcon,
  ChevronDownIcon,
  ClockFastForwardIcon,
  ClockRewindIcon,
  CopyIcon,
  HomeIcon,
  MoreHorizontalIcon,
  Pencil2Icon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
} from "@/components/ui/sidebar-icons";
import {
  EditorHeaderVisibilityProvider,
  useEditorHeaderVisibility,
} from "@/contexts/editor-header-visibility-context";
import { MinimalSidebarProvider, useMinimalSidebar } from "@/contexts/minimal-sidebar-context";
import {
  createFormLocal,
  createWorkspaceLocal,
  deleteWorkspaceLocal,
  duplicateFormById,
  favoriteCollection,
  formCollection,
  formSettingsCollection,
  formVersionCollection,
  permanentDeleteFormLocal,
  restoreFormLocal,
  submissionCollection,
  updateFormStatus,
  updateWorkspaceName,
  workspaceCollection,
} from "@/db-collections";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import {
  useArchivedForms,
  useFavoriteForms,
  useForms,
  useSubmissionCounts,
  useWorkspaces,
} from "@/hooks/use-live-hooks";
import { auth, useSession } from "@/lib/auth-client";
import { orgDataForLayoutQueryOptions } from "@/lib/fn/org";
import { getUserMembershipsQueryOptions } from "@/lib/fn/workspaces";
import { cn } from "@/lib/utils";
import { authMiddleware } from "@/middleware/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronsLeft,
  Feather,
  FileText,
  Filter,
  Github,
  GripVertical,
  HelpCircle,
  Home,
  Loader2,
  LogOut,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Star,
  Sun,
  Trash2,
  TrashIcon,
  Undo2,
  Users,
  Zap
} from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";

// Route configuration
export const Route = createFileRoute("/_authenticated")({
  server: {
    middleware: [authMiddleware],
  },
  component: AuthLayout,
  loader: async ({ context }) => {
    // Pre-fetch org data via ensureQueryData (like my-account pattern)
    const { activeOrg, orgsData } = await context.queryClient.ensureQueryData({
      ...orgDataForLayoutQueryOptions(),
      revalidateIfStale: true,
    });
    // Seed auth.organization cache so useQuery in org-switcher, billing, etc. works
    context.queryClient.setQueryData(
      auth.organization.getFullOrganization.queryKey(),
      activeOrg,
    );
    context.queryClient.setQueryData(
      auth.organization.list.queryKey(),
      orgsData,
    );
    // Start Electric sync for all collections - client-only since Electric
    // requires browser cookies for auth and server-side preload would fail
    if (typeof window !== "undefined") {
      await Promise.all([
        workspaceCollection.preload(),
        formCollection.preload(),
        submissionCollection.preload(),
        favoriteCollection.preload(),
        formVersionCollection.preload(),
        formSettingsCollection.preload(),
      ]);
    }
    return { activeOrg, orgsData };
  },
  staleTime: 500000,// 500 seconds
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
  ssr: "data-only",
});

const TypedResizableHandle = ResizableHandle as any;

function AuthLayout() {
  const { pathname } = useLocation();
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
}

function AuthLayoutContent() {
  const location = useLocation();
  const { pathname } = location;
  const isEditRoute = pathname.includes("/form-builder/") && pathname.endsWith("/edit");
  const { visible: isHeaderVisible, reportPointerActivity } = useEditorHeaderVisibility();
  const [resizeTooltip, setResizeTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
  });

  const { formId } = useParams({ strict: false }) as { formId?: string };

  // Editor sidebar management
  const navigate = useNavigate();
  const search: any = useSearch({ strict: false });
  const sidebarParam = search.sidebar;
  const { activeSidebar, setActiveSidebar, resetSidebar, closeSidebar } = useEditorSidebar();

  // Close sidebar and update URL to clear sidebar param
  const handleCloseSidebar = useCallback(() => {
    closeSidebar();
    navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, sidebar: "" }),
      replace: true,
    });
  }, [closeSidebar, navigate]);
  const handleRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const [handleLeft, setHandleLeft] = useState(0);
  const handleDragRef = useRef({ dragging: false, startX: 0, startY: 0 });
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Initialize sidebar state from URL params on mount only
  // Changes should be handled via event handlers (router navigation)
  useEffect(() => {
    if (sidebarParam) {
      setActiveSidebar(sidebarParam);
    } else {
      resetSidebar();
    }
  }, []);

  const isFormBuilder = pathname.includes("/form-builder/");
  const showEditorSidebar = !!(activeSidebar && isFormBuilder && formId);
  const isDistractionHeaderHidden = isEditRoute && !isHeaderVisible;

  const updateHandleLeft = useCallback(() => {
    const node = leftPanelRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setHandleLeft(rect.right);
  }, []);

  useLayoutEffect(() => {
    updateHandleLeft();
  }, [updateHandleLeft]);

  useEffect(() => {
    const onResize = () => updateHandleLeft();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateHandleLeft]);

  useEffect(() => {
    if (!leftPanelRef.current) return;
    const observer = new ResizeObserver(() => updateHandleLeft());
    observer.observe(leftPanelRef.current);
    return () => observer.disconnect();
  }, [updateHandleLeft]);

  // Imperatively control right panel expand/collapse
  useEffect(() => {
    if (rightPanelRef.current) {
      if (showEditorSidebar) {
        rightPanelRef.current.expand();
      } else {
        rightPanelRef.current.collapse();
      }
    }
  }, [showEditorSidebar]);

  // Bug 2 fix: Sync sidebar state with URL param changes
  useEffect(() => {
    if (sidebarParam && sidebarParam !== activeSidebar) {
      setActiveSidebar(sidebarParam);
    } else if (!sidebarParam && activeSidebar) {
      closeSidebar();
    }
  }, [sidebarParam, activeSidebar, setActiveSidebar, closeSidebar]);

  return (
    <>
      <AppSidebar />
      <SidebarInbox />

      <SidebarInset className="overflow-hidden relative flex flex-col h-screen">
        {isDistractionHeaderHidden && (
          <div
            className="fixed inset-x-0 top-0 z-[1200] h-3 bg-transparent"
            onMouseEnter={reportPointerActivity}
            aria-hidden="true"
          />
        )}
        <div className="relative z-0">
          <AppHeader
            dividerX={handleLeft}
            isSidebarOpen={showEditorSidebar}
            isDistractionHidden={isDistractionHeaderHidden}
          />
        </div>

        <div className="relative z-20 flex-1 min-h-0 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Main content panel - non-resizable */}
            <ResizablePanel
              defaultSize={showEditorSidebar ? 70 : 100}
              minSize={70}
              className="transition-all duration-300 ease-in-out"
            >
              <div ref={leftPanelRef} className={cn("flex h-full min-w-0 flex-col z-50")}>
                <Outlet key={formId} />
              </div>
            </ResizablePanel>

            {/* Resize handle - draggable, click to close */}
            <TypedResizableHandle
              className={cn(
                "fixed top-0 bottom-0 left-(--handle-left) -translate-x-1/2 w-px",
                "bg-border/60 z-[999] pointer-events-auto",
                "transition-none duration-0 hover:w-px data-[resize-handle-state=drag]:w-px",
                !showEditorSidebar && "hidden pointer-events-none",
              )}
              ref={handleRef}
              style={{ "--handle-left": `${handleLeft}px` } as React.CSSProperties}
              onDragging={(isDragging: boolean) => {
                handleDragRef.current.dragging = isDragging;
              }}
              onPointerDown={() => {
                handleDragRef.current.dragging = false;
                updateHandleLeft();
              }}
              onPointerMove={() => {
                updateHandleLeft();
              }}
              onPointerUp={() => {
                if (!handleDragRef.current.dragging && activeSidebar) handleCloseSidebar();
                handleDragRef.current.dragging = false;
              }}
              onMouseEnter={(event: any) => {
                setResizeTooltip({ visible: true, x: event.clientX, y: event.clientY });
              }}
              onMouseMove={(event: any) => {
                setResizeTooltip((prev) => ({
                  ...prev,
                  x: event.clientX,
                  y: event.clientY,
                }));
              }}
              onMouseLeave={() => {
                setResizeTooltip((prev) => ({ ...prev, visible: false }));
              }}
            >
              <div
                className={cn(
                  "pointer-events-none fixed",
                  "rounded-md border border-foreground/10 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-lg",
                  "transition-opacity duration-150",
                  resizeTooltip.visible ? "opacity-100" : "opacity-0",
                )}
                style={{
                  left: resizeTooltip.x - 12,
                  top: resizeTooltip.y + 12,
                  transform: "translateX(-100%)",
                }}
              >
                <div className="leading-4">
                  <div>Close Click</div>
                  <div>Resize Drag</div>
                </div>
              </div>
            </TypedResizableHandle>

            {/* Right sidebar - Settings/Share/History, resizable */}
            <ResizablePanel
              ref={rightPanelRef}
              collapsible
              collapsedSize={0}
              defaultSize={showEditorSidebar ? 40 : 0}
              minSize={30}
              maxSize={50}
              className={cn(
                "h-full overflow-hidden transition-all duration-300 ease-in-out bg-background",
                !showEditorSidebar && "border-none",
              )}
            >
              <div className="h-full w-full">
                {activeSidebar === "settings" && formId && <FormSettingsSidebar formId={formId} />}
                {activeSidebar === "share" && formId && <ShareSummarySidebar formId={formId} />}
                {activeSidebar === "history" && formId && <VersionHistorySidebar formId={formId} />}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarInset>
    </>
  );
}

// Minimal Sidebar Item Component (Figma system-flat: form list item with icon, title, optional count)
interface SidebarItemProps {
  to?: string;
  label: string;
  isNested?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  prefix?: React.ReactNode;
}

function SidebarItem({
  to,
  label,
  isActive,
  onClick,
  prefix,
  children,
}: SidebarItemProps & { children?: React.ReactNode }) {
  const Component: React.ElementType = to ? Link : "button";
  const componentProps = to ? { to } : { type: "button" as const };

  return (
    <Component
      {...componentProps}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between gap-x-2.5 rounded-lg px-2 py-[7px] text-[14px] font-medium transition-colors relative cursor-pointer h-[30px] overflow-clip",
        "text-accent-foreground",
        !isActive && "hover:bg-muted",
        isActive && "bg-secondary text-accent-foreground",
      )}
    >
      <span className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
        <div className="flex items-center justify-center shrink-0">{prefix}</div>
        <span className="truncate leading-[1.15] font-case tracking-1">{label}</span>
      </span>
      {children}
    </Component>
  );
}

// App Sidebar Component using shadcn/ui
function AppSidebar() {
  const { toggleSidebar } = useSidebar();
  const { isInboxOpen, setIsInboxOpen } = useMinimalSidebar();
  const location = useLocation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const {
    toggle: togglePalette,
    isOpen: isPaletteOpen,
    setIsOpen: setIsPaletteOpen,
  } = useCommandPalette();

  // Trash dialog state
  const [trashDialogOpen, setTrashDialogOpen] = useState(false);

  // Get pre-fetched data from route loader for immediate render
  const { activeOrg, orgsData } = Route.useLoaderData();
  const { data: membersData } = useQuery(auth.organization.listMembers.queryOptions());
  const { data: workspacesData } = useWorkspaces();

  const { data: invitations } = useQuery(auth.organization.listUserInvitations.queryOptions());
  const pendingCount = (invitations ?? []).filter((inv: any) => inv.status === "pending").length;

  const { data: session } = useSession();

  const signOutMutation = useMutation(
    auth.signOut.mutationOptions({
      onSuccess: () => {
        localStorage.removeItem("electricAuthToken");
        localStorage.clear();
        router.invalidate();
        router.navigate({ to: "/" });
      },
    }),
  );

  const { data: orgs } = useQuery(auth.organization.list.queryOptions());
  const { data: membershipsData } = useQuery(getUserMembershipsQueryOptions());

  const roleByOrgId = useMemo(() => {
    const map: Record<string, string> = {};
    membershipsData?.memberships?.forEach((m) => {
      map[m.organizationId] = m.role;
    });
    return map;
  }, [membershipsData]);

  const setActiveOrgMutation = useMutation(
    auth.organization.setActive.mutationOptions({
      onSuccess: async () => {
        // Invalidate and wait for refetch before navigating
        await queryClient.invalidateQueries({
          queryKey: ["organization", "getFullOrganization"],
          refetchType: "all",
        });
        await queryClient.invalidateQueries({
          queryKey: ["workspaces-with-forms"],
          refetchType: "all",
        });
        router.navigate({ to: "/dashboard" });
      },
    }),
  );

  // Set active organization if user has orgs but none is active (runs for all auth routes)
  useEffect(() => {
    if (!session?.user) return;
    if (!activeOrg && orgsData && orgsData.length > 0) {
      setActiveOrgMutation.mutate({ organizationId: orgsData[0].id });
    }
  }, [activeOrg, orgsData, session, setActiveOrgMutation]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        togglePalette();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [togglePalette]);

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = activeOrg?.name || session?.user?.name || "User";

  return (
    <>
      <Sidebar className="border-r-[0.5px] bg-background h-screen">
        <SidebarHeader className="h-12 pl-3.5 pr-2 pt-2 pb-0 flex flex-row items-center justify-between group/logo">
          <Logo className="h-5.5 w-5.5 text-sidebar-foreground" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleSidebar()}
            className="hover:bg-sidebar-active text-light-gray-400 hover:text-light-gray-900 group-data-[state=collapsed]:hidden"
            title="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="pt-2 py-0">
            <SidebarGroupContent className="">
              {/* Nav items: Figma system-flat node 23504-5047 - pixel-perfect */}
              <SidebarMenu className="gap-0">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/dashboard"}
                    tooltip="All"
                    className="h-[30px] min-w-0 rounded-lg px-2 py-[7px] gap-2 transition-colors hover:bg-sidebar-active data-[active=true]:bg-sidebar-active"
                  >
                    <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center size-5 shrink-0">
                        <HomeIcon className="h-[18px] w-[18px] text-muted-foreground" />
                      </div>
                      <span className="text-[14px] font-medium font-var-medium-14 text-light-gray-800 dark:text-dark-gray-800 tracking-[0.14px] leading-tight font-case truncate">All</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={togglePalette}
                    tooltip="Search"
                    className="h-[30px] min-w-0 rounded-lg px-2 py-[7px] gap-2 transition-colors hover:bg-sidebar-active"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center size-5 shrink-0">
                        <SearchIcon className="h-[18px] w-[18px] text-muted-foreground" />
                      </div>
                      <span className="text-[14px] font-var-medium-14 text-light-gray-800 dark:text-dark-gray-800 tracking-[0.14px] leading-tight font-case truncate">Search</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setIsInboxOpen(!isInboxOpen)}
                    isActive={isInboxOpen}
                    tooltip={pendingCount > 0 ? `Notifications (${pendingCount})` : "Notifications"}
                    className="h-[30px] min-w-0 rounded-lg px-2 py-[7px] gap-2 transition-colors hover:bg-sidebar-active data-[active=true]:bg-sidebar-active"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="relative flex items-center justify-center size-5 shrink-0">
                        <BellIcon className="h-[18px] w-[18px] text-muted-foreground" />
                        {pendingCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background" />
                        )}
                      </div>
                      <span className="text-[14px] font-medium font-var-medium-14 text-light-gray-800 dark:text-dark-gray-800 tracking-[0.14px] leading-tight font-case truncate flex-1 min-w-0">Notifications</span>
                      {pendingCount > 0 && (
                        <span className="text-[10px] bg-blue-500 text-white  py-0.5 rounded-full font-semibold shrink-0 tabular-nums">
                          {pendingCount}
                        </span>
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith("/settings")}
                    tooltip="Settings"
                    className="h-[30px] min-w-0 rounded-lg px-2 py-[7px] gap-2 transition-colors hover:bg-sidebar-active data-[active=true]:bg-sidebar-active"
                  >
                    <Link to="/settings/my-account" className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center size-5 shrink-0">
                        <SettingsIcon className="h-[18px] w-[18px] text-muted-foreground" />
                      </div>
                      <span className="text-[14px] font-medium font-var-medium-14 text-light-gray-800 dark:text-dark-gray-800 tracking-[0.14px] leading-tight font-case truncate">Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mt-[15px] px-2">
            <SidebarWorkspacesMinimal activeOrgId={activeOrg?.id} />
          </div>
        </SidebarContent>

        <SidebarFooter className="p-0 pt-2 pb-2 flex shrink-0 flex-col gap-4">
          <FreePlanCard />
          <UserMenuMinimal
            session={session}
            activeOrg={activeOrg}
            orgs={orgs}
            displayName={displayName}
            getInitials={getInitials}
            setActiveOrgMutation={setActiveOrgMutation}
            signOutMutation={signOutMutation}
            router={router}
            theme={theme}
            setTheme={setTheme as (theme: string) => void}
            onOpenTrash={() => setTrashDialogOpen(true)}
            membersData={membersData}
            roleByOrgId={roleByOrgId}
          />
        </SidebarFooter>
        {/* <SidebarRail /> */}
      </Sidebar>

      {/* Command Palette */}
      <CommandDialog open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <CommandInput placeholder="Search for forms and help articles" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={async () => {
                setIsPaletteOpen(false);
                if (activeOrg && workspacesData) {
                  const orgWorkspaces = workspacesData.filter(
                    (ws) => ws.organizationId === activeOrg.id,
                  );
                  if (orgWorkspaces.length > 0) {
                    // Use workspace from URL if available, otherwise use first workspace
                    const workspaceMatch = location.pathname.match(/\/workspace\/([^/]+)/);
                    const currentWorkspaceId = workspaceMatch?.[1];
                    const targetWorkspace = currentWorkspaceId
                      ? orgWorkspaces.find((ws) => ws.id === currentWorkspaceId) || orgWorkspaces[0]
                      : orgWorkspaces[0];

                    const newForm = await createFormLocal(targetWorkspace.id);
                    router.navigate({
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
              <Plus className="mr-2 h-4 w-4" />
              <span>New form</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                if (activeOrg) {
                  createWorkspaceLocal(activeOrg.id, "Collection")
                    .then((workspace) => {
                      router.navigate({
                        to: "/workspace/$workspaceId",
                        params: { workspaceId: workspace.id },
                      });
                    })
                    .catch(console.error);
                }
                setIsPaletteOpen(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>New workspace</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => {
                router.navigate({ to: "/dashboard" });
                setIsPaletteOpen(false);
              }}
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Go to home</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                router.navigate({ to: "/settings" });
                setIsPaletteOpen(false);
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Go to settings</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setTrashDialogOpen(true);
                setIsPaletteOpen(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Trash</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                signOutMutation.mutate({});
                setIsPaletteOpen(false);
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Trash Dialog */}
      <TrashDialog
        open={trashDialogOpen}
        onOpenChange={setTrashDialogOpen}
        activeOrgId={activeOrg?.id}
      />
    </>
  );
}

// Trash Dialog Component
function TrashDialog({
  open,
  onOpenChange,
  activeOrgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeOrgId?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: archivedFormsData } = useArchivedForms();
  const { data: workspacesData } = useWorkspaces();

  // Get archived forms filtered by active organization
  const archivedForms = useMemo(() => {
    if (!activeOrgId || !archivedFormsData || !workspacesData) return [];

    // Get workspace IDs belonging to active org
    const orgWorkspaceIds = new Set(
      workspacesData.filter((ws) => ws.organizationId === activeOrgId).map((ws) => ws.id),
    );

    // Filter forms that belong to org's workspaces
    return archivedFormsData
      .filter((form) => orgWorkspaceIds.has(form.workspaceId))
      .filter(
        (form) => !searchQuery || form.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .toSorted(
        (a, b) =>
          new Date(b.deletedAt || b.updatedAt).getTime() -
          new Date(a.deletedAt || a.updatedAt).getTime(),
      );
  }, [archivedFormsData, workspacesData, activeOrgId, searchQuery]);

  // Create a map of workspace names
  const workspaceNames = useMemo(() => {
    if (!workspacesData) return {};
    return workspacesData.reduce(
      (acc, ws) => {
        acc[ws.id] = ws.name;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [workspacesData]);

  const handleRestore = async (formId: string) => {
    try {
      await restoreFormLocal(formId);
    } catch (error) {
      console.error("Failed to restore form:", error);
    }
  };

  const handlePermanentDelete = async (formId: string) => {
    try {
      await permanentDeleteFormLocal(formId);
    } catch (error) {
      console.error("Failed to delete form:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 bg-background border-foreground/10">
        {/* Search Input */}
        <div className="p-3 border-b border-foreground/5">
          <Input
            placeholder="Search pages in Trash"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
        </div>

        {/* Forms List */}
        <div className="max-h-[400px] overflow-y-auto">
          {archivedForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trash2 className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Trash is empty</p>
            </div>
          ) : (
            <div className="p-1">
              {archivedForms.map((form) => (
                <div
                  key={form.id}
                  className="group flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {form.title || "Untitled"}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 truncate">
                        {workspaceNames[form.workspaceId] || "Unknown workspace"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRestore(form.id)}
                      className="h-7 w-7"
                      title="Restore"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handlePermanentDelete(form.id)}
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-foreground/5 bg-muted/20">
          <p className="text-[11px] text-muted-foreground/60">
            Pages in Trash for over 30 days will be automatically deleted
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground/40 hover:text-muted-foreground"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Sidebar Inbox Panel Component
function SidebarInbox() {
  const { isInboxOpen, setIsInboxOpen } = useMinimalSidebar();
  const { state } = useSidebar();
  const queryClient = useQueryClient();
  const prevOpenRef = useRef(isInboxOpen);
  const [isExiting, setIsExiting] = useState(false);
  const [applyExitClass, setApplyExitClass] = useState(false);

  // Start exit animation when closing - set isExiting so we keep rendering (prevents flash)
  useEffect(() => {
    if (isInboxOpen) {
      prevOpenRef.current = true;
      setIsExiting(false);
      setApplyExitClass(false);
    } else if (prevOpenRef.current) {
      setIsExiting(true);
      prevOpenRef.current = false;
    }
  }, [isInboxOpen]);

  // Apply exit class after mount so transition runs (visible -> slide out)
  useLayoutEffect(() => {
    if (!isExiting) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setApplyExitClass(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isExiting]);

  // Unmount after transition - use both transitionend and setTimeout fallback (Safari can be unreliable with transitionend)
  const EXIT_DURATION_MS = 250;
  useEffect(() => {
    if (!isExiting) return;
    const timeoutId = setTimeout(() => {
      setIsExiting(false);
    }, EXIT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [isExiting]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === "transform") setIsExiting(false);
  }, []);

  // Fetch invitations received by current user
  const { data: invitations } = useQuery(auth.organization.listUserInvitations.queryOptions());

  // Helper to refetch invitations on error (stale data)
  const handleError = (error: any) => {
    const message = error?.message || "Something went wrong";
    toast.error(message);
    // Refetch to clear stale invitations
    queryClient.invalidateQueries({
      queryKey: auth.organization.listUserInvitations.queryKey(),
    });
  };

  // Accept/Reject mutations
  const acceptMutation = useMutation(
    auth.organization.acceptInvitation.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation accepted!");
        queryClient.invalidateQueries({
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
        queryClient.invalidateQueries({
          queryKey: auth.organization.listUserInvitations.queryKey(),
        });
      },
      onError: handleError,
    }),
  );

  // Keep mounted during "closing" transition - avoid return null before effect sets isExiting (which would cause flash: close → open → close)
  if (!isInboxOpen && !isExiting && !prevOpenRef.current) return null;

  // Only show pending invitations
  const pendingInvitations = (invitations ?? []).filter((inv: any) => inv.status === "pending");

  return (
    <div
      className={cn(
        "fixed z-40 flex w-80 flex-col bg-background select-none border-r border-foreground/5 top-0 bottom-0",
        "transition-[left,opacity] duration-150 ease-out",
        state === "expanded" ? "left-(--sidebar-width)" : "left-(--sidebar-width-icon)",
        applyExitClass && "opacity-0",
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 h-10 border-b border-foreground/5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-bold text-foreground">Inbox</h2>
          {pendingInvitations.length > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {pendingInvitations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsInboxOpen(false)}
            className="h-6 w-7 mr-1"
            title="Collapse"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
          >
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
        <div className="px-1 overflow-hidden">
          {/* Invitations Section */}
          {pendingInvitations.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest mb-3 px-2">
                Invitations
              </p>
              <div className="space-y-1 mb-4">
                {pendingInvitations.map((invitation) => {
                  const isProcessing =
                    (acceptMutation.isPending &&
                      acceptMutation.variables?.invitationId === invitation.id) ||
                    (rejectMutation.isPending &&
                      rejectMutation.variables?.invitationId === invitation.id);

                  return (
                    <div
                      key={invitation.id}
                      className="group flex flex-col gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-foreground/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded bg-foreground/5 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground leading-tight">
                            You've been invited to join{" "}
                            <span className="font-bold">
                              {(invitation as any).organization?.name ?? "an organization"}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                            Role: <span className="capitalize">{invitation.role}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-11">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-3"
                          disabled={isProcessing}
                          onClick={() => acceptMutation.mutate({ invitationId: invitation.id })}
                        >
                          {acceptMutation.isPending &&
                            acceptMutation.variables?.invitationId === invitation.id
                            ? "Accepting..."
                            : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-3"
                          disabled={isProcessing}
                          onClick={() => rejectMutation.mutate({ invitationId: invitation.id })}
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

          {/* Older / Other notifications section (for future extensibility) */}
          <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest mb-3 px-2">
            {pendingInvitations.length > 0 ? "Other" : "Notifications"}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-center py-8 text-muted-foreground/40">
              <p className="text-xs">No other notifications</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// User Menu Component - styled to match sidebar design tokens
function UserMenuMinimal({
  session,
  activeOrg,
  orgs,
  displayName,
  getInitials,
  setActiveOrgMutation,
  signOutMutation,
  router,
  theme,
  setTheme,
  onOpenTrash,
  membersData,
  roleByOrgId,
}: {
  session: any;
  activeOrg: any;
  orgs: any;
  displayName: string;
  getInitials: (name?: string | null) => string;
  setActiveOrgMutation: any;
  signOutMutation: any;
  router: any;
  theme: string;
  setTheme: (theme: string) => void;
  onOpenTrash: () => void;
  membersData: any;
  roleByOrgId: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-menu-container")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative user-menu-container border-t border-b pt-[4.8px] pb-2 bg-background">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 h-8 w-full min-w-0 rounded-md hover:bg-sidebar-active justify-start"
        aria-label="Toggle user menu"
      >
        <div className="h-6 w-6 rounded-full overflow-hidden bg-sidebar-active flex items-center justify-center text-[10px] font-bold shrink-0">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(displayName)
          )}
        </div>
        <span className="text-[14px] font-medium text-sidebar-foreground truncate flex-1 text-left tracking-[0.14px]">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </Button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-background border rounded-xl shadow-[0px_4px_16px_rgba(0,0,0,0.08)] p-1.5 z-100 animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[220px]">
          <div className="px-3 py-2 border-b mb-1.5 flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-sidebar-active flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-bold text-sidebar-foreground truncate">{displayName}</span>
              <span className="text-[11px] text-muted-foreground">Free Plan · {membersData?.members?.length ?? 0} {membersData?.members?.length === 1 ? "member" : "members"}</span>
            </div>
          </div>

          <div className="px-2 py-1 mb-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">
              Account
            </p>
            <div className="space-y-0.5">
              <Button
                variant="ghost"
                onClick={() => {
                  router.navigate({ to: "/settings/my-account" });
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 h-auto justify-start text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-active rounded-lg"
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={1.5} />
                Settings
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 h-auto justify-start text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-active rounded-lg"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />}
                <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenTrash();
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 h-auto justify-start text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-active rounded-lg"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Trash
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  router.navigate({ to: "/settings/members" });
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 h-auto justify-start text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-active rounded-lg"
              >
                <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                Members
              </Button>
            </div>
          </div>

          <div className="px-2 py-1 mb-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-1">
              {session?.user?.email}
            </p>
            <div className="space-y-0.5">
              {orgs?.map((org: any) => {
                const role = roleByOrgId[org.id];
                return (
                  <Button
                    variant="ghost"
                    key={org.id}
                    onClick={() => {
                      setActiveOrgMutation.mutate({ organizationId: org.id });
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 h-auto w-full justify-start text-muted-foreground hover:bg-sidebar-active rounded-lg"
                    aria-label={`Switch to ${org.name}`}
                  >
                    <div className="h-5 w-5 rounded bg-sidebar-active flex items-center justify-center text-[9px] font-bold text-sidebar-foreground">
                      {getInitials(org.name)}
                    </div>
                    <span className="text-[13px] font-medium text-foreground group-hover:text-sidebar-foreground flex-1 truncate">{org.name}</span>
                    {role && (
                      <Badge
                        variant={role === "owner" ? "primary" : "outline"}
                        className="text-[9px] px-1.5 py-0 h-4 capitalize"
                      >
                        {role}
                      </Badge>
                    )}
                    {org.id === activeOrg?.id && (
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-foreground/5 my-1" />
          <div className="space-y-0.5 px-1">
            <Button
              variant="ghost"
              onClick={() => {
                signOutMutation.mutate({});
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 h-auto justify-start text-[13px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-active rounded-lg"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
              Log out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Free Plan Card - Figma node 23504-5269 (pixel-perfect)
function FreePlanCard() {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl bg-free-plan-card-bg p-3 mx-3 w-[204px] shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="shrink-0 size-6 rounded flex items-center justify-center bg-teal-100 dark:bg-teal-700/20">
          <Zap className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" strokeWidth={2} fill="currentColor" />
        </div>
        <span className="text-[14px] font-medium text-sidebar-foreground">
          Free Plan
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground tracking-[0.13px] leading-[1.48] mb-3">
        Try Booster to capture high-quality inbound and outbound leads
      </p>
      <Button
        variant="outline"
        className="w-full h-7 text-[13px] font-medium text-sidebar-foreground bg-background border border-border hover:bg-muted rounded-lg shadow-[0px_1px_2px_0px_rgba(0,0,0,0.1)]"
      >
        Try for free
      </Button>
    </div>
  );
}

// Type for workspace with forms from server
type WorkspaceWithForms = {
  id: string;
  organizationId: string;
  createdByUserId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  forms: Array<{
    id: string;
    title: string;
    updatedAt: string;
    workspaceId: string;
    icon?: string | null;
    status: string;
  }>;
};

// Minimal Workspace Item Component
function WorkspaceItemMinimal({
  workspace,
  submissionCounts,
  sortMode,
  onSortChange,
  onRename,
  onDelete,
  onDuplicateForm,
  onDeleteForm,
}: {
  workspace: WorkspaceWithForms;
  submissionCounts: Map<string, number>;
  sortMode: string;
  onSortChange: (mode: "recent" | "oldest" | "alphabetical" | "manual") => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicateForm: (form: WorkspaceWithForms["forms"][0]) => void;
  onDeleteForm: (form: WorkspaceWithForms["forms"][0]) => void;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [isCreatingForm, setIsCreatingForm] = useState(false);

  const handleCreateForm = async () => {
    setIsCreatingForm(true);
    try {
      const newForm = await createFormLocal(workspace.id);
      router.navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId: workspace.id, formId: newForm.id },
      });
    } catch (error) {
      console.error("Failed to create form:", error);
    } finally {
      setIsCreatingForm(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Figma system-flat node 23504-5156: workspace/collection header row */}
      <div className="group flex items-center justify-between px-1 py-[7px] transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 h-auto p-0 cursor-pointer flex-1 min-w-0 justify-start bg-transparent border-none"
          aria-expanded={isOpen}
        >
          <span className="text-[13px] font-medium text-muted-foreground tracking-[0.26px] truncate">
            {workspace.name}
          </span>
          <ChevronDownIcon
            className={cn(
              "h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform duration-200",
              !isOpen && "-rotate-90",
            )}
          />
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 hover:bg-sidebar-active text-muted-foreground hover:text-foreground"
                title="More options"
              >
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[195px]" sideOffset={4}>
              <div className="text-[12px] font-medium text-muted-foreground px-2 py-1.5 tracking-[0.24px]">Sort by</div>
              {[
                { value: "recent", label: "Recent First", icon: CalendarIcon},
                { value: "oldest", label: "Oldest First", icon: ClockRewindIcon },
                { value: "alphabetical", label: "Alphabetical", icon: AlphabeticalIcon },
                { value: "manual", label: "Manual", icon: CopyIcon },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  onClick={() => onSortChange(option.value as "recent" | "oldest" | "alphabetical" | "manual")}
                  className={cn(
                    "w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors",
                    sortMode === option.value
                      ? "bg-black/5 text-[#212121]"
                      : "text-light-gray-800 hover:bg-black/5 hover:text-[#212121]",
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="flex-1 text-left">{option.label}</span>
                  {sortMode === option.value && (
                    <Check className="h-3 w-3" strokeWidth={2} />
                  )}
                </Button>
              ))}
              <div className="my-1 h-px bg-border" />
              <div className="text-[12px] font-medium text-muted-foreground px-2 py-1.5 tracking-[0.24px]">
                Workspace
              </div>
              <Button
                variant="ghost"
                onClick={handleCreateForm}
                disabled={isCreatingForm}
                className={cn(
                  "w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors",
                  "text-light-gray-800 hover:bg-black/5 hover:text-[#212121]",
                )}
              >
                {isCreatingForm ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" strokeWidth={1.5} />
                ) : (
                  <PlusIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                )}
                <span className="flex-1 text-left">New form</span>
              </Button>
              <Button
                variant="ghost"
                onClick={onRename}
                className={cn(
                  "w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors",
                  "text-light-gray-800 hover:bg-black/5 hover:text-[#212121]",
                )}
              >
                <Pencil2Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-left">Rename</span>
              </Button>
              <Button
                variant="ghost"
                onClick={onDelete}
                className={cn(
                  "w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors",
                  "text-red-500/70 hover:text-red-500 hover:bg-red-500/5",
                )}
              >
                <TrashIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 text-left">Delete</span>
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col">
          {workspace.forms.map((form) => (
            <WorkspaceFormMinimal
              key={form.id}
              form={form}
              workspaceId={workspace.id}
              submissionCount={submissionCounts.get(form.id) || 0}
              onDuplicate={() => onDuplicateForm(form)}
              onDelete={() => onDeleteForm(form)}
            />
          ))}
          {workspace.forms.length === 0 && (
            <span className="text-muted-foreground/50 text-[11px] px-8 py-1 italic">
              No forms yet
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Form icons matching Figma system-flat (23504-5089): Contact=star, Employee Intake=teardrop, etc.
const getFormIcon = (title: string, icon?: string | null) => {
  const iconWrapper = "rounded-full size-[18px] flex items-center justify-center border-[0.5px] border-form-icon-border shrink-0";
  const iconFill = "text-foreground fill-foreground";

  if (icon && isEmoji(icon)) return (
    <div className={`bg-form-icon-bg ${iconWrapper}`}>
      <span className="text-xs leading-none">{icon}</span>
    </div>
  );

  const lowerTitle = title.toLowerCase();
  // Contact: white circle, black star (Figma)
  if (lowerTitle.includes("contact")) return (
    <div className={`bg-form-icon-bg shadow-sm ${iconWrapper}`}>
      <Star className="h-3 w-3 fill-foreground text-foreground" />
    </div>
  );
  // Employee Intake: teardrop/inverted triangle
  if (lowerTitle.includes("employee intake")) return (
    <div className={`bg-secondary ${iconWrapper}`}>
      <div className="size-2 bg-foreground rounded-full" style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
    </div>
  );
  // Onboarding: lightning bolt
  if (lowerTitle.includes("onboarding") && !lowerTitle.includes("client")) return (
    <div className={`bg-secondary ${iconWrapper}`}>
      <Zap className={`h-3 w-3 ${iconFill}`} strokeWidth={1} />
    </div>
  );
  // Client Onboarding / feedback: feather
  if (lowerTitle.includes("client onboarding") || lowerTitle.includes("feedback")) return (
    <div className={`bg-secondary ${iconWrapper}`}>
      <Feather className="h-3 w-3 text-foreground" strokeWidth={1.5} />
    </div>
  );
  // Open source: GitHub
  if (lowerTitle.includes("open source")) return (
    <div className={`bg-secondary ${iconWrapper}`}>
      <Github className={`h-3 w-3 ${iconFill}`} strokeWidth={1} />
    </div>
  );

  // Default: sparkle in white circle
  return (
    <div className={`bg-form-icon-bg ${iconWrapper}`}>
      <span className="text-xs leading-none">✨</span>
    </div>
  );
};


function isEmoji(str: string): boolean {
  if (!str) return false;
  const emojiRange = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return str.length <= 4 && emojiRange.test(str);
}

function WorkspaceFormMinimal({
  form,
  workspaceId,
  submissionCount,
  onDuplicate,
  onDelete,
}: {
  form: { id: string; title: string; icon?: string | null; workspaceId: string; status: string };
  workspaceId: string;
  submissionCount: number;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const location = useLocation();
  const isPublishedForm = form.status === "published";
  const to = isPublishedForm
    ? `/workspace/${workspaceId}/form-builder/${form.id}/submissions`
    : `/workspace/${workspaceId}/form-builder/${form.id}/edit`;
  const isActive = location.pathname.startsWith(`/workspace/${workspaceId}/form-builder/${form.id}`);
  const label = form.title || "Untitled";

  const prefix = getFormIcon(label, form.icon);

  const isPublished = form.status === "published";
  const showCount = isPublished && submissionCount > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          <SidebarItem label={label} to={to} isActive={isActive} prefix={prefix}>
            {showCount && (
              <span className="text-[11px] tracking-[0.33px] text-muted-foreground tabular-nums shrink-0 font-medium leading-[1.15] font-case">
                {submissionCount}
              </span>
            )}
          </SidebarItem>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[195px] rounded-2xl p-1 shadow-popover border-0 outline-hidden">
        <div className="text-[12px] font-medium text-muted-foreground px-2 py-1.5 tracking-[0.24px]">
          Form
        </div>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors text-light-gray-800 hover:bg-black/5 hover:text-foreground focus:bg-black/5 focus:text-foreground [&_svg]:size-3.5"
        >
          <CopyIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span className="flex-1 text-left">Duplicate</span>
        </ContextMenuItem>
        <ContextMenuSeparator className="my-1 h-px bg-border mx-0" />
        <ContextMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-full justify-start gap-1.5 rounded-lg px-2 py-1.5 h-[26px] text-[13px] font-medium tracking-[0.13px] transition-colors text-red-500/70 hover:bg-red-500/5 focus:bg-red-500/5 focus:text-red-500 [&_svg]:size-3.5"
        >
          <TrashIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span className="flex-1 text-left">Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Sidebar Section Component (Figma system-flat: External/collapsible section with chevron)
function SidebarSection({
  label,
  children,
  action,
  initialOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  initialOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(() => initialOpen);

  return (
    <div className="flex flex-col">
      <div className="group flex items-center justify-between px-1 py-[7px] transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 h-auto p-0 cursor-pointer flex-1 min-w-0 justify-start bg-transparent border-none"
          aria-expanded={isOpen}
        >
          <span className="text-[13px] font-medium text-muted-foreground tracking-[0.26px] truncate">
            {label}
          </span>
          <ChevronDown
            className={cn(
              "h-2.5 w-2.5 shrink-0 text-muted-foreground transition-transform duration-200",
              !isOpen && "-rotate-90",
            )}
            strokeWidth={2}
          />
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {action ?? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 hover:bg-sidebar-active text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Button>
          )}
        </div>
      </div>

      {isOpen && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

// Workspaces section - uses live queries for real-time sync (Minimal Style)
function SidebarWorkspacesMinimal({ activeOrgId }: { activeOrgId?: string }) {
  const router = useRouter();
  const location = useLocation();
  const { data: session } = useSession();

  // Sort mode state with localStorage persistence
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "alphabetical" | "manual">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sidebar-sort-mode") as "recent" | "oldest" | "alphabetical" | "manual") || "recent";
    }
    return "recent";
  });
  const handleSortChange = (mode: "recent" | "oldest" | "alphabetical" | "manual") => {
    setSortMode(mode);
    localStorage.setItem("sidebar-sort-mode", mode);
  };

  // Use live queries for real-time sync
  const { data: workspacesData, isLoading: workspacesLoading } = useWorkspaces();
  const { data: formsData, isLoading: formsLoading } = useForms();
  const submissionCounts = useSubmissionCounts();

  // Get user's favorite forms
  const favoriteForms = useFavoriteForms(session?.user?.id);

  // Determine if Electric has synced
  const isLoading = workspacesLoading || formsLoading;
  const isElectricReady = !isLoading && workspacesData !== undefined && formsData !== undefined;

  // Combine workspaces with their forms, filtered by active organization
  const workspaces: WorkspaceWithForms[] = useMemo(() => {
    if (!activeOrgId || !isElectricReady) return [];

    const formsByWorkspace = (formsData || []).reduce(
      (acc, form) => {
        if (!acc[form.workspaceId]) acc[form.workspaceId] = [];
        acc[form.workspaceId].push(form);
        return acc;
      },
      {} as Record<string, typeof formsData>,
    );

    return (workspacesData || [])
      .filter((ws) => ws.organizationId === activeOrgId)
      .map((ws) => ({
        ...ws,
        // Sort forms by recently edited (most recent first)
        forms: (formsByWorkspace[ws.id] || []).toSorted((a, b) => {
          switch (sortMode) {
            case "oldest":
              return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            case "alphabetical":
              return (a.title || "").localeCompare(b.title || "");
            case "manual":
              return 0;
            case "recent":
            default:
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          }
        }),
      }));
  }, [workspacesData, formsData, activeOrgId, isElectricReady, sortMode]);

  // State for workspace dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceWithForms | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<WorkspaceWithForms | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  // State for form delete dialog
  const [formDeleteDialogOpen, setFormDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{ id: string; title: string } | null>(null);

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete || deleteConfirmName !== workspaceToDelete.name) return;
    try {
      await deleteWorkspaceLocal(workspaceToDelete.id);
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
      setDeleteConfirmName("");
      router.navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!workspaceToRename || !newWorkspaceName.trim()) return;
    try {
      await updateWorkspaceName(workspaceToRename.id, newWorkspaceName.trim());
      setRenameDialogOpen(false);
      setWorkspaceToRename(null);
      setNewWorkspaceName("");
    } catch (error) {
      console.error("Failed to rename workspace:", error);
    }
  };

  const openRenameDialog = (workspace: WorkspaceWithForms) => {
    setWorkspaceToRename(workspace);
    setNewWorkspaceName(workspace.name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (workspace: WorkspaceWithForms) => {
    setWorkspaceToDelete(workspace);
    setDeleteConfirmName("");
    setDeleteDialogOpen(true);
  };

  const handleDuplicateForm = async (form: WorkspaceWithForms["forms"][0]) => {
    try {
      const newForm = await duplicateFormById(form.id);
      toast.success("Form duplicated");
      router.navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId: newForm.workspaceId, formId: newForm.id },
      });
    } catch (error) {
      console.error("Failed to duplicate form:", error);
      toast.error("Failed to duplicate form");
    }
  };

  const handleDeleteForm = (form: WorkspaceWithForms["forms"][0]) => {
    setFormToDelete({ id: form.id, title: form.title || "Untitled" });
    setFormDeleteDialogOpen(true);
  };

  const handleConfirmDeleteForm = async () => {
    if (!formToDelete) return;
    try {
      await updateFormStatus(formToDelete.id, "archived");
      toast.success("Form deleted");
      // Navigate to dashboard if user is on the deleted form's page
      if (location.pathname.includes(`/form-builder/${formToDelete.id}`)) {
        router.navigate({ to: "/dashboard" });
      }
      setFormDeleteDialogOpen(false);
      setFormToDelete(null);
    } catch (error) {
      console.error("Failed to delete form:", error);
      toast.error("Failed to delete form");
    }
  };

  return (
    <>
      <div className="flex flex-col">
        {/* Favorites Section */}
        <SidebarSection
          label="Favorites"
          initialOpen={favoriteForms.length > 0}
          action={<></>}
        >
          {favoriteForms.length === 0 ? (
            <span className="text-muted-foreground/50 text-[11px] px-2 py-1 italic">
              No favorites yet
            </span>
          ) : (
            favoriteForms.map((form) => {
              const favTo = form.status === "published"
                ? `/workspace/${form.workspaceId}/form-builder/${form.id}/submissions`
                : `/workspace/${form.workspaceId}/form-builder/${form.id}/edit`;
              const isFavActive = location.pathname.startsWith(`/workspace/${form.workspaceId}/form-builder/${form.id}`);
              return (
                <SidebarItem
                  key={form.id}
                  label={form.title || "Untitled"}
                  to={favTo}
                  isActive={isFavActive}
                  prefix={
                    <div className="bg-form-icon-bg rounded-full size-[18px] flex items-center justify-center border-[0.5px] border-form-icon-border shrink-0">
                      <StarIcon className="h-4.5 w-4.5 fill-foreground text-foreground" />
                    </div>
                  }
                />
              );
            })
          )}
        </SidebarSection>

        {/* Workspaces Section - 15px gap to match Figma mt-[15px] */}
        <div className="mt-[15px] space-y-4">
          {isLoading ? (
            ["collection-skeleton-1", "collection-skeleton-2"].map((key) => (
              <div key={key} className="flex items-center gap-2 px-2 py-1.5">
                <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
              </div>
            ))
          ) : (
            <div className="space-y-4">
              {workspaces.map((workspace) => (
                <WorkspaceItemMinimal
                  key={workspace.id}
                  workspace={workspace}
                  submissionCounts={submissionCounts}
                  sortMode={sortMode}
                  onSortChange={handleSortChange}
                  onRename={() => openRenameDialog(workspace)}
                  onDelete={() => openDeleteDialog(workspace)}
                  onDuplicateForm={handleDuplicateForm}
                  onDeleteForm={handleDeleteForm}
                />
              ))}
              {workspaces.length === 0 && (
                <span className="text-muted-foreground/50 text-[11px] px-2 py-1 italic">
                  No workspaces yet
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Workspace Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmName("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  This will permanently delete <strong>"{workspaceToDelete?.name}"</strong> and{" "}
                  <strong>
                    {workspaceToDelete?.forms?.length || 0} form
                    {(workspaceToDelete?.forms?.length || 0) !== 1 ? "s" : ""}
                  </strong>{" "}
                  within it. This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <p className="text-sm">
                    Type <strong>{workspaceToDelete?.name}</strong> to confirm:
                  </p>
                  <Input
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="Type workspace name to confirm"
                    className="mt-2"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={deleteConfirmName !== workspaceToDelete?.name}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Workspace Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Enter a new name for this workspace.</DialogDescription>
          </DialogHeader>
          <Input
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="Workspace name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRenameWorkspace();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameWorkspace}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Delete Confirmation Dialog */}
      <AlertDialog open={formDeleteDialogOpen} onOpenChange={setFormDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formToDelete?.title}"? This action will move it to
              trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteForm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
