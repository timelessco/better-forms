import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { CheckIcon, FileTextIcon, HelpCircleIcon, Loader2Icon } from "@/components/ui/icons";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import {
  FigAddMdIcon,
  FigAppsIcon,
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
import { createFormLocal } from "@/collections";
import {
  useFavorites,
  useOrgForms,
  useOrgWorkspaces,
  useSubmissionCounts,
} from "@/hooks/use-live-hooks";
import { useSession } from "@/lib/auth/auth-client";
import { clearLocalDraftIds } from "@/db/local-draft";
import { hasLocalDataToSync, syncLocalDataToCloud } from "@/db/sync";
import { buildTemplateContent, FORM_TEMPLATE_META } from "@/lib/form-templates";
import type { FormTemplateId } from "@/lib/form-templates";
import { sortByManualOrder } from "@/lib/sort-utils";
import { cn, parseTimestampAsUTC } from "@/lib/utils";
import { log } from "evlog";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { orgDataForLayoutQueryOptions } from "@/lib/server-fn/org";
import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as v from "valibot";
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
type SortField = "responses" | "created" | "edited";
type SortDir = "asc" | "desc";
type FormSort = { field: SortField; dir: SortDir };

// Sort fields shown in the Sort dropdown. Only Responses nests into Ascending / Descending; the
// date fields are plain items that sort newest-first (descending).
const SORT_FIELDS: ReadonlyArray<{ value: SortField; label: string; nested: boolean }> = [
  { value: "responses", label: "Responses", nested: true },
  { value: "created", label: "Date created", nested: false },
  { value: "edited", label: "Last edited", nested: false },
];

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
  blank: FigAddMdIcon,
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
  const { q: searchQuery = "" } = useSearch({ strict: false }) as { q?: string };
  const { data: activeOrg } = useQuery({
    ...orgDataForLayoutQueryOptions(),
    select: (d) => d.activeOrg,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<FormFilter>("all");
  const [viewMode, setViewMode] = useState<FormViewMode>("grid");
  const [sortBy, setSortBy] = useState<FormSort>({ field: "edited", dir: "desc" });
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

  // Filter → search → sort pipeline. Search matches title; sort by responses/created/edited × dir.
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
    const dir = sortBy.dir === "asc" ? 1 : -1;
    const compare = (a: FormCardForm, b: FormCardForm) => {
      switch (sortBy.field) {
        case "responses":
          return (submissionCounts.get(a.id) ?? 0) - (submissionCounts.get(b.id) ?? 0);
        case "created":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default: // edited
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
    };
    return [...searchedForms].sort((a, b) => compare(a, b) * dir);
  }, [searchedForms, sortBy, submissionCounts]);

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

  const formatLastEdited = (timestamp: string) =>
    `Edited ${formatDistanceToNow(parseTimestampAsUTC(timestamp) ?? new Date())} ago`;

  // Infinite scroll: render the first `visibleCount` forms; a sentinel below the grid loads more.
  const renderedForms = visibleForms.slice(0, visibleCount);
  const hasMore = visibleCount < visibleForms.length;

  // Reset the scroll window whenever the list itself changes (filter / search / sort).
  const listKey = `${currentFilter}|${searchQuery}|${sortBy.field}|${sortBy.dir}`;
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
  }, []);

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

        {/* All Forms */}
        <section className="mt-10 space-y-5">
          <div className="flex items-center justify-between gap-3">
            {/* font-sans re-binds the wght axis so font-semibold renders 600 (Figma SemiBold), not the pinned 450. */}
            <h2 className="font-sans text-[15px] leading-[1.15] font-semibold tracking-[0.225px] text-gray-950">
              All Forms
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
            submissionCounts={submissionCounts}
            formatLastEdited={formatLastEdited}
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

      <FloatingHelpButton />
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

// Figma node 27170:28095 — row of equal-flex template cards. Blank = dashed gray/300 border (Figma
// node 27170:28095); the rest = solid gray/100 hairline. 24px icon + 14px label (Medium/450, gray/950).
// Only `featured` templates are pinned here; rest live in /templates.
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
      className={cn(QUICK_CARD_CLASS, "border-gray-100")}
      aria-label="Browse all templates"
    >
      <FigAppsIcon className="size-6 text-gray-950" />
      <span className={QUICK_CARD_LABEL}>All Templates</span>
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
            Sort
          </span>
          <FigSmallDownIcon className="size-4 text-gray-800" />
        </Button>
      }
    />
    <DropdownMenuContent align="end" sideOffset={4} className="min-w-[168px]">
      <DropdownMenuGroup>
        {SORT_FIELDS.map((field) =>
          field.nested ? (
            <DropdownMenuSub key={field.value}>
              <DropdownMenuSubTrigger>
                <span className="flex-1 text-left whitespace-nowrap">{field.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {(["asc", "desc"] as const).map((dir) => (
                  <DropdownMenuItem key={dir} onClick={() => onChange({ field: field.value, dir })}>
                    <span className="flex-1 text-left">
                      {dir === "asc" ? "Ascending" : "Descending"}
                    </span>
                    {sortBy.field === field.value && sortBy.dir === dir && (
                      <CheckIcon className="size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem
              key={field.value}
              onClick={() => onChange({ field: field.value, dir: "desc" })}
            >
              <span className="flex-1 text-left whitespace-nowrap">{field.label}</span>
              {sortBy.field === field.value && <CheckIcon className="size-4" />}
            </DropdownMenuItem>
          ),
        )}
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
  createdAt: string;
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
  submissionCounts: Map<string, number>;
  formatLastEdited: (timestamp: string) => string;
}

const DashboardFormGrid = ({
  isSyncing,
  isLoading,
  viewMode,
  gridRef,
  paginatedForms,
  submissionCounts,
  formatLastEdited,
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
    return <DashboardTable paginatedForms={paginatedForms} submissionCounts={submissionCounts} />;
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
          responseCount={submissionCounts.get(form.id) ?? 0}
          formatLastEdited={formatLastEdited}
        />
      ))}
    </div>
  );
};

interface FormCardProps {
  form: FormCardForm;
  responseCount: number;
  formatLastEdited: (timestamp: string) => string;
}

// Figma node 26216:10218 — card with 90px preview area (cover banner) and an info block:
// title (gray/900) then 3 meta rows (icon + 14px gray/700, status in green).
const FormCard = ({ form, responseCount, formatLastEdited }: FormCardProps) => {
  const isPublished = form.status === "published";

  return (
    <div className="group bg-gray-0 relative flex flex-col rounded-[12px] border border-gray-100 px-1.5 pt-1.5 pb-2 transition-[background-color,box-shadow] duration-200 hover:elevation-card">
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
              {/* Status dot — Figma icon/line/dot (node 27170:28329): 6px circle centered in a 16px
                  slot so its label aligns with the 16px-icon rows below. Green #1e8d02 / muted draft. */}
              <span className="flex size-4 shrink-0 items-center justify-center">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
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
    </div>
  );
};

const MetaRow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-full items-center gap-2 px-1 py-[5px]">{children}</div>
);

// Shared column widths for the list table (Figma node 26216:13434). Title is fluid (flex-1);
// a 32px gap (gap-8) separates it from the fixed Status/Responses/Edited columns.
const LIST_COL_STATUS = "w-36"; // 144px
const LIST_COL_RESPONSES = "w-36"; // 144px
const LIST_COL_EDITED = "w-[216px]";

interface DashboardTableProps {
  paginatedForms: ReadonlyArray<FormCardForm>;
  submissionCounts: Map<string, number>;
}

const TableHead = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm font-[420] tracking-[0.26px] text-gray-500">{children}</span>
);

const DashboardTable = ({ paginatedForms, submissionCounts }: DashboardTableProps) => (
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
        </div>
      </div>

      {paginatedForms.map((form) => (
        <FormListRow key={form.id} form={form} responseCount={submissionCounts.get(form.id) ?? 0} />
      ))}
    </div>
  </div>
);

interface FormListRowProps {
  form: FormCardForm;
  responseCount: number;
}

// Figma 26216:13294 — 44px row: thumbnail+title (flex) | status pill | responses | edited.
const FormListRow = ({ form, responseCount }: FormListRowProps) => {
  const isPublished = form.status === "published";
  const relative = `${formatDistanceToNow(parseTimestampAsUTC(form.updatedAt) ?? new Date())} ago`;

  return (
    <div className="group flex h-11 items-center gap-8 rounded-lg border-b border-gray-100 px-1 transition-colors hover:bg-secondary">
      {/* Name — thumbnail + title */}
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  // Header search writes ?q= (debounced). Optional so existing navigations need not supply it.
  validateSearch: v.object({ q: v.optional(v.string()) }),
  ssr: "data-only",
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
