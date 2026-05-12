import { cn } from "@/lib/utils";
import { MULTI_SELECT_COLORS } from "@/components/ui/form-option-item-constants";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { DataGridColumnHeader } from "@/components/ui/data-grid-column-header";
import { DataGridColumnVisibility } from "@/components/ui/data-grid-column-visibility";
import { DataGridVirtualTable } from "@/components/ui/data-grid-virtual-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type {
  Cell,
  ColumnDef,
  ColumnPinningState,
  ColumnVisibilityState as VisibilityState,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/table-core";
import {
  createAppColumnHelper,
  DataGrid,
  DataGridContainer,
  useAppTable,
} from "@/components/ui/data-grid";
import type { DataGridFeatures, DataGridTable } from "@/components/ui/data-grid";

import { ChevronDownIcon, FilterIcon, Trash2Icon, XIcon } from "@/components/ui/icons";
import { Columns, Download, ExternalLink, FileText, Paperclip, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Value } from "platejs";
import { useCallback, useMemo, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { HOTKEYS, formatForDisplay } from "@/lib/hotkeys";

type FieldStatus = "current" | "deleted";
const EMPTY_LABELS: Record<string, string> = {};

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
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
};

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
    return <span className="text-[13px] text-muted-foreground">-</span>;
  }

  switch (fieldType) {
    case "Email":
      return (
        <a
          href={`mailto:${text}`}
          className="block max-w-[300px] truncate text-[13px] text-primary hover:underline"
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
          className="block max-w-[300px] truncate text-[13px] text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </a>
      );
    case "Date":
      return (
        <span className="block max-w-[300px] truncate text-[13px] tabular-nums">
          {formatDateCellValue(text)}
        </span>
      );
    case "Time":
    case "Phone":
    case "Number":
      return <span className="block max-w-[300px] truncate text-[13px] tabular-nums">{text}</span>;
    case "Checkbox":
    case "MultiChoice":
    case "MultiSelect":
    case "Ranking":
    default: {
      const items = Array.isArray(value) ? value : null;
      if (!items) {
        return <span className="block max-w-[300px] truncate text-[13px]">{labelFor(value)}</span>;
      }
      const useColors = fieldType === "MultiSelect" && options;
      return (
        <div className="flex max-w-[300px] flex-wrap gap-1">
          {items.map((item) => {
            const colorIdx = useColors ? options.findIndex((o) => o.value === String(item)) : -1;
            const color =
              colorIdx >= 0 ? MULTI_SELECT_COLORS[colorIdx % MULTI_SELECT_COLORS.length] : null;
            return (
              <span
                key={String(item)}
                className={cn(
                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]",
                  color ? cn(color.bg, color.text) : "bg-secondary text-secondary-foreground",
                )}
              >
                {labelFor(item)}
              </span>
            );
          })}
        </div>
      );
    }
    case "FileUpload": {
      // Legacy: bare string filename from old submissions
      if (typeof value === "string") {
        return (
          <span className="block max-w-[180px] truncate text-[13px] text-muted-foreground italic">
            {value}
          </span>
        );
      }
      if (!isUploadedFileValue(value)) {
        return <span className="text-[13px] text-muted-foreground">-</span>;
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
            <FileTypeIcon type={file.type} className="size-4 shrink-0" />
          )}
          {!isImage && (
            <span className="truncate text-[13px] text-muted-foreground group-hover:text-foreground">
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
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ cell }) => <cell.SelectionCheckbox />,
      size: 48,
      minSize: 48,
      maxSize: 48,
      meta: {},
      enableSorting: false,
      enableHiding: false,
      enablePinning: false,
      enableResizing: false,
    }),
    toSubmissionColumn(
      columnHelper.accessor("createdAt", {
        header: ({ column }) => <DataGridColumnHeader column={column} title="Submitted at" />,
        cell: (info) => (
          <div className="group/row flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-[13px]">
                {formatSubmittedAt(info.getValue())}
              </span>
              {!info.row.original.isCompleted && (
                <span className="shrink-0 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400">
                  Drop-off
                </span>
              )}
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
        size: 200,
        minSize: 140,
      }),
    ),
    toSubmissionColumn(
      columnHelper.accessor("lastStepReached", {
        id: "last_step_reached",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Last step" />,
        cell: (info) => {
          const step = info.getValue();
          if (step == null) return <span className="text-muted-foreground">-</span>;
          return <span className="text-[13px]">Step {step + 1}</span>;
        },
        size: 120,
        meta: { headerTitle: "Last step" },
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
            columnHelper.accessor((row) => row.data?.[field.name], {
              id: field.name,
              header: ({ column }) => (
                <DataGridColumnHeader
                  column={column}
                  title={("label" in field ? field.label : "") || field.name}
                  icon={
                    <span className="block size-2.5 rounded-full border-[1.5px] border-emerald-500" />
                  }
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
                icon={
                  <span className="block size-2.5 rounded-full border-[1.5px] border-red-500" />
                }
              />
            ),
            cell: (info) => (
              <SubmissionCell
                value={info.getValue()}
                fieldType="FileUpload"
                onPreview={onPreview}
              />
            ),
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

const SubmissionsPage = () => {
  const { formId } = Route.useParams();
  const queryClient = useQueryClient();
  Route.useLoaderData(); // ensure loader has primed the query cache
  const [activeTab, setActiveTab] = useState<"all" | "completed" | "partial">("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [fieldStatusFilter] = useState<Set<FieldStatus>>(new Set(["current", "deleted"]));
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    last_step_reached: false,
  });
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFileValue | null>(null);
  const openPreview = useCallback((file: UploadedFileValue) => setPreviewFile(file), []);
  const closePreview = useCallback(() => setPreviewFile(null), []);
  const handleSetActiveTabAll = useCallback(() => setActiveTab("all"), []);
  const handleSetActiveTabCompleted = useCallback(() => setActiveTab("completed"), []);
  const handleSetActiveTabPartial = useCallback(() => setActiveTab("partial"), []);
  const handleGlobalFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setGlobalFilter(e.target.value),
    [],
  );
  const handleClearSelection = useCallback(() => setRowSelection({}), []);

  // Bootstrap: published form content + total count + historical field labels (1 round-trip)
  const { data: bootstrapData } = useQuery({
    queryKey: ["submissionsBootstrap", formId],
    queryFn: () => getSubmissionsBootstrap({ data: { formId } }),
    staleTime: 1000 * 60 * 10,
  });
  const publishedContent = bootstrapData?.form?.content;
  const totalCount = bootstrapData?.totalCount ?? 0;
  const historicalLabels = bootstrapData?.fieldLabels ?? EMPTY_LABELS;

  const {
    data: submissionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingSubmissions,
  } = useInfiniteQuery({
    queryKey: ["submissions", formId],
    queryFn: async ({ pageParam }: { pageParam: SubmissionCursor | undefined }) =>
      getPaginatedSubmissionsPage(formId, pageParam),
    initialPageParam: undefined as SubmissionCursor | undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    refetchOnWindowFocus: true,
  });

  const allSubmissions: SerializedSubmission[] = useMemo(
    () => submissionsData?.pages?.flatMap((page) => page?.submissions ?? []) ?? [],
    [submissionsData],
  );

  const { completedCount, partialCount } = useMemo(() => {
    let completed = 0;
    for (const s of allSubmissions) {
      if (s.isCompleted) completed++;
    }
    return {
      completedCount: completed,
      partialCount: allSubmissions.length - completed,
    };
  }, [allSubmissions]);
  const submissions = useMemo(() => {
    if (activeTab === "completed")
      return allSubmissions.filter((s: SerializedSubmission) => s.isCompleted);
    if (activeTab === "partial")
      return allSubmissions.filter((s: SerializedSubmission) => !s.isCompleted);
    return allSubmissions;
  }, [allSubmissions, activeTab]);

  const handleDelete = useCallback(
    async (submissionId: string) => {
      await deleteSubmission({ data: { id: submissionId, formId } });
      void queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    [formId, queryClient],
  );

  const formElements = useMemo(() => {
    if (!publishedContent) return null;
    return transformPlateStateToFormElements(publishedContent as Value);
  }, [publishedContent]);

  // Derive stable orphaned field names from submissions
  // This prevents columns from rebuilding when submission data reference changes
  const orphanedFieldNamesRef = useRef<Set<string>>(new Set());
  const orphanedFieldNames = useMemo(() => {
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
          if (!currentFieldNames.has(key)) {
            orphaned.add(key);
          }
        });
      }
    });

    // Only update ref if the set actually changed
    const prevKeys = [...orphanedFieldNamesRef.current].toSorted().join(",");
    const nextKeys = [...orphaned].toSorted().join(",");
    if (prevKeys !== nextKeys) {
      orphanedFieldNamesRef.current = orphaned;
    }
    return orphanedFieldNamesRef.current;
  }, [allSubmissions, formElements]);

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
    data: submissions,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      columnVisibility,
      columnPinning,
      columnOrder,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    autoResetPageIndex: false,
    columnResizeMode: "onChange",
    getRowId: (row) => row.id,
  });

  const { handleBulkDelete, handleExportSelected, handleDownloadCSV } =
    useSubmissionExportAndDelete({
      formId,
      queryClient,
      columns,
      table,
      rowSelection,
      setRowSelection,
    });

  useSubmissionsHotkeys({
    table,
    rowSelection,
    setRowSelection,
    onExport: handleExportSelected,
    onBulkDelete: handleBulkDelete,
  });

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <SubmissionsToolbar
        activeTab={activeTab}
        allCount={allSubmissions.length}
        completedCount={completedCount}
        partialCount={partialCount}
        globalFilter={globalFilter}
        table={table}
        onSetTabAll={handleSetActiveTabAll}
        onSetTabCompleted={handleSetActiveTabCompleted}
        onSetTabPartial={handleSetActiveTabPartial}
        onGlobalFilterChange={handleGlobalFilterChange}
        onDownloadCSV={handleDownloadCSV}
      />

      <SubmissionPreviewDialog file={previewFile} onClose={closePreview} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {Object.keys(rowSelection).length > 0 && (
          <SubmissionBulkActionBar
            count={Object.keys(rowSelection).length}
            onExport={handleExportSelected}
            onDelete={handleBulkDelete}
            onClear={handleClearSelection}
          />
        )}

        <DataGrid
          table={table}
          recordCount={totalCount}
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
            <DataGridContainer
              border={false}
              className="min-h-0 flex-1 content-start overflow-x-auto overflow-y-hidden border-b border-border"
            >
              <DataGridVirtualTable
                onFetchMore={fetchNextPage}
                hasMore={hasNextPage}
                isFetchingMore={isFetchingNextPage}
                fetchMoreOffset={5}
              />
            </DataGridContainer>
          </div>
        </DataGrid>
      </div>
    </div>
  );
};

interface UseSubmissionExportAndDeleteOptions {
  formId: string;
  queryClient: ReturnType<typeof useQueryClient>;
  columns: ColumnDef<DataGridFeatures, SerializedSubmission>[];
  table: DataGridTable<SerializedSubmission>;
  rowSelection: RowSelectionState;
  setRowSelection: (selection: RowSelectionState) => void;
}

const useSubmissionExportAndDelete = ({
  formId,
  queryClient,
  columns,
  table,
  rowSelection,
  setRowSelection,
}: UseSubmissionExportAndDeleteOptions) => {
  const handleBulkDelete = useCallback(async () => {
    const selectedIds = Object.keys(rowSelection);
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
  }, [formId, queryClient, rowSelection, setRowSelection]);

  const downloadCSV = useCallback(
    (rows: Row<DataGridFeatures, SerializedSubmission>[], filename: string) => {
      if (rows.length === 0) return;

      const headers = columns
        .flatMap((col) => {
          if (col.id === "select") return [];
          if (typeof col.header === "string") return [col.header];
          if (col.id === "submitted_at") return ["Submitted At"];
          return [col.id || "Field"];
        })
        .join(",");

      const csvRows = rows
        .map((row) =>
          row
            .getVisibleCells()
            .flatMap((cell: Cell<DataGridFeatures, SerializedSubmission, unknown>) => {
              if (cell.column.id === "select") return [];
              const formatted = csvFormat(cell.getValue()).replaceAll('"', '""');
              return [`"${formatted}"`];
            })
            .join(","),
        )
        .join("\n");

      const csv = `${headers}\n${csvRows}`;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    [columns],
  );

  const handleExportSelected = useCallback(() => {
    downloadCSV(table.getSelectedRowModel().rows, `submissions-selected-${formId}.csv`);
  }, [downloadCSV, formId, table]);

  const handleDownloadCSV = useCallback(() => {
    downloadCSV(table.getRowModel().rows, `submissions-${formId}.csv`);
  }, [downloadCSV, formId, table]);

  return { handleBulkDelete, handleExportSelected, handleDownloadCSV };
};

interface UseSubmissionsHotkeysOptions {
  table: DataGridTable<SerializedSubmission>;
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
      table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
    },
    { conflictBehavior: "replace", ignoreInputs: true },
  );

  useHotkey(HOTKEYS.SUBMISSIONS_EXPORT, () => onExport(), {
    enabled: hasSelection,
    conflictBehavior: "replace",
    ignoreInputs: true,
  });

  useHotkey(HOTKEYS.SUBMISSIONS_DELETE, () => onBulkDelete(), {
    enabled: hasSelection,
    ignoreInputs: true,
  });

  useHotkey(HOTKEYS.SUBMISSIONS_CLEAR_SELECTION, () => setRowSelection({}), {
    enabled: hasSelection,
    ignoreInputs: true,
  });
};

interface SubmissionsToolbarProps {
  activeTab: "all" | "completed" | "partial";
  allCount: number;
  completedCount: number;
  partialCount: number;
  globalFilter: string;
  table: DataGridTable<SerializedSubmission>;
  onSetTabAll: () => void;
  onSetTabCompleted: () => void;
  onSetTabPartial: () => void;
  onGlobalFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadCSV: () => void;
}

const SubmissionsToolbar = ({
  activeTab,
  allCount,
  completedCount,
  partialCount,
  globalFilter,
  table,
  onSetTabAll,
  onSetTabCompleted,
  onSetTabPartial,
  onGlobalFilterChange,
  onDownloadCSV,
}: SubmissionsToolbarProps) => {
  const activeCount =
    activeTab === "all" ? allCount : activeTab === "completed" ? completedCount : partialCount;
  const activeLabel =
    activeTab === "all" ? "All" : activeTab === "completed" ? "Completed" : "Partial";
  return (
    <div className="shrink-0 border-border px-5 pt-2.5 pb-4.5">
      <div className="flex items-center justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-lg bg-accent/60 font-normal hover:bg-accent"
              />
            }
          >
            {activeLabel}
            <span className="opacity-60">{activeCount}</span>
            <ChevronDownIcon className="size-2.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onClick={onSetTabAll} className="gap-2">
              All
              <span className="ml-auto text-xs text-muted-foreground">{allCount}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSetTabCompleted} className="gap-2">
              Completed
              <span className="ml-auto text-xs text-muted-foreground">{completedCount}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSetTabPartial} className="gap-2">
              Partial
              <span className="ml-auto text-xs text-muted-foreground">{partialCount}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1.5">
          <ButtonGroup className="w-[180px] rounded-lg border-none transition-[width] duration-200 ease-out focus-within:w-[240px]">
            <ButtonGroupText className="h-7 w-full gap-1.5 rounded-lg border border-transparent bg-accent/60 px-2.5 text-[13px]">
              <Search className="size-4" strokeWidth={2} color="var(--color-gray-alpha-600)" />
              <input
                placeholder="Search responses..."
                className="placeholder:text-normal min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] outline-none placeholder:text-[0.8rem] placeholder:text-(--color-gray-alpha-600)"
                value={globalFilter}
                onChange={onGlobalFilterChange}
                aria-label="Search responses"
                name="search"
              />
            </ButtonGroupText>
          </ButtonGroup>
          <DataGridColumnVisibility
            table={table}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                prefix={
                  <Columns className="size-4" strokeWidth="2" color="var(--color-gray-alpha-600)" />
                }
                suffix={<ChevronDownIcon className="size-2.5 shrink-0 text-muted-foreground" />}
                className="text-normal inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg rounded-md bg-accent/60 px-2.5 text-[0.8rem] text-(--color-gray-alpha-600) transition-colors hover:bg-accent"
              >
                Columns
              </Button>
            }
          />

          <Button
            variant="ghost"
            size="sm"
            prefix={
              <Download strokeWidth={2} color="var(--color-gray-alpha-600)" className="size-4" />
            }
            className="text-normal inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg rounded-md bg-accent/60 px-2.5 text-[0.8rem] text-(--color-gray-alpha-600) transition-colors hover:bg-accent"
            onClick={onDownloadCSV}
          >
            Download CSV
          </Button>
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
  <div className="fixed bottom-6 left-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 animate-in duration-300 fade-in slide-in-from-bottom-4">
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
  </div>
);

export const Route = createFileRoute(
  "/_authenticated/workspace/$workspaceId/form-builder/$formId/submissions",
)({
  ssr: "data-only",
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["submissionsBootstrap", params.formId],
        queryFn: () => getSubmissionsBootstrap({ data: { formId: params.formId } }),
        revalidateIfStale: true,
      }),
      context.queryClient.ensureInfiniteQueryData({
        queryKey: ["submissions", params.formId],
        queryFn: () => getPaginatedSubmissionsPage(params.formId, undefined),
        initialPageParam: undefined as SubmissionCursor | undefined,
        getNextPageParam: (lastPage: PaginatedSubmissionsPage) => lastPage.nextCursor,
      }),
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
