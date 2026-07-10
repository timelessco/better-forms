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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2Icon, StarIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SidebarItem } from "@/components/sidebar-item";
import { SidebarSection } from "@/components/ui/sidebar-section";
import type { WorkspaceWithForms } from "./workspace-item-minimal";
import { SidebarFormIcon, WorkspaceItemMinimal } from "./workspace-item-minimal";
import {
  deleteWorkspaceLocal,
  reorderFavoriteLocal,
  reorderFormLocal,
  reorderWorkspaceLocal,
  toggleFavoriteLocal,
  updateFormStatus,
  updateWorkspaceName,
} from "@/collections";
import { useDuplicateForm } from "@/hooks/use-duplicate-form";
import { useFavoriteForms, useOrgForms, useOrgWorkspaces } from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { applyReorder, sortByManualOrder } from "@/lib/sort-utils";
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
import { useLocation, useRouter } from "@tanstack/react-router";
import type * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
  // Cache workspace/forms-array identities by id — content-stable live-query churn (new array ref, same data) won't cascade new identities downstream.
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

      // Reuse prev forms array if every item is same ref in same order — stabilises array + per-form identity churn.
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

  // Same stability trick: keep prev summaries array when every (id,name) unchanged — memoised children skip re-render.
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
  // Pending state for destructive dialogs — blocks double-submit, spins button while server fn in flight.
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

export const SidebarWorkspacesMinimal = ({
  activeOrgId,
  submissionCounts,
}: {
  activeOrgId?: string;
  submissionCounts: Map<string, number>;
}) => {
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

  const favoriteForms = useFavoriteForms(session?.user?.id);

  // Stable Set of favorited ids — rows read primitive `isFavorite` prop instead of each running useIsFavorite. Set identity reused when membership unchanged.
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

  // Active form id once at parent — rows read primitive `isActive` prop, not useLocation.
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

  // Read-only ref: drag handlers read freshest workspaces without re-binding identity (would re-render every WorkspaceItemMinimal on live-query churn).
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const sortModeRef = useRef(sortMode);
  sortModeRef.current = sortMode;

  const handleWorkspaceDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    applyReorder({
      items: workspacesRef.current,
      activeId: active.id,
      overId: over?.id,
      getId: (w) => w.id,
      getSortIndex: (w) => w.sortIndex,
      persist: (w, index) => reorderWorkspaceLocal(w.id, index),
      errorLabel: "Failed to reorder workspace",
    });
  }, []);

  const handleFormDragEnd = useCallback(
    (workspaceId: string, event: DragEndEvent) => {
      const { active, over } = event;
      const ws = workspacesRef.current.find((w) => w.id === workspaceId);
      if (!ws) return;
      applyReorder({
        items: ws.forms,
        activeId: active.id,
        overId: over?.id,
        getId: (f) => f.id,
        getSortIndex: (f) => f.sortIndex,
        persist: (f, index) => reorderFormLocal(f.id, index),
        errorLabel: "Failed to reorder form",
        // Auto-switch sidebar to manual mode so the reorder "sticks" visually.
        onReordered: () => {
          if (sortModeRef.current !== "manual") handleSortChange("manual");
        },
      });
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
      applyReorder({
        items: sorted,
        activeId: active.id,
        overId: over?.id,
        getId: (f) => f.favoriteId,
        getSortIndex: (f) => f.favoriteSortIndex,
        persist: (f, index) => reorderFavoriteLocal(f.favoriteId, index),
        errorLabel: "Failed to reorder favorite",
      });
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
      // Override dnd-kit's tabIndex=0 so only the inner link is a tab stop (no duplicate ring).
      tabIndex={-1}
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
          <SidebarFormIcon
            icon={form.icon}
            customization={form.customization as Record<string, string> | null | undefined}
          />
        }
        className="group-hover/row:pe-7 group-has-[[data-state=open]]/row:pe-7"
      />
      <button
        type="button"
        aria-label="Remove from favorites"
        // Hover-only affordance; keep it out of the tab order so Tab moves row-to-row.
        tabIndex={-1}
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
