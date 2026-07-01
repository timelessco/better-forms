import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { CheckIcon } from "@/components/ui/icons";
import {
  FigBulletListIcon,
  FigFilterIcon,
  FigSearchAltIcon,
  FigSmallDownIcon,
  FigTilesIcon,
} from "@/components/dashboard/dashboard-icons";
import { FormCardThumbnail, FormListThumbnail } from "@/components/dashboard/form-card-thumbnail";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FORM_TEMPLATE_CATEGORY_LABEL, FORM_TEMPLATE_META } from "@/lib/form-templates";
import type { FormTemplateCategory, FormTemplateMeta } from "@/lib/form-templates";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

// Gallery omits the "blank" starter — that path stays pinned in the dashboard quick row.
const GALLERY_TEMPLATES = FORM_TEMPLATE_META.filter((t) => t.id !== "blank");

// Categories actually present in the gallery, in label order. "all" prepended in the filter.
const GALLERY_CATEGORIES = [...new Set(GALLERY_TEMPLATES.map((t) => t.category))];

const matchesSearch = (t: FormTemplateMeta, q: string) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    t.label.toLowerCase().includes(needle) ||
    t.description.toLowerCase().includes(needle) ||
    t.tags.some((tag) => tag.toLowerCase().includes(needle))
  );
};

const CategoryFilter = ({
  current,
  onChange,
}: {
  current: FormTemplateCategory | "all";
  onChange: (next: FormTemplateCategory | "all") => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="sm"
          aria-label="Filter templates by category"
          className="rounded-lg bg-secondary px-2 hover:bg-secondary/80"
        >
          <FigFilterIcon className="size-4 text-gray-800" />
          <span className="font-case text-base font-[450] tracking-[0.14px] text-gray-800">
            {current === "all" ? "All" : FORM_TEMPLATE_CATEGORY_LABEL[current]}
          </span>
          <FigSmallDownIcon className="size-4 text-gray-800" />
        </Button>
      }
    />
    <DropdownMenuContent align="end" sideOffset={4}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Category</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onChange("all")}>
          <span className="flex-1 text-left">All</span>
          {current === "all" && <CheckIcon className="size-4" />}
        </DropdownMenuItem>
        {GALLERY_CATEGORIES.map((category) => (
          <DropdownMenuItem key={category} onClick={() => onChange(category)}>
            <span className="flex-1 text-left">{FORM_TEMPLATE_CATEGORY_LABEL[category]}</span>
            {current === category && <CheckIcon className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Mirrors the dashboard's grid/list toggle (Figma — segmented control, surface-raised active pill).
const ViewToggle = ({ mode, onChange }: { mode: ViewMode; onChange: (next: ViewMode) => void }) => (
  <div className="flex h-7 items-center gap-1 rounded-lg bg-secondary p-px">
    <button
      type="button"
      aria-label="Grid view"
      aria-pressed={mode === "grid"}
      onClick={() => onChange("grid")}
      className={cn(
        "flex size-[26px] items-center justify-center rounded-[7px] transition-all",
        mode === "grid"
          ? "bg-surface shadow-[0px_0px_1.5px_0px_rgba(0,0,0,0.16),0px_2px_5px_0px_rgba(0,0,0,0.14)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <FigTilesIcon className="size-4" />
    </button>
    <button
      type="button"
      aria-label="List view"
      aria-pressed={mode === "list"}
      onClick={() => onChange("list")}
      className={cn(
        "flex size-[26px] items-center justify-center rounded-[7px] transition-all",
        mode === "list"
          ? "bg-surface shadow-[0px_0px_1.5px_0px_rgba(0,0,0,0.16),0px_2px_5px_0px_rgba(0,0,0,0.14)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <FigBulletListIcon className="size-4" />
    </button>
  </div>
);

const CategoryChip = ({ category }: { category: FormTemplateCategory }) => (
  <span className="rounded-full bg-secondary px-2 py-0.5 text-[12px] font-[450] text-gray-700">
    {FORM_TEMPLATE_CATEGORY_LABEL[category]}
  </span>
);

const TemplateCard = ({ template }: { template: FormTemplateMeta }) => (
  <Link
    to="/templates/$templateId"
    params={{ templateId: template.id }}
    preload="intent"
    className="group bg-gray-0 relative flex flex-col rounded-[12px] border border-gray-100 px-1.5 pt-1.5 pb-2 transition-[background-color,box-shadow] duration-200 outline-none hover:elevation-card focus-visible:ring-2 focus-visible:elevation-card focus-visible:ring-ring/50"
  >
    <FormCardThumbnail
      title={template.label}
      cover={template.cover}
      preview={template.thumbnail}
      previewDark={template.thumbnailDark}
    />
    <div className="mt-3 flex w-full flex-col gap-1.5 px-1">
      <p className="truncate text-base font-medium tracking-[0.28px] text-foreground">
        {template.label}
      </p>
      <p className="line-clamp-2 text-base font-[420] tracking-[0.28px] text-gray-700">
        {template.description}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <CategoryChip category={template.category} />
        <span className="truncate text-[12px] font-[420] text-gray-500">by {template.creator}</span>
      </div>
    </div>
  </Link>
);

// List row — mirrors the dashboard list layout (thumbnail + name on the left, meta columns right).
const TemplateListRow = ({ template }: { template: FormTemplateMeta }) => (
  <Link
    to="/templates/$templateId"
    params={{ templateId: template.id }}
    preload="intent"
    className="group flex h-11 items-center gap-8 rounded-lg border-b border-gray-100 px-1 transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary"
  >
    <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
      <FormListThumbnail
        title={template.label}
        cover={template.cover}
        preview={template.thumbnail}
        previewDark={template.thumbnailDark}
      />
      <span className="shrink-0 truncate text-base font-[450] tracking-[0.28px] text-gray-800">
        {template.label}
      </span>
      <span className="hidden min-w-0 truncate text-base font-[420] tracking-[0.28px] text-gray-500 sm:inline">
        {template.description}
      </span>
    </div>
    <div className="hidden w-24 shrink-0 sm:block">
      <CategoryChip category={template.category} />
    </div>
    <span className="hidden w-28 shrink-0 truncate text-base font-[420] tracking-[0.28px] text-gray-500 md:inline">
      by {template.creator}
    </span>
  </Link>
);

// Inline gallery search — matches the dashboard's search pill (gray/100, 170px, search-alt icon,
// "Search" placeholder). Writes ?q= (debounced); the gallery reads it.
const TemplatesSearch = () => {
  const navigate = useNavigate();
  const { q = "" } = Route.useSearch();
  const [input, setInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reconcile local input with the URL param when it changes externally (back/forward, clear) —
  // render-time adjustment, not an effect, so in-flight keystrokes are never dropped.
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setInput(q);
  }

  const handleChange = (value: string) => {
    setInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = value.trim() || undefined;
      if ((q || undefined) === next) return; // skip redundant navigation when the query is unchanged
      void navigate({
        to: "/templates",
        search: (prev) => ({ ...prev, q: next }),
        replace: true,
      });
    }, 200);
  };

  return (
    <div className="flex h-7 w-[170px] items-center gap-1.5 rounded-lg bg-secondary pr-2.5 pl-2">
      <FigSearchAltIcon className="size-4 shrink-0 text-muted-foreground" />
      <input
        type="search"
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search"
        aria-label="Search templates"
        className="w-full bg-transparent font-case text-base font-[450] tracking-[0.14px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
};

const TemplatesGalleryPage = () => {
  const navigate = useNavigate();
  const { category = "all", q = "" } = Route.useSearch();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const visibleTemplates = useMemo(
    () =>
      GALLERY_TEMPLATES.filter(
        (t) => (category === "all" || t.category === category) && matchesSearch(t, q),
      ),
    [category, q],
  );

  const setCategory = (next: FormTemplateCategory | "all") =>
    void navigate({
      to: "/templates",
      search: (prev) => ({ ...prev, category: next === "all" ? undefined : next }),
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-12 md:py-12 lg:px-20">
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            {/* Section title — matches the dashboard's "Recent Forms" heading (font-sans rebinds the
                wght axis so font-semibold renders 600, not the pinned 450). */}
            <h2 className="font-sans text-[15px] leading-[1.15] font-semibold tracking-[0.225px] text-gray-950">
              Templates
            </h2>
            <div className="flex items-center gap-2">
              <TemplatesSearch />
              <CategoryFilter current={category} onChange={setCategory} />
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            </div>
          </div>

          {visibleTemplates.length === 0 ? (
            <p className="py-16 text-center text-base text-gray-600">
              No templates match your search.
            </p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleTemplates.map((template) => (
                <TemplateListRow key={template.id} template={template} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export const Route = createFileRoute("/_authenticated/templates/")({
  validateSearch: v.object({
    category: v.optional(v.picklist(GALLERY_CATEGORIES as readonly FormTemplateCategory[])),
    q: v.optional(v.string()),
  }),
  component: TemplatesGalleryPage,
});
