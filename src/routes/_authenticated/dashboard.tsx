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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  HelpCircleIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import {
  FigAllTemplatesIcon,
  FigBulletListIcon,
  FigCommentIcon,
  FigFilterIcon,
  FigPeopleIcon,
  FigPlusIcon,
  FigRegistrationIcon,
  FigRsvpIcon,
  FigSearchAltIcon,
  FigSmallDownIcon,
  FigSortIcon,
  FigSurveyIcon,
  FigTilesIcon,
  FigTimeIcon,
} from "@/components/dashboard/dashboard-icons";
import { FormCardThumbnail, FormListThumbnail } from "@/components/dashboard/form-card-thumbnail";
import { bulkArchiveFormsLocal, createFormLocal, updateFormStatus } from "@/collections";
import { useDuplicateForm } from "@/hooks/use-duplicate-form";
import {
  useFavorites,
  useOrgForms,
  useOrgWorkspaces,
  useSubmissionCounts,
} from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { formatForDisplay, HOTKEYS } from "@/lib/hotkeys";
import { clearLocalDraftIds } from "@/db/local-draft";
import { hasLocalDataToSync, syncLocalDataToCloud } from "@/db/sync";
import { buildTemplateContent, FORM_TEMPLATE_META } from "@/lib/form-templates";
import type { FormTemplateId } from "@/lib/form-templates";
import { sortByManualOrder } from "@/lib/sort-utils";
import { cn, parseTimestampAsUTC } from "@/lib/utils";
import { log } from "evlog";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import { parseError } from "@/lib/errors/parse";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as v from "valibot";
import { IconSwap } from "@/components/transitions/icon-swap";
import { TextSwap } from "@/components/transitions/text-swap";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

// Fallback page size before the viewport is measured (SSR / first paint).
const FORMS_PER_PAGE = 12;

// Page size that fills the viewport: as many full card rows as fit above the pager, × the current
// column count — so the pagination control stays on-screen without scrolling. Measured live via a ref
// callback + ResizeObserver (no useEffect; same pattern as use-mobile) so it adapts to viewport width
// (columns), height, sidebar collapse, and the chrome above the grid.
const PAGER_RESERVE = 120; // pager block + section gap + bottom breathing room
const CARD_STRIDE_FALLBACK = 220; // card height before a card is measured

const useViewportPageSize = (
  fallback: number,
): readonly [number, (grid: HTMLDivElement | null) => void] => {
  const [perPage, setPerPage] = useState(fallback);
  const attach = useCallback((grid: HTMLDivElement | null) => {
    if (!grid) return;
    const recompute = () => {
      const style = getComputedStyle(grid);
      const cols = Math.max(1, style.gridTemplateColumns.split(" ").length);
      const gap = Number.parseFloat(style.rowGap) || 12;
      const card = grid.firstElementChild as HTMLElement | null;
      const stride = (card?.getBoundingClientRect().height || CARD_STRIDE_FALLBACK) + gap;
      const available = window.innerHeight - grid.getBoundingClientRect().top - PAGER_RESERVE;
      const rows = Math.max(1, Math.floor((available + gap) / stride));
      setPerPage(cols * rows);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(grid);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, []);
  return [perPage, attach] as const;
};

type FormFilter = "all" | "favorites" | "drafts" | "published";
type FormViewMode = "grid" | "list";
type FormSort = "recent" | "title";

const FILTER_OPTIONS: ReadonlyArray<{ value: FormFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
  { value: "drafts", label: "Drafts" },
  { value: "published", label: "Published" },
];

// Template-card icons — verbatim Figma glyphs from node 26208:8027.
const TEMPLATE_ICONS: Partial<
  Record<FormTemplateId, React.ComponentType<React.SVGProps<SVGSVGElement>>>
> = {
  blank: FigPlusIcon,
  survey: FigSurveyIcon,
  feedback: FigCommentIcon,
  eventRsvp: FigRsvpIcon,
  registration: FigRegistrationIcon,
};

const greetingFor = (date: Date): string => {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// Figma 26208:8074 — gray/100 pill trigger (filter icon + static "Filter" label + chevron); the
// active option is marked with a tick inside the dropdown, not shown on the trigger.
// Search moved out of the app header into the All Forms toolbar (Figma 26835:10024):
// gray/100 pill, 170px, search-alt icon, "Search" placeholder. Writes ?q= (debounced).
const DashboardSearch = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? "");

  // Sync local input when the URL param changes externally (back/forward, clear). Adjusted during
  // render (the "store info from a previous render" pattern), not via a setState-in-effect.
  const [lastSearchQ, setLastSearchQ] = useState(search.q);
  if (lastSearchQ !== search.q) {
    setLastSearchQ(search.q);
    setInput(search.q ?? "");
  }

  // Debounce keystrokes → URL ?q= so the dashboard list re-filters.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = input.trim() || undefined;
      if ((search.q ?? undefined) === next) return;
      void navigate({
        to: "/dashboard",
        search: (prev: Record<string, unknown>) => ({ ...prev, q: next }),
        replace: true,
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [input, search.q, navigate]);

  return (
    <div className="flex h-7 w-[170px] items-center gap-1.5 rounded-lg bg-secondary pr-2.5 pl-2">
      <FigSearchAltIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search"
        aria-label="Search forms"
        className="w-full bg-transparent font-case text-base font-[450] tracking-[0.14px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
};

const FilterMenu = ({
  currentFilter,
  onChange,
}: {
  currentFilter: FormFilter;
  onChange: (next: FormFilter) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost-flat"
          size="sm"
          aria-label="Filter forms"
          className="rounded-lg bg-secondary px-2 hover:bg-secondary/80"
        >
          <FigFilterIcon className="size-4 text-gray-800" />
          <span className="font-case text-base font-[450] tracking-[0.14px] text-gray-800">
            Filter
          </span>
          <FigSmallDownIcon className="size-4 text-gray-800" />
        </Button>
      }
    />
    <DropdownMenuContent align="end" sideOffset={4}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Filter</DropdownMenuLabel>
        {FILTER_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            <span className="flex-1 text-left">{option.label}</span>
            {currentFilter === option.value && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
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
        log.error({ tag: "dashboard", msg: "Failed to sync local data", error });
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
  const { q: searchQuery = "" } = useSearch({ strict: false }) as { q?: string };
  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedFormIds, setSelectedFormIds] = useState<Set<string>>(new Set());
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<FormFilter>("all");
  const [viewMode, setViewMode] = useState<FormViewMode>("grid");
  const [sortBy, setSortBy] = useState<FormSort>("recent");
  // `formsPerPage` is the viewport-fill batch size; `visibleCount` is how many forms are rendered now
  // (infinite scroll grows it). Initial fallback before the viewport is measured.
  const [formsPerPage, gridRef] = useViewportPageSize(FORMS_PER_PAGE);
  const [visibleCount, setVisibleCount] = useState(FORMS_PER_PAGE);

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
  const submissionCounts = useSubmissionCounts();
  const favoriteFormIds = useMemo(
    () => new Set((favorites ?? []).map((f) => f.formId)),
    [favorites],
  );

  const orderedWorkspaces = useMemo(
    () =>
      sortByManualOrder(
        orgWorkspaces,
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [orgWorkspaces],
  );

  // Filter → search → sort pipeline. Search matches title; sort by recency or title.
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

  const searchedForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredForms;
    return filteredForms.filter((f) => (f.title ?? "Untitled").toLowerCase().includes(q));
  }, [filteredForms, searchQuery]);

  const visibleForms = useMemo(() => {
    const sorted = [...searchedForms];
    if (sortBy === "title") {
      sorted.sort((a, b) => (a.title ?? "Untitled").localeCompare(b.title ?? "Untitled"));
    } else {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return sorted;
  }, [searchedForms, sortBy]);

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
        log.error({ tag: "dashboard", msg: "Failed to create form", error });
      } finally {
        setIsCreating(false);
      }
    },
    [orderedWorkspaces, navigate],
  );

  // Template cards create a pre-seeded form (starter fields per template) then open the editor.
  const handleCreateFromTemplate = useCallback(
    (templateId: FormTemplateId) => {
      const targetId = orderedWorkspaces[0]?.id;
      if (!targetId) return;
      const meta = FORM_TEMPLATE_META.find((t) => t.id === templateId);
      const title = meta?.label ?? "Untitled";

      setIsCreating(true);
      try {
        const { form: newForm } = createFormLocal(targetId, {
          title,
          content: buildTemplateContent(templateId),
        });
        void navigate({
          to: "/workspace/$workspaceId/form-builder/$formId/edit",
          params: { workspaceId: targetId, formId: newForm.id },
        });
      } catch (error) {
        log.error({ tag: "dashboard", msg: "Failed to create form from template", error });
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
        log.error({ tag: "dashboard", msg: "Failed to archive form", error });
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

  const isModalDialogOpen = () =>
    typeof document !== "undefined" &&
    document.querySelector('[data-slot="dialog-content"][data-open]') !== null;

  // Select-all toggles only the currently-rendered (loaded) rows — never forms still below the
  // infinite-scroll fold that you can't see.
  const handleSelectAll = useCallback(() => {
    if (isModalDialogOpen()) return;
    const ids = visibleForms.slice(0, visibleCount).map((f) => f.id);
    if (ids.length === 0) return;
    setSelectedFormIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [visibleForms, visibleCount]);

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

  // Infinite scroll: render the first `visibleCount` forms; a sentinel below the grid loads more.
  const renderedForms = visibleForms.slice(0, visibleCount);
  const hasMore = visibleCount < visibleForms.length;

  // Reset the scroll window whenever the list itself changes (filter / search / sort).
  const listKey = `${currentFilter}|${searchQuery}|${sortBy}`;
  const [lastListKey, setLastListKey] = useState(listKey);
  if (lastListKey !== listKey) {
    setLastListKey(listKey);
    setVisibleCount(formsPerPage);
  }

  // Grow the window when the sentinel scrolls into view. No useEffect — ref-callback + observer
  // (same pattern as useViewportPageSize). The callback ref re-runs (re-observes) when the batch
  // size or total changes, so the observer's closure always reads current values.
  const totalForms = visibleForms.length;
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisibleCount((c) => Math.min(c + formsPerPage, totalForms));
          }
        },
        { rootMargin: "300px" },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [formsPerPage, totalForms],
  );

  const handleFilterChange = useCallback((next: FormFilter) => {
    setCurrentFilter(next);
    setSelectedFormIds(new Set());
  }, []);

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

  const orgWorkspacesCount = orderedWorkspaces.length;
  const userName = session?.user?.name;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      {/* 1060 cap = Figma 900px content column + lg:px-20 gutters (80×2), so template cards land at 170.4px. */}
      <main className="mx-auto w-full max-w-[1060px] flex-1 px-6 py-8 md:px-12 md:py-12 lg:px-20">
        <section className="flex flex-col gap-5">
          {/* Greeting */}
          {/* font-sans re-binds the wght axis so font-semibold actually renders 600 (Figma Semi Bold);
              without it the inherited font-variation-settings pins wght to 450. */}
          <h1 className="font-sans text-xl leading-[1.15] font-semibold tracking-normal text-gray-950">
            <TextSwap key={userName}>
              {greetingFor(new Date())}
              {userName ? `, ${userName}` : ""}
            </TextSwap>
          </h1>

          {/* Quick-create templates */}
          <QuickCreateTemplates
            isCreating={isCreating}
            disabled={isLoading || isCreating || orgWorkspacesCount === 0}
            onCreate={handleCreateFromTemplate}
          />
        </section>

        {/* Recent Forms */}
        <section className="mt-10 space-y-5">
          <div className="flex items-center justify-between gap-3">
            {/* font-sans re-binds the wght axis so font-semibold renders 600 (Figma SemiBold), not the pinned 450. */}
            <h2 className="font-sans text-[15px] leading-[1.15] font-semibold tracking-[0.225px] text-gray-950">
              Recent Forms
            </h2>
            {!isLoading && orgForms.length > 0 && (
              <div className="flex items-center gap-2">
                <DashboardSearch />
                <FilterMenu currentFilter={currentFilter} onChange={handleFilterChange} />
                <SortMenu sortBy={sortBy} onChange={setSortBy} />
                <ViewToggle mode={viewMode} onChange={setViewMode} />
              </div>
            )}
          </div>

          <DashboardFormGrid
            isSyncing={isSyncing}
            isLoading={isLoading}
            viewMode={viewMode}
            gridRef={gridRef}
            paginatedForms={renderedForms}
            selectedFormIds={selectedFormIds}
            duplicatingFormId={duplicatingFormId}
            submissionCounts={submissionCounts}
            formatLastEdited={formatLastEdited}
            handleDuplicate={handleDuplicate}
            handleDeleteClick={handleDeleteClick}
            handleToggleSelect={handleToggleSelect}
          />

          {!isLoading && visibleForms.length === 0 && orgForms.length > 0 && (
            <FilteredEmptyState filter={currentFilter} />
          )}

          {/* Infinite-scroll sentinel — observing this triggers the next batch (rootMargin pre-loads). */}
          {!isLoading && hasMore && <div ref={loadMoreRef} aria-hidden className="h-px w-full" />}

          {!isLoading && orgForms.length === 0 && (
            <DashboardEmptyState
              isCreating={isCreating}
              disabled={isLoading || isCreating || orgWorkspacesCount === 0}
              onCreate={() => handleCreateForm()}
            />
          )}
        </section>
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
    </div>
  );
};

interface QuickCreateTemplatesProps {
  isCreating: boolean;
  disabled: boolean;
  onCreate: (templateId: FormTemplateId) => void;
}

// Shared card chrome for the quick-create row.
const QUICK_CARD_CLASS =
  "flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-[12px] border bg-gray-50 px-5 py-[18px] transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const QUICK_CARD_LABEL = "text-base font-[450] tracking-[0.28px] text-gray-950";

// Figma node 26208:8027 — row of equal-flex template cards. Blank + "All templates" = dashed
// gray/300 border; others = solid gray/100 hairline. 24px icon + 14px label. Only `featured`
// templates are pinned here; the rest live in the /templates gallery.
const QuickCreateTemplates = ({ disabled, onCreate }: QuickCreateTemplatesProps) => (
  <div className="flex items-stretch gap-3">
    {FORM_TEMPLATE_META.filter((t) => t.featured).map((template) => {
      const Icon = TEMPLATE_ICONS[template.id] ?? FigPlusIcon;
      const isBlank = template.id === "blank";
      return (
        <button
          key={template.id}
          type="button"
          disabled={disabled}
          onClick={() => onCreate(template.id)}
          className={cn(
            QUICK_CARD_CLASS,
            isBlank ? "border-dashed border-gray-300" : "border-gray-100",
          )}
          aria-label={`Create ${template.label}`}
        >
          <Icon className="size-6 text-gray-950" />
          <span className={QUICK_CARD_LABEL}>{template.label}</span>
        </button>
      );
    })}
    {/* Browse the full gallery instead of creating a form. */}
    <Link
      to="/templates"
      className={cn(QUICK_CARD_CLASS, "border-dashed border-gray-300")}
      aria-label="Browse all templates"
    >
      <FigAllTemplatesIcon className="size-6 text-gray-950" />
      <span className={QUICK_CARD_LABEL}>All templates</span>
    </Link>
  </div>
);

const SortMenu = ({
  sortBy,
  onChange,
}: {
  sortBy: FormSort;
  onChange: (next: FormSort) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost-flat"
          size="sm"
          aria-label="Sort forms"
          className="rounded-lg bg-secondary px-2 hover:bg-secondary/80"
        >
          <FigSortIcon className="size-4 text-gray-800" />
          <span className="font-case text-base font-[450] tracking-[0.14px] text-gray-800">
            Sort by
          </span>
          <FigSmallDownIcon className="size-4 text-gray-800" />
        </Button>
      }
    />
    <DropdownMenuContent align="end" sideOffset={4}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onChange("recent")}>
          <span className="flex-1 text-left">Recent</span>
          {sortBy === "recent" && <CheckIcon className="size-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("title")}>
          <span className="flex-1 text-left">Name</span>
          {sortBy === "title" && <CheckIcon className="size-4" />}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Figma "tabs" (26208:8090) — gray/100 track with a sliding active pill. Uses the shared animated
// Tabs (TabsIndicator) so the highlight slides between options, matching the share-sidebar tabs.
// Square icon-only triggers: w-[26px] (sm trigger is already h-6.5), flex-none + px-0! drop the
// stretch/padding the text-tab variant applies.
const VIEW_TAB = "w-[26px] flex-none px-0! text-muted-foreground";
const ViewToggle = ({
  mode,
  onChange,
}: {
  mode: FormViewMode;
  onChange: (next: FormViewMode) => void;
}) => (
  <Tabs value={mode} onValueChange={(value) => onChange(value as FormViewMode)}>
    <TabsList className="gap-1 rounded-lg">
      <TabsTrigger value="grid" aria-label="Grid view" className={VIEW_TAB}>
        <FigTilesIcon className="size-4" />
      </TabsTrigger>
      <TabsTrigger value="list" aria-label="List view" className={VIEW_TAB}>
        <FigBulletListIcon className="size-4" />
      </TabsTrigger>
      <TabsIndicator />
    </TabsList>
  </Tabs>
);

type FormCardForm = {
  id: string;
  title: string | null;
  status: string;
  workspaceId: string;
  updatedAt: string;
  cover?: string | null;
  previewImageUrl?: string | null;
  customization?: Record<string, unknown> | null;
};

interface DashboardFormGridProps {
  isSyncing: boolean;
  isLoading: boolean;
  viewMode: FormViewMode;
  gridRef: (grid: HTMLDivElement | null) => void;
  paginatedForms: ReadonlyArray<FormCardForm>;
  selectedFormIds: Set<string>;
  duplicatingFormId: string | null;
  submissionCounts: Map<string, number>;
  formatLastEdited: (timestamp: string) => string;
  handleDuplicate: (formId: string) => Promise<void> | void;
  handleDeleteClick: (form: { id: string; title: string }) => void;
  handleToggleSelect: (formId: string) => void;
}

const DashboardFormGrid = ({
  isSyncing,
  isLoading,
  viewMode,
  gridRef,
  paginatedForms,
  selectedFormIds,
  duplicatingFormId,
  submissionCounts,
  formatLastEdited,
  handleDuplicate,
  handleDeleteClick,
  handleToggleSelect,
}: DashboardFormGridProps) => {
  if (isSyncing) return <SyncOverlay />;
  if (isLoading) {
    return (
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="bg-gray-0 h-[218px] animate-pulse rounded-[12px] border border-gray-100"
          />
        ))}
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <DashboardTable
        paginatedForms={paginatedForms}
        selectedFormIds={selectedFormIds}
        duplicatingFormId={duplicatingFormId}
        submissionCounts={submissionCounts}
        handleDuplicate={handleDuplicate}
        handleDeleteClick={handleDeleteClick}
        handleToggleSelect={handleToggleSelect}
      />
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {paginatedForms.map((form) => (
        <FormCard
          key={form.id}
          form={form}
          isSelected={selectedFormIds.has(form.id)}
          selectionActive={selectedFormIds.size > 0}
          duplicatingFormId={duplicatingFormId}
          responseCount={submissionCounts.get(form.id) ?? 0}
          formatLastEdited={formatLastEdited}
          onDuplicate={handleDuplicate}
          onDeleteClick={handleDeleteClick}
          onToggleSelect={handleToggleSelect}
        />
      ))}
    </div>
  );
};

interface FormCardProps {
  form: FormCardForm;
  isSelected: boolean;
  /** Any form selected → show a select tick on every card instead of the ⋯ menu. */
  selectionActive: boolean;
  duplicatingFormId: string | null;
  responseCount: number;
  formatLastEdited: (timestamp: string) => string;
  onDuplicate: (formId: string) => Promise<void> | void;
  onDeleteClick: (form: { id: string; title: string }) => void;
  onToggleSelect: (formId: string) => void;
}

// Chip for the on-cover hover actions (ghost-flat variant kills the ghost's transparent border).
const CARD_ACTION_SHADOW = "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.18)] dark:shadow-none";
// Frosted ⋯ chip over the cover — light = white chip / dark icon; dark = dark chip / white icon.
const CARD_ACTION_BTN = cn(
  CARD_ACTION_SHADOW,
  "bg-white/80 text-gray-700 backdrop-blur-md hover:bg-white hover:text-gray-900 dark:bg-black/45 dark:text-white dark:hover:bg-black/65",
);

// Figma node 26216:10218 — card with 90px preview area (cover banner) and an info block:
// title (gray/900) then 3 meta rows (icon + 14px gray/700, status in green).
const FormCard = ({
  form,
  isSelected,
  selectionActive,
  duplicatingFormId,
  responseCount,
  formatLastEdited,
  onDuplicate,
  onDeleteClick,
  onToggleSelect,
}: FormCardProps) => {
  const isPublished = form.status === "published";
  const [menuOpen, setMenuOpen] = useState(false);

  // The action slot stays pinned while duplicating, when this card is selected, when the menu is open,
  // or whenever a selection is active (every card then shows a select tick instead of the ⋯ menu).
  const actionsPinned = duplicatingFormId === form.id || isSelected || selectionActive || menuOpen;
  const actionGroupCls = cn(
    "absolute top-3 z-[1] flex items-center gap-1 transition-opacity",
    actionsPinned
      ? "opacity-100"
      : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
  );

  return (
    <div
      className={cn(
        "group bg-gray-0 relative flex flex-col rounded-[12px] border border-gray-100 px-1.5 pt-1.5 pb-2 transition-[background-color,box-shadow] duration-200",
        isSelected ? "ring-2 elevation-card ring-ring/50" : "hover:elevation-card",
      )}
    >
      <Link
        to={
          isPublished
            ? "/workspace/$workspaceId/form-builder/$formId/submissions"
            : "/workspace/$workspaceId/form-builder/$formId/edit"
        }
        params={{ workspaceId: form.workspaceId, formId: form.id }}
        preload="intent"
        className="flex flex-col outline-none"
      >
        <FormCardThumbnail
          title={form.title ?? "Untitled"}
          cover={form.cover}
          preview={form.previewImageUrl}
        />

        {/* Info block */}
        <div className="mt-3 flex w-full flex-col gap-2">
          <div className="px-1">
            <p className="truncate text-base font-medium tracking-[0.28px] text-foreground">
              {form.title || "Untitled"}
            </p>
          </div>
          <div className="flex w-full flex-col">
            <MetaRow>
              {/* Status dot — success green (#1e8d02) for published; muted for draft. Centered in a
                  16px slot so its label aligns with the 16px-icon rows below (Figma icon/line/dot). */}
              <span className="flex size-4 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    isPublished ? "bg-[var(--color-success)]" : "bg-muted-foreground/50",
                  )}
                />
              </span>
              <span
                className={cn(
                  "text-base font-[420] tracking-[0.28px]",
                  isPublished ? "text-[var(--color-success)]" : "text-muted-foreground",
                )}
              >
                {isPublished ? "Published" : "Draft"}
              </span>
            </MetaRow>
            <MetaRow>
              <FigTimeIcon className="size-4 shrink-0 text-gray-700" />
              <span className="min-w-0 truncate text-base font-[420] tracking-[0.28px] text-gray-700">
                {formatLastEdited(form.updatedAt)}
              </span>
            </MetaRow>
            <MetaRow>
              <FigPeopleIcon className="size-4 shrink-0 text-gray-700" />
              <span className="min-w-0 truncate text-base font-[420] tracking-[0.28px] text-gray-700">
                {responseCount === 0
                  ? "--"
                  : `${responseCount} ${responseCount === 1 ? "response" : "responses"}`}
              </span>
            </MetaRow>
          </div>
        </div>
      </Link>

      {/* Top-right slot (sibling of the Link, no nested anchors): a ⋯ menu (Duplicate / Select /
          Delete) on hover; once the form is selected it becomes a checkbox tick — the only
          selection cue, shown ONLY while selected (never on hover). */}
      <div className={cn(actionGroupCls, "right-3")}>
        {isSelected || selectionActive ? (
          <Button
            variant="ghost-flat"
            size="icon-sm"
            className={CARD_ACTION_BTN}
            aria-label={isSelected ? "Deselect form" : "Select form"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect(form.id);
            }}
          >
            {/* Faint check when not yet selected (a selectable tick), solid once selected. */}
            <CheckIcon className={cn("size-3.5", !isSelected && "opacity-30")} />
          </Button>
        ) : (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost-flat"
                  size="icon-sm"
                  className={CARD_ACTION_BTN}
                  aria-label="Form actions"
                  disabled={duplicatingFormId === form.id}
                />
              }
            >
              <IconSwap
                state={duplicatingFormId === form.id ? "b" : "a"}
                iconA={<MoreHorizontalIcon className="size-4" />}
                iconB={<Loader2Icon className="size-4 animate-spin" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4} className="w-40">
              <DropdownMenuItem
                disabled={duplicatingFormId === form.id}
                onClick={() => void onDuplicate(form.id)}
              >
                <CopyIcon className="size-4" />
                <span className="flex-1 text-left">Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleSelect(form.id)}>
                <CheckIcon className="size-4" />
                <span className="flex-1 text-left">Select</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteClick({ id: form.id, title: form.title || "Untitled" })}
              >
                <Trash2Icon className="size-4" />
                <span className="flex-1 text-left">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

const MetaRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full items-center gap-2 px-1 py-[5px]">{children}</div>
);

// Shared column widths for the list table (Figma node 26216:13434). Title is fluid (flex-1);
// a 32px gap (gap-8) separates it from the fixed Status/Responses/Edited/Actions columns.
const LIST_COL_STATUS = "w-36"; // 144px
const LIST_COL_RESPONSES = "w-36"; // 144px
const LIST_COL_EDITED = "w-[216px]";
const LIST_COL_ACTIONS = "size-7"; // 28px

interface DashboardTableProps {
  paginatedForms: ReadonlyArray<FormCardForm>;
  selectedFormIds: Set<string>;
  duplicatingFormId: string | null;
  submissionCounts: Map<string, number>;
  handleDuplicate: (formId: string) => Promise<void> | void;
  handleDeleteClick: (form: { id: string; title: string }) => void;
  handleToggleSelect: (formId: string) => void;
}

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm font-[420] tracking-[0.26px] text-gray-500">{children}</span>
);

const DashboardTable = ({
  paginatedForms,
  selectedFormIds,
  duplicatingFormId,
  submissionCounts,
  handleDuplicate,
  handleDeleteClick,
  handleToggleSelect,
}: DashboardTableProps) => (
  <div className="overflow-x-auto">
    <div className="min-w-[680px]">
      {/* Header row — border-b gray-100, 13px / font-420 / gray-500 (Figma 26216:13365) */}
      <div className="flex h-8 items-center gap-8 border-b border-gray-100 px-1">
        <div className="flex-1 px-2">
          <TableHead>Name</TableHead>
        </div>
        <div className="flex shrink-0 items-center">
          <div className={cn(LIST_COL_STATUS, "px-2")}>
            <TableHead>Status</TableHead>
          </div>
          <div className={cn(LIST_COL_RESPONSES, "px-2")}>
            <TableHead>Responses</TableHead>
          </div>
          <div className={cn(LIST_COL_EDITED, "px-2")}>
            <TableHead>Last edited</TableHead>
          </div>
          <div className={cn(LIST_COL_ACTIONS, "shrink-0")} />
        </div>
      </div>

      {paginatedForms.map((form) => (
        <FormListRow
          key={form.id}
          form={form}
          isSelected={selectedFormIds.has(form.id)}
          selectionActive={selectedFormIds.size > 0}
          duplicatingFormId={duplicatingFormId}
          responseCount={submissionCounts.get(form.id) ?? 0}
          onDuplicate={handleDuplicate}
          onDeleteClick={handleDeleteClick}
          onToggleSelect={handleToggleSelect}
        />
      ))}
    </div>
  </div>
);

interface FormListRowProps {
  form: FormCardForm;
  isSelected: boolean;
  /** Any form selected → show a checkbox on every row instead of the ⋯ menu. */
  selectionActive: boolean;
  duplicatingFormId: string | null;
  responseCount: number;
  onDuplicate: (formId: string) => Promise<void> | void;
  onDeleteClick: (form: { id: string; title: string }) => void;
  onToggleSelect: (formId: string) => void;
}

// Figma 26216:13294 — 44px row: thumbnail+title (flex) | status pill | responses | edited | ⋯ menu.
const FormListRow = ({
  form,
  isSelected,
  selectionActive,
  duplicatingFormId,
  responseCount,
  onDuplicate,
  onDeleteClick,
  onToggleSelect,
}: FormListRowProps) => {
  const isPublished = form.status === "published";
  const relative = `${formatDistanceToNow(parseTimestampAsUTC(form.updatedAt) ?? new Date())} ago`;

  return (
    <div
      className={cn(
        "group flex h-11 items-center gap-8 rounded-lg border-b border-gray-100 px-1 transition-colors hover:bg-secondary",
        isSelected && "bg-secondary",
      )}
    >
      {/* Name — thumbnail + title (Select moved into the ⋯ menu) */}
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
        <Link
          to={
            isPublished
              ? "/workspace/$workspaceId/form-builder/$formId/submissions"
              : "/workspace/$workspaceId/form-builder/$formId/edit"
          }
          params={{ workspaceId: form.workspaceId, formId: form.id }}
          preload="intent"
          className="flex min-w-0 flex-1 items-center gap-2 outline-none"
        >
          <FormListThumbnail
            title={form.title ?? "Untitled"}
            cover={form.cover}
            preview={form.previewImageUrl}
          />
          <span className="truncate text-base font-[450] tracking-[0.28px] text-gray-800">
            {form.title || "Untitled"}
          </span>
        </Link>
      </div>

      <div className="flex shrink-0 items-center">
        {/* Status pill — published: soft-green pair; draft: muted */}
        <div className={cn(LIST_COL_STATUS, "px-2")}>
          <span
            className={cn(
              "inline-flex items-center rounded-[60px] px-1.5 py-[3px] text-xs font-[450] tracking-[0.24px]",
              isPublished
                ? "bg-[var(--color-success-soft)] text-[var(--color-success-on-soft)]"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>
        {/* Responses */}
        <div className={cn(LIST_COL_RESPONSES, "px-2")}>
          <span className="text-base font-[420] tracking-[0.28px] text-gray-700">
            {responseCount}
          </span>
        </div>
        {/* Last edited */}
        <div className={cn(LIST_COL_EDITED, "px-2")}>
          <span className="truncate text-base font-[420] tracking-[0.28px] text-gray-700">
            {relative}
          </span>
        </div>
        {/* Actions — ⋯ menu (Duplicate / Select / Delete) on hover; a checkbox once any row is
            selected (checked on this row, empty on the others to multi-select). */}
        <div className={cn(LIST_COL_ACTIONS, "flex shrink-0 items-center justify-center")}>
          {isSelected || selectionActive ? (
            <Checkbox
              checked={isSelected}
              aria-label={isSelected ? "Deselect form" : "Select form"}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => onToggleSelect(form.id)}
            />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost-flat"
                    size="icon-sm"
                    aria-label="Form actions"
                    disabled={duplicatingFormId === form.id}
                    className={cn(
                      "text-muted-foreground",
                      duplicatingFormId === form.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100",
                    )}
                  />
                }
              >
                {duplicatingFormId === form.id ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontalIcon className="size-4" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => void onDuplicate(form.id)}>
                  <CopyIcon className="size-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onToggleSelect(form.id)}>
                  <CheckIcon className="size-4" />
                  Select
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteClick({ id: form.id, title: form.title || "Untitled" })}
                >
                  <Trash2Icon className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

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
        <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
  // Header search writes ?q= (debounced). Optional so existing navigations need not supply it.
  validateSearch: v.object({ q: v.optional(v.string()) }),
  ssr: "data-only",
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
