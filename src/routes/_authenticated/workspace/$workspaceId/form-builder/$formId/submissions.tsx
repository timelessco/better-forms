import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Checkbox } from "@/components/ui/checkbox";
import { DataGridColumnHeader } from "@/components/ui/data-grid-column-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EDITABLE_FIELD_TYPES } from "@/lib/editor/transform-plate-for-preview";
import { formatBytes } from "@/hooks/use-file-upload";
import {
  deleteSubmission,
  deleteSubmissionsBulk,
  getSubmissionsBootstrap,
  getSubmissionsByFormIdPaginated,
} from "@/lib/server-fn/submissions";
import type { SerializedSubmission, SubmissionCursor } from "@/lib/server-fn/submissions";
import {
  getEditableFields,
  transformPlateStateToFormElements,
} from "@/lib/editor/transform-plate-to-form";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef, Row, RowSelectionState } from "@tanstack/table-core";
import { useTanStackTableDevtools } from "@tanstack/react-table-devtools";
import { createAppColumnHelper, SelectionCheckbox, useAppTable } from "@/components/ui/data-grid";
import type { DataGridApi, DataGridFeatures } from "@/components/ui/data-grid";

import {
  CardsViewIcon,
  CheckIcon,
  FilterIcon,
  ListViewIcon,
  StarEmptyIcon,
  StarFilledIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/icons";
import {
  FigFilterIcon,
  FigSearchAltIcon,
  FigSmallDownIcon,
} from "@/components/dashboard/dashboard-icons";
import { FormPreviewFromPlate } from "@/components/form-components/form-preview-from-plate";
import type { PublicFormSettings } from "@/types/form-settings";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Paperclip,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Value } from "platejs";
import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys";
import { HOTKEYS, formatForDisplay } from "@/lib/hotkeys";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FieldStatus = "current" | "deleted";
const EMPTY_LABELS: Record<string, string> = {};
// Built-in column ids — payload keys colliding would construct duplicate columns silently.
const RESERVED_COLUMN_IDS = new Set([
  "select",
  "submitted_at",
  "status",
  "last_step_reached",
  "is_completed",
]);

// Header labels: gray-600 (Figma) for normal fields; deleted/orphaned fields go red so removed
// fields read clearly (replaces the old green/red status dots).
const HEADER_LABEL_CLS = "text-muted-foreground tracking-[0.02em]";
const HEADER_LABEL_DELETED_CLS = "text-destructive tracking-[0.02em]";

const SUBMITTED_AT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

const formatDateCellValue = (text: string): string => {
  try {
    return new Date(text).toLocaleDateString();
  } catch {
    return text;
  }
};

const formatSubmittedAt = (value: string | Date): string =>
  SUBMITTED_AT_FORMATTER.format(new Date(value));

// Single-view header date (Figma 27015:20854) — "Jun 2, 2026".
const SUBMISSION_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
type PaginatedSubmissionsPage = {
  submissions: SerializedSubmission[];
  nextCursor?: SubmissionCursor;
};

import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";

const getPaginatedSubmissionsPage = (
  formId: string,
  cursor?: SubmissionCursor,
): Promise<PaginatedSubmissionsPage> =>
  getSubmissionsByFormIdPaginated({
    data: { formId, cursor },
  }) as Promise<PaginatedSubmissionsPage>;

const formatSubmissionValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "{object}";
  }
};

type UploadedFileValue = {
  url: string;
  name: string;
  size: number;
  type: string;
};

const isUploadedFileValue = (value: unknown): value is UploadedFileValue =>
  !!value &&
  typeof value === "object" &&
  "url" in value &&
  typeof (value as { url: unknown }).url === "string";

const FileTypeIcon = ({ type, className }: { type: string; className?: string }) => {
  if (type === "application/pdf") {
    return <FileText className={cn("text-red-500", className)} />;
  }
  if (
    type === "application/msword" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <FileText className={cn("text-blue-500", className)} />;
  }
  return <Paperclip className={cn("text-muted-foreground", className)} />;
};

const csvFormat = (value: unknown): string => {
  if (isUploadedFileValue(value)) return value.url;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((v) => csvFormat(v))
      .filter((s) => s !== "")
      .join("; ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
};

// Field types eligible for the Repeatable toggle — used to gate the
// scalar-array chip renderer so we don't disturb MultiSelect's colored chips.
const SCALAR_CELL_TYPES = new Set([
  "Input",
  "Textarea",
  "Email",
  "Phone",
  "Number",
  "Link",
  "Date",
  "Time",
]);

type FieldOption = { value: string; label: string };

const SubmissionCell = ({
  value,
  fieldType,
  onPreview,
  options,
}: {
  value: unknown;
  fieldType: string;
  onPreview?: (file: UploadedFileValue) => void;
  options?: FieldOption[];
}) => {
  const labelFor = (raw: unknown): string => {
    const s = String(raw);
    if (!options) return s;
    const match = options.find((o) => o.value === s);
    return match?.label ?? s;
  };
  const text = formatSubmissionValue(value);
  if (text === "-") {
    return <span className="text-[14px] text-muted-foreground">-</span>;
  }

  // Repeatable scalar fields land here as arrays — flatten to comma-separated text
  // (Figma) before the per-type renderers below (a single mailto: for two emails or
  // an "Invalid Date" for an array of dates would otherwise be wrong).
  if (Array.isArray(value) && SCALAR_CELL_TYPES.has(fieldType)) {
    const arr = value.filter((v) => v !== "" && v != null);
    if (arr.length === 0) return <span className="text-[14px] text-muted-foreground">-</span>;
    const joined = arr
      .map((item) => (fieldType === "Date" ? formatDateCellValue(String(item)) : labelFor(item)))
      .join(", ");
    return <span className="block max-w-[300px] truncate text-[14px]">{joined}</span>;
  }

  switch (fieldType) {
    // Email/Link stay clickable (mailto / new-tab) but inherit the same cell color as every other
    // type — Figma renders all answer values in one uniform color (no link tint). Underline on hover
    // is the only affordance.
    case "Email":
      return (
        <a
          href={`mailto:${text}`}
          className="block max-w-[300px] truncate text-[14px] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </a>
      );
    case "Link":
      return (
        <a
          href={text.startsWith("http") ? text : `https://${text}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block max-w-[300px] truncate text-[14px] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </a>
      );
    case "Date":
      return (
        <span className="block max-w-[300px] truncate text-[14px]">
          {formatDateCellValue(text)}
        </span>
      );
    case "Time":
    case "Phone":
    case "Number":
      return <span className="block max-w-[300px] truncate text-[14px]">{text}</span>;
    case "Rating": {
      // Figma 26566:46117 — 5 × 20px stars, gap 1px; filled (gold) up to the value, rest empty outline.
      const rating = Math.max(0, Math.min(5, Math.round(Number(text) || 0)));
      if (!rating) return <span className="text-[14px] text-muted-foreground">-</span>;
      return (
        <div className="flex items-center gap-px" aria-label={`${rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) =>
            i < rating ? (
              <StarFilledIcon key={i} className="size-5 shrink-0" />
            ) : (
              <StarEmptyIcon key={i} className="size-5 shrink-0" />
            ),
          )}
        </div>
      );
    }
    case "Signature":
      return typeof value === "string" && value.startsWith("data:image") ? (
        <img
          src={value}
          alt="Signature"
          className="h-8 max-w-[160px] rounded border border-border bg-white object-contain"
        />
      ) : (
        <span className="text-[14px] text-muted-foreground">-</span>
      );
    case "Checkbox":
    case "MultiChoice":
    case "Ranking":
    default: {
      // Multi-value answers render as comma-separated text (Figma), not pill chips.
      const items = Array.isArray(value) ? value : null;
      const display = items ? items.map((item) => labelFor(item)).join(", ") : labelFor(value);
      return <span className="block max-w-[300px] truncate text-[14px]">{display}</span>;
    }
    case "FileUpload": {
      // Legacy: bare string filename from old submissions
      if (typeof value === "string") {
        return (
          <span className="block max-w-[180px] truncate text-[14px] text-muted-foreground italic">
            {value}
          </span>
        );
      }
      if (!isUploadedFileValue(value)) {
        return <span className="text-[14px] text-muted-foreground">-</span>;
      }
      const file = value;
      const isImage = file.type.startsWith("image/");
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.(file);
          }}
          title={`${file.name} • ${formatBytes(file.size)}`}
          className="group flex w-full max-w-[180px] cursor-pointer items-center justify-center gap-2"
        >
          {isImage ? (
            <Image
              src={file.url}
              alt=""
              width={64}
              height={32}
              layout="fixed"
              loading="lazy"
              className="h-8 w-auto max-w-[64px] shrink-0 rounded border border-border/40 object-contain"
            />
          ) : (
            // Figma 26566:46132 document glyph (exact asset).
            <img src="/icons/file-doc.svg" alt="" className="h-5 w-auto shrink-0" />
          )}
          {!isImage && (
            <span className="truncate text-[14px] text-gray-700 group-hover:text-foreground">
              {file.name}
            </span>
          )}
        </button>
      );
    }
  }
};

const toSubmissionColumn = <TValue,>(
  column: ColumnDef<DataGridFeatures, SerializedSubmission, TValue>,
): ColumnDef<DataGridFeatures, SerializedSubmission> =>
  column as ColumnDef<DataGridFeatures, SerializedSubmission>;

interface BuildSubmissionColumnsOptions {
  formElements: ReturnType<typeof transformPlateStateToFormElements> | null;
  orphanedFieldNames: Set<string>;
  fieldStatusFilter: Set<FieldStatus>;
  historicalLabels: Record<string, string>;
  onDelete: (submissionId: string) => Promise<void> | void;
  onPreview: (file: UploadedFileValue) => void;
}

const buildSubmissionColumns = ({
  formElements,
  orphanedFieldNames,
  fieldStatusFilter,
  historicalLabels,
  onDelete,
  onPreview,
}: BuildSubmissionColumnsOptions) => {
  const columnHelper = createAppColumnHelper<SerializedSubmission>();
  const counts: Record<FieldStatus, number> = { current: 0, deleted: 0 };

  const baseColumns: ColumnDef<DataGridFeatures, SerializedSubmission>[] = [
    columnHelper.display({
      id: "select",
      // all-rows APIs walk the filtered model — correct for infinite scroll, respects tab/search filters
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
          onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <SelectionCheckbox
          row={row}
          ariaLabel={`Select submission from ${formatSubmittedAt(row.original.createdAt)}`}
        />
      ),
      size: 48,
      minSize: 48,
      maxSize: 48,
      enableSorting: false,
      enableHiding: false,
      enablePinning: false,
      enableResizing: false,
    }),
    toSubmissionColumn(
      columnHelper.accessor("createdAt", {
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Submitted at" className={HEADER_LABEL_CLS} />
        ),
        cell: (info) => (
          <div className="group/row flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-[14px]">
                {formatSubmittedAt(info.getValue())}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/row:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete submission"
                onClick={(e) => {
                  e.stopPropagation();
                  void onDelete(info.row.original.id);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        ),
        id: "submitted_at",
        // ISO strings compare correctly under datetime sortFn
        sortFn: "datetime",
        sortDescFirst: true,
        size: 200,
        minSize: 140,
        meta: { headerTitle: "Submitted at" },
      }),
    ),
    toSubmissionColumn(
      // Status pill (Figma 26566:46099) — Complete green / Partial yellow.
      columnHelper.accessor((row) => row.isCompleted, {
        id: "status",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" className={HEADER_LABEL_CLS} />
        ),
        cell: (info) => {
          const done = info.getValue();
          return (
            <span
              className={cn(
                // Figma 27015:17561/17488 (light) + 27015:17706/17633 (dark): 12px / Medium(450) /
                // 0.24px (0.02em) / lh1.15, 6×3 pad, pill. Figma keeps the SAME pill colors in both
                // themes (no flip) — soft pastel bg + saturated text reads fine on dark too, so the
                // hexes are pinned (NOT the auto-flipping success tokens).
                "inline-flex items-center rounded-full px-1.5 py-[3px] text-[12px] leading-[1.15] font-[450] tracking-[0.02em]",
                done ? "bg-[#e4faeb] text-[#137949]" : "bg-[#fff7d3] text-[#b35309]",
              )}
            >
              {done ? "Complete" : "Partial"}
            </span>
          );
        },
        enableSorting: false,
        size: 96,
        minSize: 84,
        meta: { headerTitle: "Status" },
      }),
    ),
    toSubmissionColumn(
      // null coerced to undefined — sortUndefined only checks === undefined (createSortedRowModel)
      columnHelper.accessor((row) => row.lastStepReached ?? undefined, {
        id: "last_step_reached",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Last step" className={HEADER_LABEL_CLS} />
        ),
        cell: (info) => {
          const step = info.getValue();
          if (step === undefined) return <span className="text-muted-foreground">-</span>;
          return <span className="text-[14px]">Step {step + 1}</span>;
        },
        sortUndefined: "last",
        size: 120,
        meta: { headerTitle: "Last step" },
      }),
    ),
    toSubmissionColumn(
      // hidden filter target for tabs; enableHiding:false keeps it out of the visibility dropdown
      // while initialState columnVisibility still hides it (getIsVisible reads state, canHide only gates toggling)
      columnHelper.accessor((row) => row.isCompleted, {
        id: "is_completed",
        enableHiding: false,
        enableSorting: false,
      }),
    ),
  ];

  if (formElements) {
    const editableFields = getEditableFields(formElements);
    const inputFields = editableFields.filter((field) => EDITABLE_FIELD_TYPES.has(field.fieldType));

    for (const field of inputFields) {
      const status: FieldStatus = "current";
      counts.current++;

      if (fieldStatusFilter.has(status)) {
        baseColumns.push(
          toSubmissionColumn(
            // null → undefined so sortUndefined applies (sorter only special-cases === undefined)
            columnHelper.accessor((row) => row.data?.[field.name] ?? undefined, {
              id: field.name,
              header: ({ column }) => (
                <DataGridColumnHeader
                  column={column}
                  title={("label" in field ? field.label : "") || field.name}
                  className={HEADER_LABEL_CLS}
                  searchable
                />
              ),
              cell: (info) => (
                <SubmissionCell
                  value={info.getValue()}
                  fieldType={field.fieldType}
                  onPreview={onPreview}
                  options={"options" in field ? (field.options as FieldOption[]) : undefined}
                />
              ),
              // Per-column header search — substring match against the rendered cell text.
              enableColumnFilter: true,
              filterFn: (row, columnId, value) =>
                formatSubmissionValue(row.getValue(columnId))
                  .toLowerCase()
                  .includes(String(value).toLowerCase()),
              // sparse column — empties last (numeric default 1 flips with desc putting empties first)
              sortUndefined: "last",
              // object values produce inconsistent comparators
              enableSorting: field.fieldType !== "FileUpload" && field.fieldType !== "Signature",
              size: 150,
              meta: {
                headerTitle: ("label" in field ? field.label : "") || field.name,
              },
            }),
          ),
        );
      }
    }
  }

  counts.deleted = orphanedFieldNames.size;
  orphanedFieldNames.forEach((fieldName) => {
    const status: FieldStatus = "deleted";
    const resolvedLabel = historicalLabels[fieldName] ?? fieldName;

    if (fieldStatusFilter.has(status)) {
      baseColumns.push(
        toSubmissionColumn(
          columnHelper.accessor((row) => row.data?.[fieldName], {
            id: fieldName,
            header: ({ column }) => (
              <DataGridColumnHeader
                column={column}
                title={resolvedLabel}
                className={HEADER_LABEL_DELETED_CLS}
              />
            ),
            cell: (info) => (
              <SubmissionCell
                value={info.getValue()}
                fieldType="FileUpload"
                onPreview={onPreview}
              />
            ),
            // deleted-field data has unknown shapes — object values produce inconsistent comparators
            sortUndefined: "last",
            enableSorting: false,
            size: 150,
            meta: {
              headerTitle: resolvedLabel,
            },
          }),
        ),
      );
    }
  });

  return { columns: baseColumns, fieldCounts: counts };
};

// Shared query defs — loader + component can't drift on key/queryFn/options.
const submissionsBootstrapQueryOptions = (formId: string) =>
  queryOptions({
    queryKey: ["submissionsBootstrap", formId],
    queryFn: () => getSubmissionsBootstrap({ data: { formId } }),
    staleTime: 1000 * 60 * 10,
  });

const submissionsInfiniteQueryOptions = (formId: string) =>
  infiniteQueryOptions({
    queryKey: ["submissions", formId],
    queryFn: ({ pageParam }: { pageParam: SubmissionCursor | undefined }) =>
      getPaginatedSubmissionsPage(formId, pageParam),
    initialPageParam: undefined as SubmissionCursor | undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    // Inbox — fresh on refocus. Explicit 0 overrides global 60s default that would suppress refetchOnWindowFocus in the first minute.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

const SubmissionsPage = () => {
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();
  Route.useLoaderData(); // ensure loader has primed the query cache
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "partial">("all");
  // sorting/visibility/pinning/order live table-internal; only shared slices stay controlled
  const [globalFilter, setGlobalFilter] = useState("");
  const [fieldStatusFilter] = useState<Set<FieldStatus>>(new Set(["current", "deleted"]));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [previewFile, setPreviewFile] = useState<UploadedFileValue | null>(null);
  const openPreview = useCallback((file: UploadedFileValue) => setPreviewFile(file), []);
  const closePreview = useCallback(() => setPreviewFile(null), []);
  const handleGlobalFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value),
    [],
  );
  const handleClearSelection = useCallback(() => setRowSelection({}), []);

  // Bootstrap (published content + count + historical labels): blocking suspense data. Loader awaits ensureQueryData → cache primed, pendingComponent covers first load. 10min staleTime → rarely refetches, low error-boundary risk.
  const { data: bootstrapData } = useSuspenseQuery(submissionsBootstrapQueryOptions(formId));
  const publishedContent = bootstrapData?.form?.content;
  const totalCount = bootstrapData?.totalCount ?? 0;
  const historicalLabels = bootstrapData?.fieldLabels ?? EMPTY_LABELS;

  // List NOT suspense: useInfiniteQuery keeps loaded rows on a failed background refetch instead of throwing route to error boundary.
  const {
    data: submissionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingSubmissions,
  } = useInfiniteQuery(submissionsInfiniteQueryOptions(formId));

  const allSubmissions: SerializedSubmission[] = useMemo(
    () => submissionsData?.pages?.flatMap((page) => page?.submissions ?? []) ?? [],
    [submissionsData],
  );

  // Intersect with loaded ids — stale keys from refetch/delete never drive bulk actions/hotkeys.
  const effectiveRowSelection = useMemo(() => {
    const loadedIds = new Set(allSubmissions.map((s) => s.id));
    const next: RowSelectionState = {};
    for (const id of Object.keys(rowSelection)) {
      if (loadedIds.has(id)) next[id] = true;
    }
    return next;
  }, [allSubmissions, rowSelection]);

  const handleDelete = useCallback(
    async (submissionId: string) => {
      await deleteSubmission({ data: { id: submissionId, formId } });
      // drop deleted id from selection so a stale key can't act
      setRowSelection((prev) => {
        if (!prev[submissionId]) return prev;
        const { [submissionId]: _removed, ...rest } = prev;
        return rest;
      });
      void queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    [formId, queryClient],
  );

  const formElements = useMemo(() => {
    if (!publishedContent) return null;
    return transformPlateStateToFormElements(publishedContent as Value);
  }, [publishedContent]);

  // Stable orphaned field names — keyed on a sorted join so identity only changes when the SET's
  // contents change, not on every submissions ref change (avoids needless column rebuilds).
  const orphanedKey = useMemo(() => {
    const currentFieldNames = new Set<string>();
    if (formElements) {
      const editableFields = getEditableFields(formElements);
      for (const field of editableFields) {
        if (EDITABLE_FIELD_TYPES.has(field.fieldType)) {
          currentFieldNames.add(field.name);
        }
      }
    }

    const orphaned = new Set<string>();
    allSubmissions.forEach((submission) => {
      if (submission.data && typeof submission.data === "object") {
        Object.keys(submission.data).forEach((key) => {
          // payload key colliding w/ built-in column id would construct a duplicate id silently
          if (!currentFieldNames.has(key) && !RESERVED_COLUMN_IDS.has(key)) {
            orphaned.add(key);
          }
        });
      }
    });

    return [...orphaned].toSorted().join(",");
  }, [allSubmissions, formElements]);

  // New Set only when the sorted key changes → stable identity for the columns memo below.
  const orphanedFieldNames = useMemo(
    () => new Set(orphanedKey ? orphanedKey.split(",") : []),
    [orphanedKey],
  );

  // Derive Columns from PUBLISHED Form Content (not draft)
  const { columns } = useMemo(
    () =>
      buildSubmissionColumns({
        formElements,
        orphanedFieldNames,
        fieldStatusFilter,
        historicalLabels,
        onDelete: handleDelete,
        onPreview: openPreview,
      }),
    [
      formElements,
      orphanedFieldNames,
      fieldStatusFilter,
      handleDelete,
      openPreview,
      historicalLabels,
    ],
  );

  const table = useAppTable({
    key: "submissions",
    data: allSubmissions,
    columns,
    state: {
      globalFilter,
      rowSelection: effectiveRowSelection,
    },
    initialState: {
      columnVisibility: { last_step_reached: false, is_completed: false },
    },
    enableRowSelection: true,
    enableColumnPinning: false,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    // infinite scroll — server pages, table must not slice rows
    manualPagination: true,
    rowCount: totalCount,
    getColumnCanGlobalFilter: (column) =>
      !["submitted_at", "last_step_reached", "is_completed"].includes(column.id),
    globalFilterFn: (row, columnId, value) => {
      const raw = row.getValue(columnId);
      // empty cells render "-"; without this, hyphen searches match every blank cell
      if (raw == null || raw === "") return false;
      return formatSubmissionValue(raw).toLowerCase().includes(String(value).toLowerCase());
    },
    columnResizeMode: "onChange",
    getRowId: (row) => row.id,
  });

  // tab = column filter on hidden is_completed; needs `table`, so defined after useAppTable
  const setTab = useCallback(
    (tab: "all" | "completed" | "partial") => {
      // re-clicking the active tab must not wipe an in-progress selection
      if (tab === activeTab) return;
      setActiveTab(tab);
      table.setColumnFilters(
        tab === "all" ? [] : [{ id: "is_completed", value: tab === "completed" }],
      );
      setRowSelection({});
    },
    [table, activeTab],
  );
  const handleSetActiveTabAll = useCallback(() => setTab("all"), [setTab]);
  const handleSetActiveTabCompleted = useCallback(() => setTab("completed"), [setTab]);
  const handleSetActiveTabPartial = useCallback(() => setTab("partial"), [setTab]);

  // Registers the table with TanStack Devtools; no-op when no devtools listening.
  useTanStackTableDevtools(table);

  const { handleBulkDelete, handleExportSelected, handleExport } = useSubmissionExportAndDelete({
    formId,
    queryClient,
    table,
    setRowSelection,
  });

  useSubmissionsHotkeys({
    table,
    rowSelection: effectiveRowSelection,
    setRowSelection,
    onExport: handleExportSelected,
    onBulkDelete: handleBulkDelete,
  });

  // Figma 26595-31672: list = the data-grid table; single = one submission rendered read-only.
  const [view, setView] = useState<"table" | "single">("table");

  // Single-view cursor lifted to the page so the toolbar renders prev/next + "X of N" (Figma
  // 27015:20773); the per-submission nav no longer lives inside the record card.
  const singleRows = table.getRowModel().rows;
  const [singleIndex, setSingleIndex] = useState(0);
  const safeSingleIndex = Math.min(singleIndex, Math.max(0, singleRows.length - 1));
  // Slide between submissions via the View Transitions API: it snapshots the record and animates
  // on the compositor, so the swap stays smooth even though the heavy form fully remounts. dir
  // drives the slide direction in CSS (styles.css [data-bf-subnav]); falls back to instant.
  const runSubmissionNav = (dir: "prev" | "next", apply: () => void) => {
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (typeof doc.startViewTransition !== "function") {
      apply();
      return;
    }
    doc.documentElement.dataset.bfSubnav = dir;
    const transition = doc.startViewTransition(() => flushSync(apply));
    void transition.finished.finally(() => {
      delete doc.documentElement.dataset.bfSubnav;
    });
  };
  const goPrevSubmission = () =>
    runSubmissionNav("prev", () => setSingleIndex(Math.max(0, safeSingleIndex - 1)));
  const goNextSubmission = () => {
    if (hasNextPage && safeSingleIndex >= singleRows.length - 2) void fetchNextPage();
    runSubmissionNav("next", () =>
      setSingleIndex(Math.min(safeSingleIndex + 1, singleRows.length)),
    );
  };

  return (
    <table.AppTable>
      <div className="flex h-full min-h-0 min-w-0 flex-col bg-background pl-5">
        <SubmissionsToolbar
          activeTab={activeTab}
          globalFilter={globalFilter}
          view={view}
          onViewChange={setView}
          onSetTabAll={handleSetActiveTabAll}
          onSetTabCompleted={handleSetActiveTabCompleted}
          onSetTabPartial={handleSetActiveTabPartial}
          onGlobalFilterChange={handleGlobalFilterChange}
          onExport={handleExport}
          totalCount={totalCount}
          singleCurrent={Math.min(safeSingleIndex + 1, totalCount)}
          onPrevSubmission={goPrevSubmission}
          onNextSubmission={goNextSubmission}
          canPrevSubmission={safeSingleIndex > 0}
          canNextSubmission={safeSingleIndex < singleRows.length - 1 || hasNextPage}
        />

        <SubmissionPreviewDialog file={previewFile} onClose={closePreview} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AnimatePresence>
            {Object.keys(effectiveRowSelection).length > 0 && (
              <SubmissionBulkActionBar
                count={Object.keys(effectiveRowSelection).length}
                onExport={handleExportSelected}
                onDelete={handleBulkDelete}
                onClear={handleClearSelection}
              />
            )}
          </AnimatePresence>

          {view === "single" ? (
            <SubmissionSingleView
              rows={singleRows}
              index={safeSingleIndex}
              form={bootstrapData?.form ?? null}
              formId={formId}
            />
          ) : (
            <table.DataGrid
              recordCount={totalCount}
              className=""
              isLoading={isLoadingSubmissions}
              tableLayout={{
                dense: true,
                columnsResizable: true,
                columnsPinnable: false,
                columnsVisibility: true,
                columnsMovable: true,
                headerSticky: true,
                headerBackground: false,
                headerBorder: true,
                rowBorder: true,
              }}
              // Figma 26566:45584 scoped typography: header labels gray-500/0.02em (descendant
              // selector out-specificities the shared header color), body cells gray-700.
              tableClassNames={{
                // Header divider = gray-100 (Figma 26566:46076 border-b gray/100); resize handle
                // line hidden so there are no column dividers. Label colors are set per-header.
                headerRow: "[&>th]:border-[var(--color-gray-100)]",
                header: "[&_.cursor-col-resize]:before:bg-transparent",
                // Row = exactly 44px (Figma): the height-adding border-b is removed and the divider
                // is drawn as a zero-height inset shadow in gray-100 (matches Figma's border-b
                // gray/100, 1px). Body text gray-700.
                bodyRow:
                  "[&>td]:text-gray-700 [&:not(:last-child)>td]:border-b-0! [&:not(:last-child)>td]:shadow-[inset_0_-1px_0_var(--color-gray-100)]",
              }}
              emptyMessage={
                <div className="flex flex-col items-center justify-center gap-y-3 py-16 opacity-50">
                  <div className="rounded-full bg-muted p-3">
                    <FilterIcon className="size-6" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p>No results found</p>
                    <p className="text-xs text-muted-foreground">
                      {globalFilter
                        ? "Try adjusting your search query."
                        : "When people fill out your form, their responses will appear here."}
                    </p>
                  </div>
                </div>
              }
            >
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <table.DataGridContainer
                  border={false}
                  className="min-h-0 flex-1 content-start overflow-x-auto overflow-y-hidden border-b border-border pr-6"
                >
                  <table.DataGridVirtualTable
                    onFetchMore={fetchNextPage}
                    hasMore={hasNextPage}
                    isFetchingMore={isFetchingNextPage}
                    fetchMoreOffset={5}
                  />
                </table.DataGridContainer>
              </div>
            </table.DataGrid>
          )}
        </div>
      </div>
    </table.AppTable>
  );
};

interface UseSubmissionExportAndDeleteOptions {
  formId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  table: DataGridApi<SerializedSubmission>;
  setRowSelection: (selection: RowSelectionState) => void;
}

const useSubmissionExportAndDelete = ({
  formId,
  queryClient,
  table,
  setRowSelection,
}: UseSubmissionExportAndDeleteOptions) => {
  const handleBulkDelete = useCallback(async () => {
    // selected row model — same source export reads, never stale selection keys
    const selectedIds = table.getSelectedRowModel().rows.map((r) => r.id);
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.length} submission${selectedIds.length > 1 ? "s" : ""}?`,
    );
    if (!confirmed) return;

    await deleteSubmissionsBulk({
      data: { formId, submissionIds: selectedIds },
    });
    void queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    setRowSelection({});
  }, [formId, queryClient, table, setRowSelection]);

  // Headers + string cells from the same visible-column source — no header/cell drift.
  const getExportData = useCallback(
    (rows: Row<DataGridFeatures, SerializedSubmission>[]) => {
      const exportColumns = table.getVisibleLeafColumns().filter((c) => c.id !== "select");
      const headers = exportColumns.map(
        (c) =>
          c.columnDef.meta?.headerTitle ??
          (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id),
      );
      const data = rows.map((row) => exportColumns.map((c) => csvFormat(row.getValue(c.id))));
      return { headers, data };
    },
    [table],
  );

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadCSV = useCallback(
    (rows: Row<DataGridFeatures, SerializedSubmission>[], filename: string) => {
      if (rows.length === 0) return;
      const { headers, data } = getExportData(rows);
      const escapeCSV = (s: string) => `"${s.replaceAll('"', '""')}"`;
      const csv = [headers, ...data].map((r) => r.map(escapeCSV).join(",")).join("\n");
      triggerDownload(new Blob([csv], { type: "text/csv" }), filename);
    },
    [getExportData],
  );

  // Excel: HTML table with the .xls/ms-excel mime — opens natively, no dependency.
  const downloadExcel = useCallback(
    (rows: Row<DataGridFeatures, SerializedSubmission>[], filename: string) => {
      if (rows.length === 0) return;
      const { headers, data } = getExportData(rows);
      const esc = (s: string) =>
        s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
      const tbody = data
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("");
      const html = `﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1">${thead}${tbody}</table></body></html>`;
      triggerDownload(new Blob([html], { type: "application/vnd.ms-excel" }), filename);
    },
    [getExportData],
  );

  // PDF: print window with a styled table — the browser's "Save as PDF" handles the file.
  // Built via DOM + textContent (no document.write / innerHTML) so cell values are inert.
  const printPDF = useCallback(
    (rows: Row<DataGridFeatures, SerializedSubmission>[]) => {
      if (rows.length === 0) return;
      const { headers, data } = getExportData(rows);
      const win = window.open("", "_blank");
      if (!win) return;
      const doc = win.document;
      doc.title = "Submissions";
      const style = doc.createElement("style");
      style.textContent =
        "body{font-family:system-ui,sans-serif;padding:24px;color:#141414}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #e0e0e0;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-weight:600}";
      doc.head.appendChild(style);
      const table = doc.createElement("table");
      const addRow = (cells: string[], tag: "th" | "td") => {
        const tr = doc.createElement("tr");
        for (const cell of cells) {
          const el = doc.createElement(tag);
          el.textContent = cell;
          tr.appendChild(el);
        }
        table.appendChild(tr);
      };
      addRow(headers, "th");
      for (const row of data) addRow(row, "td");
      doc.body.appendChild(table);
      win.focus();
      win.print();
    },
    [getExportData],
  );

  const handleExportSelected = useCallback(() => {
    downloadCSV(table.getSelectedRowModel().rows, `submissions-selected-${formId}.csv`);
  }, [downloadCSV, formId, table]);

  const handleExport = useCallback(
    (format: "csv" | "pdf" | "excel") => {
      const rows = table.getRowModel().rows;
      if (format === "excel") downloadExcel(rows, `submissions-${formId}.xls`);
      else if (format === "pdf") printPDF(rows);
      else downloadCSV(rows, `submissions-${formId}.csv`);
    },
    [downloadCSV, downloadExcel, printPDF, formId, table],
  );

  return { handleBulkDelete, handleExportSelected, handleExport };
};

interface UseSubmissionsHotkeysOptions {
  table: DataGridApi<SerializedSubmission>;
  rowSelection: RowSelectionState;
  setRowSelection: (selection: RowSelectionState) => void;
  onExport: () => void;
  onBulkDelete: () => void;
}

const useSubmissionsHotkeys = ({
  table,
  rowSelection,
  setRowSelection,
  onExport,
  onBulkDelete,
}: UseSubmissionsHotkeysOptions) => {
  const hasSelection = Object.keys(rowSelection).length > 0;

  useHotkey(
    HOTKEYS.SUBMISSIONS_SELECT_ALL,
    () => {
      // all-rows APIs walk the filtered model — correct for infinite scroll + tab/search filters
      table.toggleAllRowsSelected(!table.getIsAllRowsSelected());
    },
    { conflictBehavior: "replace", ignoreInputs: true },
  );

  useHotkey(HOTKEYS.SUBMISSIONS_EXPORT, () => onExport(), {
    enabled: hasSelection,
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  useHotkeys(
    [
      { hotkey: HOTKEYS.SUBMISSIONS_DELETE, callback: () => onBulkDelete() },
      { hotkey: "Delete", callback: () => onBulkDelete() },
    ],
    { enabled: hasSelection, ignoreInputs: true },
  );

  useHotkey(HOTKEYS.SUBMISSIONS_CLEAR_SELECTION, () => setRowSelection({}), {
    enabled: hasSelection,
    ignoreInputs: true,
  });
};

// Individual-submission view (Figma 27015:20852): borderless record — a date + status-badge
// header rule over the form rendered read-only with this submission's answers. Per-submission
// nav lives in the toolbar now. The form subtree is `inert` so every field is non-interactive.
const SubmissionSingleView = ({
  rows,
  index,
  form,
  formId,
}: {
  rows: Row<DataGridFeatures, SerializedSubmission>[];
  index: number;
  form: {
    content: unknown;
    title: string;
    icon: string | null;
    cover: string | null;
    settings: unknown;
    customization: Record<string, string>;
  } | null;
  formId: string;
}) => {
  const safeIndex = Math.min(index, Math.max(0, rows.length - 1));
  const submission = rows[safeIndex]?.original;

  // Single-submission view shows only the answered fields (Figma 27015:20852) — strip the
  // formHeader node (cover/icon/title) so the record opens straight on the first field.
  const bodyContent = useMemo(
    () => ((form?.content as Value | undefined) ?? []).filter((node) => node.type !== "formHeader"),
    [form],
  );

  if (!form || !submission) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No submission to display
      </div>
    );
  }

  const done = submission.isCompleted;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* The record (header + form) carries a view-transition-name so prev/next slides it as a GPU
          snapshot — smooth across the heavy form remount (the page wraps the index change in a
          document view transition; see goPrev/goNextSubmission). */}
      <div className="flex flex-col" style={{ viewTransitionName: "bf-submission-record" }}>
        {/* Header (Figma 27015:20853): submission date + status badge, bottom rule. Same container
            (mx-auto, --bf-page-width) as the form body below so the date aligns with the fields. */}
        <div
          className="mx-auto w-full px-8 pt-1 md:px-0"
          style={{ maxWidth: "var(--bf-page-width, 700px)" }}
        >
          <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
            <span className="min-w-0 flex-1 truncate text-[14px] tracking-[0.28px] text-gray-700">
              {SUBMISSION_DATE_FORMATTER.format(new Date(submission.createdAt))}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-[3px] text-[12px] font-medium tracking-[0.02em]",
                // Figma 27015:20855 — Completed green-soft pair; Partial amber pair (#fff7d3/#b35309).
                done
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success-on-soft)]"
                  : "bg-[#fff7d3] text-[#b35309] dark:bg-amber-950/40 dark:text-amber-400",
              )}
            >
              {done ? "Completed" : "Partial"}
            </span>
          </div>
        </div>

        {/* Body — read-only preview populated with this submission's values. */}
        {/* `inert` (React 19) makes the whole form non-interactive — read-only submission view. */}
        <div inert>
          <FormPreviewFromPlate
            key={submission.id}
            content={bodyContent}
            // Force card presentation: a submission record reads as one flat scroll, never
            // field-by-field. readOnly stacks all steps and hides nav + repeatable add/remove.
            settings={{
              ...((form.settings ?? {}) as PublicFormSettings),
              presentationMode: "card",
            }}
            customization={form.customization}
            formId={formId}
            initialFormData={(submission.data ?? {}) as Record<string, unknown>}
            layout="editor"
            hideTitle
            readOnly
          />
        </div>
      </div>
    </div>
  );
};

interface SubmissionsToolbarProps {
  activeTab: "all" | "completed" | "partial";
  globalFilter: string;
  view: "table" | "single";
  onViewChange: (view: "table" | "single") => void;
  onSetTabAll: () => void;
  onSetTabCompleted: () => void;
  onSetTabPartial: () => void;
  onGlobalFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: (format: "csv" | "pdf" | "excel") => void;
  /** Total submissions — shown as a count badge beside the title. */
  totalCount: number;
  /** Single-view cursor (1-based) + nav — rendered as a "X of N" pill in single view. */
  singleCurrent: number;
  onPrevSubmission: () => void;
  onNextSubmission: () => void;
  canPrevSubmission: boolean;
  canNextSubmission: boolean;
}

// Square icon-only trigger for the shared animated Tabs: w-[26px] (sm trigger is already h-6.5),
// flex-none + px-0! drop the stretch/padding the text-tab variant applies.
const VIEW_TAB = "w-[26px] flex-none px-0! text-muted-foreground";

const SubmissionsToolbar = ({
  activeTab,
  globalFilter,
  view,
  onViewChange,
  onSetTabAll,
  onSetTabCompleted,
  onSetTabPartial,
  onGlobalFilterChange,
  onExport,
  totalCount,
  singleCurrent,
  onPrevSubmission,
  onNextSubmission,
  canPrevSubmission,
  canNextSubmission,
}: SubmissionsToolbarProps) => {
  // Matches the dashboard toolbar (FilterMenu/SortMenu): gray pill, 14px/450, Fig* icons at size-4.
  const pill =
    "font-case inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg bg-secondary px-2 text-base font-[450] tracking-[0.14px] text-gray-800 transition-colors hover:bg-secondary/80 [&_svg]:size-4 [&_svg]:text-gray-800";
  return (
    <div className="shrink-0 border-border pt-8 pr-6 pb-5">
      <div className="flex items-center gap-3">
        {/* Figma 27015:20774: title + total-count badge on the left, controls on the right. */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 className="truncate text-[15px] font-semibold tracking-[0.015em] text-gray-950">
            Submissions
          </h2>
          {totalCount > 0 && (
            // Inverted chip (Figma gray/950 + white): bg-foreground/text-background stays a dark
            // pill with light text in light mode and flips legibly in dark mode.
            <span className="inline-flex shrink-0 items-center rounded-full bg-foreground px-[5px] py-px text-[12px] text-background tabular-nums">
              {totalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search / pager / Download / Filter all show in both views (Figma 27015:20773). */}
          {/* Search — matches the dashboard toolbar pill (gray/100 surface, search-alt icon). */}
          {/* Figma 27015:16994 — 170×28, gray/100, pl-8 pr-10 gap-6, 8px radius. */}
          <div className="flex h-7 w-[170px] items-center gap-1.5 rounded-lg bg-secondary pr-2.5 pl-2 transition-[width] duration-200 ease-out focus-within:w-[260px]">
            <FigSearchAltIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search"
              className="w-full bg-transparent font-case text-base font-[450] tracking-[0.14px] text-foreground outline-none placeholder:text-muted-foreground"
              value={globalFilter}
              onChange={onGlobalFilterChange}
              aria-label="Search responses"
              name="search"
            />
          </div>

          {/* Per-submission pager (Figma 27015:20788) — single view only; nav moved out of the card. */}
          {view === "single" && (
            <div className="flex h-7 items-center gap-1.5 rounded-lg bg-secondary pr-1.5 pl-1">
              <button
                type="button"
                onClick={onPrevSubmission}
                disabled={!canPrevSubmission}
                aria-label="Previous submission"
                className="flex size-5 items-center justify-center rounded-md text-gray-800 transition-colors hover:bg-background/60 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="font-case text-base font-[450] tracking-[0.14px] text-gray-800 tabular-nums">
                {singleCurrent} of {totalCount}
              </span>
              <button
                type="button"
                onClick={onNextSubmission}
                disabled={!canNextSubmission}
                aria-label="Next submission"
                className="flex size-5 items-center justify-center rounded-md text-gray-800 transition-colors hover:bg-background/60 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* Download (Figma 27015:21450) — pill with chevron; CSV / PDF / Excel. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  prefix={<Download className="size-4 shrink-0" strokeWidth={2} />}
                  suffix={<FigSmallDownIcon className="size-4 shrink-0" />}
                  className={pill}
                />
              }
            >
              Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("pdf")}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("excel")}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter (status) — static "Filter" title; the active tab is ticked in the dropdown
              (matches the dashboard FilterMenu). */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  prefix={<FigFilterIcon className="size-4 shrink-0" />}
                  suffix={<FigSmallDownIcon className="size-4 shrink-0" />}
                  className={pill}
                />
              }
            >
              Filter
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuItem onClick={onSetTabAll}>
                  <span className="flex-1 text-left">All</span>
                  {activeTab === "all" && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSetTabCompleted}>
                  <span className="flex-1 text-left">Completed</span>
                  {activeTab === "completed" && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSetTabPartial}>
                  <span className="flex-1 text-left">Partial</span>
                  {activeTab === "partial" && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle (Figma 26586:29914): list | board segmented control. Shared animated Tabs
              (TabsIndicator) so the active pill slides, matching the share-sidebar tabs. */}
          <Tabs value={view} onValueChange={(value) => onViewChange(value as "table" | "single")}>
            <TabsList className="gap-1 rounded-[8px] bg-muted">
              <TabsTrigger value="table" aria-label="Table view" className={VIEW_TAB}>
                <ListViewIcon className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="single" aria-label="Submission view" className={VIEW_TAB}>
                <CardsViewIcon className="size-4" />
              </TabsTrigger>
              <TabsIndicator />
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const SubmissionPreviewDialog = ({
  file,
  onClose,
}: {
  file: UploadedFileValue | null;
  onClose: () => void;
}) => (
  <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
    <DialogContent
      showCloseButton={false}
      className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-lg p-0"
    >
      {file && (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <FileTypeIcon type={file.type} className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button variant="ghost" size="sm">
                <ExternalLink className="mr-1.5 size-4" />
                Open in new tab
              </Button>
            </a>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              download={file.name}
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                <Download className="mr-1.5 size-4" />
                Download
              </Button>
            </a>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-muted/30">
            {file.type.startsWith("image/") ? (
              <Image
                src={file.url}
                alt={file.name}
                width={1600}
                height={1200}
                layout="constrained"
                className="max-h-[70vh] max-w-full object-contain"
              />
            ) : file.type === "application/pdf" ? (
              <object
                data={file.url}
                type="application/pdf"
                aria-label={file.name}
                className="h-[70vh] w-full"
              >
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileTypeIcon type={file.type} className="size-16" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Your browser blocked the inline preview. Use the buttons above to open or
                    download the file.
                  </p>
                </div>
              </object>
            ) : (
              <div className="flex flex-col items-center gap-4 py-12">
                <FileTypeIcon type={file.type} className="size-16" />
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);

interface SubmissionBulkActionBarProps {
  count: number;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

const SubmissionBulkActionBar = ({
  count,
  onExport,
  onDelete,
  onClear,
}: SubmissionBulkActionBarProps) => (
  // motion owns X centering (x: "-50%") to animate y/opacity without fighting Tailwind -translate-x-1/2.
  <motion.div
    initial={{ opacity: 0, y: 16, x: "-50%" }}
    animate={{ opacity: 1, y: 0, x: "-50%" }}
    exit={{ opacity: 0, y: 16, x: "-50%" }}
    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    className="fixed bottom-6 left-1/2 z-50 w-[min(560px,90vw)]"
  >
    <div className="flex items-center justify-between rounded-xl bg-background px-2.75 py-2.25 shadow-md">
      <div className="flex items-center gap-1">
        <Checkbox
          checked={true}
          className="size-5 border-foreground data-[state=checked]:border-foreground data-[state=checked]:bg-foreground"
        />
        <span className="text-sm">{count} selected</span>
      </div>
      <div className="flex h-6.5 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="size-3.5" />
          Export
          <span className="ml-1 text-xs text-muted-foreground">
            {formatForDisplay(HOTKEYS.SUBMISSIONS_EXPORT)}
          </span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
          <span className="ml-1 text-xs text-muted-foreground">
            {formatForDisplay(HOTKEYS.SUBMISSIONS_DELETE)}
          </span>
        </Button>
        <Button variant="secondary" size="sm" onClick={onClear}>
          <XIcon className="size-3.5" />
          Clear
          <span className="ml-1 text-xs text-muted-foreground">
            {formatForDisplay(HOTKEYS.SUBMISSIONS_CLEAR_SELECTION)}
          </span>
        </Button>
      </div>
    </div>
  </motion.div>
);

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/submissions",
)({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        ...submissionsBootstrapQueryOptions(params.formId),
        revalidateIfStale: true,
      }),
      context.queryClient.ensureInfiniteQueryData(submissionsInfiniteQueryOptions(params.formId)),
    ]);
  },
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  component: SubmissionsPage,
  pendingMs: 500,
  pendingMinMs: 300,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
