import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as v from "valibot";
import { CheckIcon } from "@/components/ui/icons";
import {
  FigHashIcon,
  FigSearchAltIcon,
  FigSmallDownIcon,
} from "@/components/dashboard/dashboard-icons";
import { FormCardThumbnail } from "@/components/dashboard/form-card-thumbnail";
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
          className="h-7 gap-1.5 rounded-lg bg-secondary px-2 hover:bg-secondary/80"
        >
          <FigHashIcon className="size-4 text-gray-800" />
          <span className="font-case text-base font-[450] tracking-[0.14px] text-gray-800">
            {current === "all" ? "Categories" : FORM_TEMPLATE_CATEGORY_LABEL[current]}
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

// 16px creator avatar — stands in for Figma's avatar (templates carry no avatar asset). Plain grey
// initials circle.
const CreatorAvatar = ({ name }: { name: string }) => (
  <span
    aria-hidden
    className="flex size-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-[450] text-gray-600"
  >
    {name.trim().charAt(0).toUpperCase() || "?"}
  </span>
);

// Figma node 27170:32333 — grid card: 6px-inset thumbnail, then title + two icon-led meta rows
// (# category, avatar creator). Meta text = Regular/420, gray/700, 0.28px; title = Medium/450, gray/900.
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
    <div className="mt-3 flex w-full flex-col gap-2 px-1">
      {/* font-sans binds the wght axis to font-[N]; without it the inherited fvs wght 450 wins. */}
      <p className="truncate font-sans text-base leading-[1.15] font-[450] tracking-[0.28px] text-foreground">
        {template.label}
      </p>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 py-[5px]">
          <FigHashIcon className="size-4 shrink-0 text-gray-700" />
          <span className="truncate font-sans text-base leading-[1.15] font-[420] tracking-[0.28px] text-gray-700">
            {FORM_TEMPLATE_CATEGORY_LABEL[template.category]}
          </span>
        </div>
        <div className="flex items-center gap-2 py-[5px]">
          <CreatorAvatar name={template.creator} />
          <span className="truncate font-sans text-base leading-[1.15] font-[420] tracking-[0.28px] text-gray-700">
            {template.creator}
          </span>
        </div>
      </div>
    </div>
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
            {/* Section title — font-sans rebinds the wght axis so font-semibold renders 600, not the
                pinned 450 (Figma: SemiBold, 15px, gray/950, 0.225px). */}
            <h2 className="font-sans text-[15px] leading-[1.15] font-semibold tracking-[0.225px] text-gray-950">
              All Templates
            </h2>
            <div className="flex items-center gap-2">
              <TemplatesSearch />
              <CategoryFilter current={category} onChange={setCategory} />
            </div>
          </div>

          {visibleTemplates.length === 0 ? (
            <p className="py-16 text-center text-base text-gray-600">
              No templates match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
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
