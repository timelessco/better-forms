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
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  CheckIcon,
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
import { useOrgForms, useOrgWorkspaces } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { formatForDisplay, HOTKEYS } from "@/lib/hotkeys";
import { clearLocalDraftIds } from "@/db/local-draft";
import { hasLocalDataToSync, syncLocalDataToCloud } from "@/db/sync";
import { parseTimestampAsUTC } from "@/lib/utils";
import { useHotkey } from "@tanstack/react-hotkeys";
import { createFileRoute, Link, useLoaderData, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { FolderPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
const FORMS_PER_PAGE = 10;

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
      <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
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

const DashboardPage = () => {
  const navigate = useNavigate();
  const duplicateFormFn = useDuplicateForm();
  const { activeOrg } = useLoaderData({ from: "/_authenticated" });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);

  const { data: session } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: liveWorkspaces, isLoading: wsLoading } = useOrgWorkspaces(activeOrg?.id);
  const { data: liveForms, isLoading: formsLoading } = useOrgForms(activeOrg?.id);

  const isLoading = wsLoading || formsLoading;
  const isDataReady = !isLoading && liveWorkspaces !== undefined && liveForms !== undefined;

  const orgWorkspaces = useMemo(
    () => (isDataReady ? liveWorkspaces || [] : []),
    [isDataReady, liveWorkspaces],
  );

  const orgForms = useMemo(() => (isDataReady ? liveForms || [] : []), [isDataReady, liveForms]);

  const workspaceNameMap = useMemo(
    () => new Map(orgWorkspaces.map((ws) => [ws.id, ws.name])),
    [orgWorkspaces],
  );

  const totalPages = Math.ceil(orgForms.length / FORMS_PER_PAGE);
  const startIndex = (currentPage - 1) * FORMS_PER_PAGE;
  const paginatedForms = orgForms.slice(startIndex, startIndex + FORMS_PER_PAGE);

  useEffect(() => {
    const syncData = async () => {
      if (!session?.user || !activeOrg?.id) return;
      if (_hasSynced) return;

      const hasData = await hasLocalDataToSync();
      if (!hasData) {
        _hasSynced = true;
        return;
      }

      setIsSyncing(true);
      try {
        const result = await syncLocalDataToCloud(activeOrg.id);
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
  }, [session?.user, activeOrg?.id]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!activeOrg?.id) return;
    try {
      await createWorkspaceLocal(activeOrg.id, "New Workspace");
      toast.success("Workspace created");
    } catch (error) {
      console.error("Failed to create workspace:", error);
      toast.error("Failed to create workspace");
    }
  }, [activeOrg?.id]);

  const handleCreateForm = useCallback(async () => {
    if (orgWorkspaces.length === 0) return;

    setIsCreating(true);
    try {
      const defaultWorkspace = orgWorkspaces[0];
      const { form: newForm } = createFormLocal(defaultWorkspace.id);
      void navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/edit",
        params: { workspaceId: defaultWorkspace.id, formId: newForm.id },
      });
    } catch (error) {
      console.error("Failed to create form:", error);
    } finally {
      setIsCreating(false);
    }
  }, [orgWorkspaces, navigate]);

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

  const handleSelectAll = useCallback(() => {
    if (selectedFormIds.size === paginatedForms.length) {
      setSelectedFormIds(new Set());
    } else {
      setSelectedFormIds(new Set(paginatedForms.map((f) => f.id)));
    }
  }, [selectedFormIds.size, paginatedForms]);

  const handleClearSelection = useCallback(() => {
    setSelectedFormIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
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
      const message = error instanceof Error ? error.message : "Failed to delete some forms";
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

  useHotkey(HOTKEYS.DASHBOARD_DELETE, handleBulkDelete, {
    enabled: hasSelection,
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  useHotkey(HOTKEYS.DASHBOARD_CLEAR_SELECTION, handleClearSelection, {
    enabled: hasSelection,
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl flex-1 p-6 md:p-12 lg:p-20">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Home</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `${orgForms.length} form${orgForms.length !== 1 ? "s" : ""} across ${orgWorkspaces.length} workspace${orgWorkspaces.length !== 1 ? "s" : ""}`}
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
            <Button
              size="sm"
              prefix={
                isCreating ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <PlusIcon className="size-4" />
                )
              }
              onClick={handleCreateForm}
              disabled={isLoading || isCreating || orgWorkspaces.length === 0}
            >
              New form
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-2">
            {isSyncing ? (
              <SyncOverlay />
            ) : isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div
                  key={`skeleton-${i}`}
                  className="-mx-2 flex animate-pulse flex-col rounded-xl p-2"
                >
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
              paginatedForms.map((form) => {
                const isSelected = selectedFormIds.has(form.id);
                return (
                  <Card
                    key={form.id}
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
                              <span className="font-semibold transition-colors">
                                {form.title || "Untitled"}
                              </span>
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
                              <span>
                                {workspaceNameMap.get(form.workspaceId) || "Unknown workspace"}
                              </span>
                              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30"></span>
                              <span>{formatLastEdited(form.updatedAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`flex items-center gap-1 transition-opacity ${duplicatingFormId === form.id || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
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
                                      void handleDuplicate(form.id);
                                    }}
                                  />
                                }
                              >
                                {duplicatingFormId === form.id ? (
                                  <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                  <CopyIcon className="h-4 w-4 text-muted-foreground" />
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
                                      handleDeleteClick({
                                        id: form.id,
                                        title: form.title || "Untitled",
                                      });
                                    }}
                                  />
                                }
                              >
                                <Trash2Icon className="h-4 w-4 text-muted-foreground" />
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
                                        ? "border border-muted-foreground/30 bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30"
                                        : "text-muted-foreground"
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleToggleSelect(form.id);
                                    }}
                                  />
                                }
                              >
                                <CheckIcon className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>{isSelected ? "Deselect" : "Select"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </Link>
                  </Card>
                );
              })
            )}
          </div>

          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + FORMS_PER_PAGE, orgForms.length)} of{" "}
                {orgForms.length} forms
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {!isLoading && orgForms.length === 0 && (
            <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed bg-muted/20 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileTextIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p>No forms yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Create your first form to get started.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCreateForm}
                disabled={isLoading || isCreating || orgWorkspaces.length === 0}
              >
                {isCreating && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Create my first form
              </Button>
            </div>
          )}
        </div>
      </main>

      {hasSelection && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 animate-in duration-300 fade-in slide-in-from-bottom-4">
          <div className="shadow-card-elevated flex items-center justify-between rounded-2xl border border-border/40 bg-background px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background">
                <CheckIcon className="h-4 w-4" strokeWidth={3} />
              </div>
              <span className="text-sm font-medium">{selectedFormIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBulkDelete}>
                Delete
                <span className="ml-1 text-xs text-muted-foreground">
                  {formatForDisplay(HOTKEYS.DASHBOARD_DELETE)}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="border border-border/50"
                onClick={handleClearSelection}
              >
                <XIcon className="h-3.5 w-3.5" />
                Clear
                <span className="ml-1 text-xs text-muted-foreground">
                  {formatForDisplay(HOTKEYS.DASHBOARD_CLEAR_SELECTION)}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {!hasSelection && (
        <div className="fixed right-6 bottom-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full border bg-muted/50 shadow-sm hover:bg-secondary"
            aria-label="Help"
          >
            <HelpCircleIcon className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      )}

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedFormIds.size} form
              {selectedFormIds.size !== 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFormIds.size} form
              {selectedFormIds.size !== 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  ssr: "data-only",
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
