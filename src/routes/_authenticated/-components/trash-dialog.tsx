import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CheckIcon,
  FileTextIcon,
  HelpCircleIcon,
  Loader2Icon,
  Trash2Icon,
  Undo2Icon,
} from "@/components/ui/icons";
import {
  bulkPermanentDeleteFormsLocal,
  permanentDeleteFormLocal,
  restoreFormLocal,
} from "@/collections";
import { parseError } from "@/lib/errors/parse";
import { useArchivedForms, useOrgWorkspaces } from "@/hooks/use-live-hooks";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { Search as LucideSearch } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export const TrashDialog = ({
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
  // Per-row pending state — independent spinner/disable per restore/delete in flight.
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Server query gated on dialog open — no payload until viewed. Sidebar listings stay archived-free.
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
        const message = parseError(error).message || "Failed to restore form";
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
        const message = parseError(error).message || "Failed to delete form";
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

  // `allow` not `replace`: dashboard registers same hotkeys at doc level; `replace` would unregister + leak them. `allow` keeps both; dashboard no-ops while a dialog is open.
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
        // Anchor in the upper area like the command palette (top ≈ 19.5%), not vertical-center.
        className="top-[19.5%] translate-y-0 gap-0 border-foreground/10 bg-background p-0 sm:max-w-[500px]"
      >
        <div className="p-1.5 pb-0">
          {/* Matches CommandInput shell — same search affordance as elsewhere. */}
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
