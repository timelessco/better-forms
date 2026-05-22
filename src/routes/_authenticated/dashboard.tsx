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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FileTextIcon,
  HelpCircleIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  bulkArchiveFormsLocal,
  createFormLocal,
  createWorkspaceLocal,
  updateFormStatus,
} from "@/collections";
import { useDuplicateForm } from "@/hooks/use-duplicate-form";
import { useFavorites, useOrgForms, useOrgWorkspaces } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { formatForDisplay, HOTKEYS } from "@/lib/hotkeys";
import { clearLocalDraftIds } from "@/db/local-draft";
import { hasLocalDataToSync, syncLocalDataToCloud } from "@/db/sync";
import { getLeadingSortIndex, sortByManualOrder } from "@/lib/sort-utils";
import { cn, parseTimestampAsUTC } from "@/lib/utils";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { createFileRoute, Link, useLoaderData, useNavigate } from "@tanstack/react-router";
import { parseError } from "evlog";
import { formatDistanceToNow } from "date-fns";
import { generateKeyBetween } from "fractional-indexing";
import { FolderPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
const FORMS_PER_PAGE = 10;

type FormFilter = "all" | "favorites" | "drafts" | "published";

const FILTER_OPTIONS: ReadonlyArray<{ value: FormFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "drafts", label: "Drafts" },
  { value: "published", label: "Published" },
];

const DashboardFilters = ({
  currentFilter,
  counts,
  onChange,
}: {
  currentFilter: FormFilter;
  counts: Record<FormFilter, number>;
  onChange: (next: FormFilter) => void;
}) => (
  <div role="tablist" aria-label="Filter forms" className="-mx-1 flex flex-wrap items-center gap-1">
    {FILTER_OPTIONS.map((option) => {
      const isActive = currentFilter === option.value;
      const count = counts[option.value];
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
            isActive
              ? "border-transparent bg-foreground text-background"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span>{option.label}</span>
          <span
            className={cn(
              "tabular-nums",
              isActive ? "text-background/70" : "text-muted-foreground/60",
            )}
          >
            {count}
          </span>
        </button>
      );
    })}
  </div>
);

const FILTER_EMPTY_COPY: Record<Exclude<FormFilter, "all">, string> = {
  favorites: "No favorites yet. Star a form to see it here.",
  drafts: "No drafts. New forms start as drafts until you publish them.",
  published: "Nothing published yet.",
};

const FilteredEmptyState = ({ filter }: { filter: FormFilter }) => {
  if (filter === "all") return null;
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {FILTER_EMPTY_COPY[filter]}
    </div>
  );
};

const SYNC_MESSAGES = [
  "Syncing your local forms to the cloud",
  "Uploading form data",
  "Almost there",
];

const SyncOverlay = () => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDotCount((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SYNC_MESSAGES.length);
    }, 2500);
    return () => clearInterval(messageInterval);
  }, []);

  const dots = ".".repeat(dotCount);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      <div className="h-6 overflow-hidden">
        <p
          key={messageIndex}
          className="animate-in text-sm text-muted-foreground duration-300 fade-in slide-in-from-bottom-2"
        >
          <span>{SYNC_MESSAGES[messageIndex]}</span>
          <span className="inline-block w-5 text-left">{dots}</span>
        </p>
      </div>
    </div>
  );
};

// Module-level flag survives component unmount/remount during navigation
let _hasSynced = false;

const useLocalDataSync = (
  sessionUser: unknown,
  activeOrgId: string | undefined,
): { isSyncing: boolean } => {
  const [isSyncing, setIsSyncing] = useState(false);
  useEffect(() => {
    const syncData = async () => {
      if (!sessionUser || !activeOrgId) return;
      if (_hasSynced) return;

      const hasData = await hasLocalDataToSync();
      if (!hasData) {
        _hasSynced = true;
        return;
      }

      setIsSyncing(true);
      try {
        const result = await syncLocalDataToCloud(activeOrgId);
        if (result?.syncedForms && result.syncedForms.length > 0) {
          clearLocalDraftIds();
          sessionStorage.removeItem("shouldSyncAfterLogin");
          toast.success("Local data synced!");
        }
        _hasSynced = true;
      } catch (error) {
        console.error("Failed to sync local data:", error);
        toast.error("Signed in but failed to sync local data");
      } finally {
        setIsSyncing(false);
      }
    };
    void syncData();
  }, [sessionUser, activeOrgId]);
  return { isSyncing };
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const duplicateFormFn = useDuplicateForm();
  const activeOrg = useLoaderData({ from: "/_authenticated", select: (d) => d.activeOrg });
  const [isCreating, setIsCreating] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FormFilter>("all");

  const { data: session } = useSession();
  const { isSyncing } = useLocalDataSync(session?.user, activeOrg?.id);

  const { data: liveWorkspaces, isLoading: wsLoading } = useOrgWorkspaces(activeOrg?.id);
  const { data: liveForms, isLoading: formsLoading } = useOrgForms(activeOrg?.id);

  const isLoading = wsLoading || formsLoading;
  const isDataReady = !isLoading && liveWorkspaces !== undefined && liveForms !== undefined;

  const orgWorkspaces = useMemo(
    () => (isDataReady ? liveWorkspaces || [] : []),
    [isDataReady, liveWorkspaces],
  );

  const orgForms = useMemo(() => (isDataReady ? liveForms || [] : []), [isDataReady, liveForms]);

  const { data: favorites } = useFavorites(session?.user?.id);
  const favoriteFormIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.formId)),
    [favorites],
  );

  const filterCounts = useMemo<Record<FormFilter, number>>(() => {
    let drafts = 0;
    let published = 0;
    let favs = 0;
    for (const form of orgForms) {
      if (form.status === "draft") drafts++;
      else if (form.status === "published") published++;
      if (favoriteFormIds.has(form.id)) favs++;
    }
    return { all: orgForms.length, favorites: favs, drafts, published };
  }, [orgForms, favoriteFormIds]);

  const filteredForms = useMemo(() => {
    switch (currentFilter) {
      case "favorites":
        return orgForms.filter((f) => favoriteFormIds.has(f.id));
      case "drafts":
        return orgForms.filter((f) => f.status === "draft");
      case "published":
        return orgForms.filter((f) => f.status === "published");
      default:
        return orgForms;
    }
  }, [orgForms, currentFilter, favoriteFormIds]);

  const workspaceNameMap = useMemo(
    () => new Map(orgWorkspaces.map((ws) => [ws.id, ws.name])),
    [orgWorkspaces],
  );

  const totalPages = Math.max(1, Math.ceil(filteredForms.length / FORMS_PER_PAGE));
  const startIndex = (currentPage - 1) * FORMS_PER_PAGE;
  const paginatedForms = filteredForms.slice(startIndex, startIndex + FORMS_PER_PAGE);

  const handleFilterChange = useCallback((next: FormFilter) => {
    setCurrentFilter(next);
    setCurrentPage(1);
    setSelectedFormIds(new Set());
  }, []);

  const handleOpenCreateWorkspace = useCallback(() => {
    setNewWorkspaceName("");
    setCreateWorkspaceOpen(true);
  }, []);

  const handleCloseCreateWorkspace = useCallback(() => {
    setCreateWorkspaceOpen(false);
    setNewWorkspaceName("");
  }, []);

  const handleConfirmCreateWorkspace = useCallback(async () => {
    const trimmedName = newWorkspaceName.trim();
    if (!activeOrg?.id || !trimmedName || isCreatingWorkspace) return;
    setIsCreatingWorkspace(true);
    try {
      // Place the new workspace before the current lead so it appears at the
      // top of the sidebar; fractional-indexing keeps it stable even after
      // future drag-reorders.
      const leadingSortIndex = generateKeyBetween(null, getLeadingSortIndex(orgWorkspaces));
      const workspace = await createWorkspaceLocal(activeOrg.id, trimmedName, leadingSortIndex);
      setCreateWorkspaceOpen(false);
      setNewWorkspaceName("");
      toast.success("Workspace created");
      void navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId: workspace.id },
      });
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Failed to create workspace");
    } finally {
      setIsCreatingWorkspace(false);
    }
  }, [activeOrg?.id, newWorkspaceName, orgWorkspaces, navigate, isCreatingWorkspace]);

  const handleCreateWorkspaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleConfirmCreateWorkspace();
      }
    },
    [handleConfirmCreateWorkspace],
  );

  // Mirror the sidebar's order so the dashboard's "New form" button targets
  // the same workspace the sidebar lists first when no explicit pick is made.
  const orderedWorkspaces = useMemo(
    () =>
      sortByManualOrder(
        orgWorkspaces,
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [orgWorkspaces],
  );

  const handleCreateForm = useCallback(
    (workspaceId?: string) => {
      const targetId = workspaceId ?? orderedWorkspaces[0]?.id;
      if (!targetId) return;

      setIsCreating(true);
      try {
        const { form: newForm } = createFormLocal(targetId);
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/edit",
          params: { workspaceId: targetId, formId: newForm.id },
        });
      } catch (error) {
        console.error("Failed to create form:", error);
      } finally {
        setIsCreating(false);
      }
    },
    [orderedWorkspaces, navigate],
  );

  const handleDeleteClick = useCallback((form: { id: string; title: string }) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (formToDelete) {
      try {
        await updateFormStatus(formToDelete.id, "archived");
        setDeleteDialogOpen(false);
        setFormToDelete(null);
      } catch (error) {
        console.error("Failed to archive form:", error);
      }
    }
  }, [formToDelete]);

  const handleDuplicate = useCallback(
    async (formId: string) => {
      setDuplicatingFormId(formId);
      try {
        await duplicateFormFn(formId);
      } catch {
        toast.error("Failed to duplicate form");
      } finally {
        setDuplicatingFormId(null);
      }
    },
    [duplicateFormFn],
  );

  const handlePrevPage = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);

  const handleNextPage = useCallback(
    () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
    [totalPages],
  );

  const formatLastEdited = (timestamp: string) =>
    `Edited ${formatDistanceToNow(parseTimestampAsUTC(timestamp) ?? new Date())} ago`;

  const hasSelection = selectedFormIds.size > 0;

  const handleToggleSelect = useCallback((formId: string) => {
    setSelectedFormIds((prev) => {
      const next = new Set(prev);
      if (next.has(formId)) {
        next.delete(formId);
      } else {
        next.add(formId);
      }
      return next;
    });
  }, []);

  // Global dashboard hotkeys (Mod+A / Delete / Escape) sit at the document
  // level. When a modal dialog is open (trash, settings, command palette),
  // its own hotkeys should win — so each handler bails if a Base UI dialog
  // is currently open. Base UI signals open state via the `data-open`
  // attribute on its dialog content; checking that is more reliable than
  // tracking each dialog's state in context.
  const isModalDialogOpen = () =>
    typeof document !== "undefined" &&
    document.querySelector('[data-slot="dialog-content"][data-open]') !== null;

  const handleSelectAll = useCallback(() => {
    if (isModalDialogOpen()) return;
    if (selectedFormIds.size === paginatedForms.length) {
      setSelectedFormIds(new Set());
    } else {
      setSelectedFormIds(new Set(paginatedForms.map((f) => f.id)));
    }
  }, [selectedFormIds.size, paginatedForms]);

  const handleClearSelection = useCallback(() => {
    if (isModalDialogOpen()) return;
    setSelectedFormIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (isModalDialogOpen()) return;
    if (selectedFormIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedFormIds.size]);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = [...selectedFormIds];
    if (ids.length === 0) return;
    try {
      await bulkArchiveFormsLocal(ids);
      setSelectedFormIds(new Set());
      setBulkDeleteDialogOpen(false);
      toast.success(`${ids.length} form${ids.length !== 1 ? "s" : ""} deleted`);
    } catch (error) {
      const message = parseError(error).message || "Failed to delete some forms";
      toast.error(message);
    }
  }, [selectedFormIds]);

  const [lastPageForSelection, setLastPageForSelection] = useState(currentPage);
  if (lastPageForSelection !== currentPage) {
    setLastPageForSelection(currentPage);
    setSelectedFormIds(new Set());
  }

  useHotkey(HOTKEYS.DASHBOARD_SELECT_ALL, handleSelectAll, {
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  useHotkeys(
    [
      { hotkey: HOTKEYS.DASHBOARD_DELETE, callback: handleBulkDelete },
      { hotkey: "Delete", callback: handleBulkDelete },
    ],
    { enabled: hasSelection, conflictBehavior: "replace", ignoreInputs: true },
  );

  useHotkey(HOTKEYS.DASHBOARD_CLEAR_SELECTION, handleClearSelection, {
    enabled: hasSelection,
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl flex-1 p-6 md:p-12 lg:p-20">
        <DashboardHeader
          isLoading={isLoading}
          orgFormsCount={orgForms.length}
          orderedWorkspaces={orderedWorkspaces}
          isCreating={isCreating}
          handleCreateWorkspace={handleOpenCreateWorkspace}
          handleCreateForm={handleCreateForm}
        />

        <div className="space-y-6">
          {!isLoading && orgForms.length > 0 && (
            <DashboardFilters
              currentFilter={currentFilter}
              counts={filterCounts}
              onChange={handleFilterChange}
            />
          )}

          <DashboardFormList
            isSyncing={isSyncing}
            isLoading={isLoading}
            paginatedForms={paginatedForms}
            selectedFormIds={selectedFormIds}
            workspaceNameMap={workspaceNameMap}
            duplicatingFormId={duplicatingFormId}
            formatLastEdited={formatLastEdited}
            handleDuplicate={handleDuplicate}
            handleDeleteClick={handleDeleteClick}
            handleToggleSelect={handleToggleSelect}
          />

          {!isLoading && filteredForms.length === 0 && orgForms.length > 0 && (
            <FilteredEmptyState filter={currentFilter} />
          )}

          {!isLoading && totalPages > 1 && (
            <DashboardPagination
              startIndex={startIndex}
              totalForms={filteredForms.length}
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onSetPage={setCurrentPage}
            />
          )}

          {!isLoading && orgForms.length === 0 && (
            <DashboardEmptyState
              isCreating={isCreating}
              disabled={isLoading || isCreating || orgWorkspaces.length === 0}
              onCreate={handleCreateForm}
            />
          )}
        </div>
      </main>

      {hasSelection && (
        <BulkSelectionToolbar
          count={selectedFormIds.size}
          onBulkDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
        />
      )}

      {!hasSelection && <FloatingHelpButton />}

      <BulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        count={selectedFormIds.size}
        onConfirm={handleConfirmBulkDelete}
      />

      <SingleDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={formToDelete?.title}
        onConfirm={handleConfirmDelete}
      />

      <WorkspaceCreateDialog
        open={createWorkspaceOpen}
        name={newWorkspaceName}
        isCreating={isCreatingWorkspace}
        onOpenChange={setCreateWorkspaceOpen}
        onNameChange={(e) => setNewWorkspaceName(e.target.value)}
        onClose={handleCloseCreateWorkspace}
        onCreate={handleConfirmCreateWorkspace}
        onKeyDown={handleCreateWorkspaceKeyDown}
      />
    </div>
  );
};

interface WorkspaceCreateDialogProps {
  open: boolean;
  name: string;
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onCreate: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const WorkspaceCreateDialog = ({
  open,
  name,
  isCreating,
  onOpenChange,
  onNameChange,
  onClose,
  onCreate,
  onKeyDown,
}: WorkspaceCreateDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="gap-4 sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create workspace</DialogTitle>
        <DialogDescription>Give your new workspace a name to get started.</DialogDescription>
      </DialogHeader>
      <Input
        value={name}
        onChange={onNameChange}
        placeholder="Workspace name"
        aria-label="Workspace name"
        onKeyDown={onKeyDown}
        autoFocus
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isCreating}>
          Cancel
        </Button>
        <Button onClick={onCreate} disabled={!name.trim() || isCreating}>
          {isCreating ? (
            <>
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
              Creating…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface DashboardHeaderProps {
  isLoading: boolean;
  orgFormsCount: number;
  orderedWorkspaces: ReadonlyArray<{ id: string; name: string }>;
  isCreating: boolean;
  handleCreateWorkspace: () => void;
  handleCreateForm: (workspaceId?: string) => void;
}

const DashboardHeader = ({
  isLoading,
  orgFormsCount,
  orderedWorkspaces,
  isCreating,
  handleCreateWorkspace,
  handleCreateForm,
}: DashboardHeaderProps) => {
  const orgWorkspacesCount = orderedWorkspaces.length;
  const topWorkspace = orderedWorkspaces[0];
  const hasMultipleWorkspaces = orgWorkspacesCount > 1;

  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading
            ? "Loading..."
            : `${orgFormsCount} form${orgFormsCount !== 1 ? "s" : ""} across ${orgWorkspacesCount} workspace${orgWorkspacesCount !== 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button
          className="ml-1"
          size="sm"
          variant="secondary"
          prefix={<FolderPlus className="size-4" />}
          onClick={handleCreateWorkspace}
          disabled={isLoading}
        >
          New workspace
        </Button>
        {hasMultipleWorkspaces ? (
          <ButtonGroup>
            <Button
              size="sm"
              prefix={
                isCreating ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )
              }
              onClick={() => handleCreateForm(topWorkspace?.id)}
              disabled={isLoading || isCreating || !topWorkspace}
            >
              New form in {topWorkspace?.name ?? "workspace"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    aria-label="Pick a different workspace"
                    disabled={isLoading || isCreating}
                  >
                    <ChevronDownIcon className="size-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Create new form in…</DropdownMenuLabel>
                  {orderedWorkspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => handleCreateForm(ws.id)}
                      disabled={isCreating}
                    >
                      <span className="flex-1 truncate text-left">{ws.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        ) : (
          <Button
            size="sm"
            prefix={
              isCreating ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )
            }
            onClick={() => handleCreateForm()}
            disabled={isLoading || isCreating || orgWorkspacesCount === 0}
          >
            New form
          </Button>
        )}
      </div>
    </div>
  );
};

type FormListItemForm = {
  id: string;
  title: string | null;
  status: "draft" | "published" | "archived" | string;
  workspaceId: string;
  updatedAt: string;
};

interface DashboardFormListProps {
  isSyncing: boolean;
  isLoading: boolean;
  paginatedForms: ReadonlyArray<FormListItemForm>;
  selectedFormIds: Set<string>;
  workspaceNameMap: Map<string, string>;
  duplicatingFormId: string | null;
  formatLastEdited: (timestamp: string) => string;
  handleDuplicate: (formId: string) => Promise<void> | void;
  handleDeleteClick: (form: { id: string; title: string }) => void;
  handleToggleSelect: (formId: string) => void;
}

const DashboardFormList = ({
  isSyncing,
  isLoading,
  paginatedForms,
  selectedFormIds,
  workspaceNameMap,
  duplicatingFormId,
  formatLastEdited,
  handleDuplicate,
  handleDeleteClick,
  handleToggleSelect,
}: DashboardFormListProps) => (
  <div className="grid grid-cols-1 gap-2">
    {isSyncing ? (
      <SyncOverlay />
    ) : isLoading ? (
      ["a", "b", "c", "d", "e"].map((id) => (
        <div key={`skeleton-${id}`} className="-mx-2 flex animate-pulse flex-col rounded-xl p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-2">
                <div className="h-5 w-48 rounded bg-muted" />
                <div className="h-3 w-32 rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))
    ) : (
      paginatedForms.map((form) => (
        <FormListItem
          key={form.id}
          form={form}
          isSelected={selectedFormIds.has(form.id)}
          workspaceNameMap={workspaceNameMap}
          duplicatingFormId={duplicatingFormId}
          formatLastEdited={formatLastEdited}
          onDuplicate={handleDuplicate}
          onDeleteClick={handleDeleteClick}
          onToggleSelect={handleToggleSelect}
        />
      ))
    )}
  </div>
);

const FloatingHelpButton = () => (
  <div className="fixed right-6 bottom-6">
    <Button
      variant="ghost"
      size="icon"
      className="size-10 rounded-full bg-muted/50 elevation-sm hover:bg-secondary dark:shadow-none"
      aria-label="Help"
    >
      <HelpCircleIcon className="size-5 text-muted-foreground" />
    </Button>
  </div>
);

type DashboardPaginationProps = {
  startIndex: number;
  totalForms: number;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSetPage: (page: number) => void;
};

const DashboardPagination = ({
  startIndex,
  totalForms,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onSetPage,
}: DashboardPaginationProps) => (
  <div className="flex items-center justify-between border-t pt-4">
    <p className="text-sm text-muted-foreground">
      Showing {startIndex + 1}-{Math.min(startIndex + FORMS_PER_PAGE, totalForms)} of {totalForms}{" "}
      forms
    </p>
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onPrevPage} disabled={currentPage === 1}>
        <ChevronLeftIcon className="size-4" />
        Previous
      </Button>
      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "ghost"}
            size="sm"
            className="size-8 p-0"
            onClick={() => onSetPage(page)}
          >
            {page}
          </Button>
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onNextPage}
        disabled={currentPage === totalPages}
      >
        Next
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  </div>
);

type DashboardEmptyStateProps = {
  isCreating: boolean;
  disabled: boolean;
  onCreate: () => void;
};

const DashboardEmptyState = ({ isCreating, disabled, onCreate }: DashboardEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center gap-y-4 rounded-2xl border-2 border-dashed bg-muted/20 py-20 text-center">
    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
      <FileTextIcon className="size-6 text-muted-foreground" />
    </div>
    <div className="space-y-1">
      <p>No forms yet</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Create your first form to get started.
      </p>
    </div>
    <Button size="sm" onClick={onCreate} disabled={disabled}>
      {isCreating && <Loader2Icon className="mr-2 size-4 animate-spin" />}
      Create my first form
    </Button>
  </div>
);

type BulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
};

const BulkDeleteDialog = ({ open, onOpenChange, count, onConfirm }: BulkDeleteDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Delete {count} form{count !== 1 ? "s" : ""}
        </AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete {count} form{count !== 1 ? "s" : ""}? This action cannot
          be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type SingleDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | undefined;
  onConfirm: () => void;
};

const SingleDeleteDialog = ({ open, onOpenChange, title, onConfirm }: SingleDeleteDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete form</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete "{title}"? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type FormListItemProps = {
  form: FormListItemForm;
  isSelected: boolean;
  workspaceNameMap: Map<string, string>;
  duplicatingFormId: string | null;
  formatLastEdited: (timestamp: string) => string;
  onDuplicate: (formId: string) => void;
  onDeleteClick: (form: { id: string; title: string }) => void;
  onToggleSelect: (formId: string) => void;
};

const FormListItem = ({
  form,
  isSelected,
  workspaceNameMap,
  duplicatingFormId,
  formatLastEdited,
  onDuplicate,
  onDeleteClick,
  onToggleSelect,
}: FormListItemProps) => (
  <Card
    className={`group cursor-pointer gap-0 bg-transparent px-3 py-2 ring-0 transition-[background-color,box-shadow] duration-200 hover:bg-muted/30 ${isSelected ? "bg-muted/50" : ""}`}
  >
    <Link
      to={
        form.status === "published"
          ? "/workspace/$workspaceId/form-builder/$formId/submissions"
          : "/workspace/$workspaceId/form-builder/$formId/edit"
      }
      params={{
        workspaceId: form.workspaceId,
        formId: form.id,
      }}
      preload="intent"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold transition-colors">{form.title || "Untitled"}</span>
              <Badge
                variant="secondary"
                className={`h-4 px-1.5 text-[10px] font-normal ${
                  form.status === "published"
                    ? "bg-green-100 text-green-700"
                    : "bg-muted/80 text-muted-foreground"
                } rounded-full`}
              >
                {form.status === "published" ? "Published" : "Draft"}
              </Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{workspaceNameMap.get(form.workspaceId) || "Unknown workspace"}</span>
              <span className="size-0.5 rounded-full bg-muted-foreground/30"></span>
              <span>{formatLastEdited(form.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            duplicatingFormId === form.id || isSelected
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
          )}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Duplicate form"
                    disabled={duplicatingFormId === form.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDuplicate(form.id);
                    }}
                  />
                }
              >
                {duplicatingFormId === form.id ? (
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <CopyIcon className="size-4 text-muted-foreground" />
                )}
              </TooltipTrigger>
              <TooltipContent>Duplicate</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete form"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDeleteClick({
                        id: form.id,
                        title: form.title || "Untitled",
                      });
                    }}
                  />
                }
              >
                <Trash2Icon className="size-4 text-[var(--sidebar-icon-stroke)]" />
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isSelected ? "Deselect form" : "Select form"}
                    className={
                      isSelected
                        ? "bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30"
                        : "text-muted-foreground"
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleSelect(form.id);
                    }}
                  />
                }
              >
                <CheckIcon className="size-3.5 text-[var(--sidebar-icon-stroke)]" />
              </TooltipTrigger>
              <TooltipContent>{isSelected ? "Deselect" : "Select"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Link>
  </Card>
);

type BulkSelectionToolbarProps = {
  count: number;
  onBulkDelete: () => void;
  onClearSelection: () => void;
};

const BulkSelectionToolbar = ({
  count,
  onBulkDelete,
  onClearSelection,
}: BulkSelectionToolbarProps) => (
  <div className="fixed bottom-6 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 animate-in duration-300 fade-in slide-in-from-bottom-4">
    <div className="shadow-card-elevated flex items-center justify-between rounded-2xl bg-background px-4 py-3 dark:bg-muted/50">
      <div className="flex items-center gap-2.5">
        <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
          <CheckIcon className="size-4" strokeWidth={3} />
        </div>
        <span className="text-sm font-medium">{count} selected</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBulkDelete}>
          Delete
          <span className="ml-1 text-xs text-muted-foreground">
            {formatForDisplay(HOTKEYS.DASHBOARD_DELETE)}
          </span>
        </Button>
        <Button variant="secondary" size="sm" onClick={onClearSelection}>
          <XIcon className="size-3.5" />
          Clear
          <span className="ml-1 text-xs text-muted-foreground">
            {formatForDisplay(HOTKEYS.DASHBOARD_CLEAR_SELECTION)}
          </span>
        </Button>
      </div>
    </div>
  </div>
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  ssr: "data-only",
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
