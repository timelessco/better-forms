import { createContext, use, useMemo } from "react";
import type { ReactNode, Ref, UIEventHandler } from "react";
import { useSelector } from "@tanstack/react-store";
import { createTableHook } from "@tanstack/react-table";
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/table-core";
import type {
  CellData,
  ColumnFiltersState,
  Row,
  RowData,
  SortingState,
  TableFeatures,
} from "@tanstack/table-core";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Cycle: these import useTableContext/useDataGrid back; createTableHook needs them as values
// at registration but reads only in function bodies, so runtime resolution is safe. Mirrors
// the official TanStack composable-tables example.
/* eslint-disable import/no-cycle -- layout components register into tableComponents below */
import { DataGridColumnVisibility } from "@/components/ui/data-grid-column-visibility";
import { DataGridTable } from "@/components/ui/data-grid-table";
import { DataGridTableDnd } from "@/components/ui/data-grid-table-dnd";
import { DataGridTableDndRows } from "@/components/ui/data-grid-table-dnd-rows";
import { DataGridVirtualTable } from "@/components/ui/data-grid-virtual-table";
/* eslint-enable import/no-cycle */

// Stable module-level reference required by v9's `_features`.
export const DATA_GRID_FEATURES = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
});
export type DataGridFeatures = typeof DATA_GRID_FEATURES;

// Full useAppTable return — state, registered tableComponents, and AppTable/AppCell/AppHeader wrappers.
export type DataGridApi<TData extends RowData> = ReturnType<typeof useAppTable<TData>>;

// Why subscribe at all: React Compiler caches row.getIsSelected() etc against the stable Row
// reference, so direct reads go stale; per-slice atoms re-render only on that slice (store is deprecated).
export const useRowSelected = <T extends RowData>(table: DataGridApi<T>, rowId: string): boolean =>
  useSelector(table.atoms.rowSelection, (rowSelection) => !!rowSelection?.[rowId]);

export const useRowExpanded = <T extends RowData>(table: DataGridApi<T>, rowId: string): boolean =>
  useSelector(table.atoms.expanded, (expanded) =>
    typeof expanded === "object" ? !!expanded?.[rowId] : !!expanded,
  );

export type RowPinPosition = "top" | "bottom" | false;
export const useRowPinned = <T extends RowData>(
  table: DataGridApi<T>,
  rowId: string,
): RowPinPosition =>
  useSelector(table.atoms.rowPinning, (rowPinning) => {
    if (rowPinning?.top?.includes(rowId)) return "top";
    if (rowPinning?.bottom?.includes(rowId)) return "bottom";
    return false;
  });

export type ColumnSortDirection = "asc" | "desc" | false;
export const useColumnSorted = <T extends RowData>(
  table: DataGridApi<T>,
  columnId: string,
): ColumnSortDirection =>
  useSelector(table.atoms.sorting, (sorting) => {
    const found = sorting?.find((s) => s.id === columnId);
    if (!found) return false;
    return found.desc ? "desc" : "asc";
  });

export type ColumnPinPosition = "left" | "right" | false;
export const useColumnPinned = <T extends RowData>(
  table: DataGridApi<T>,
  columnId: string,
): ColumnPinPosition =>
  useSelector(table.atoms.columnPinning, (columnPinning) => {
    if (columnPinning?.left?.includes(columnId)) return "left";
    if (columnPinning?.right?.includes(columnId)) return "right";
    return false;
  });

export const useColumnResizingId = <T extends RowData>(table: DataGridApi<T>): false | string =>
  useSelector(
    table.atoms.columnResizing,
    (columnResizing) => columnResizing?.isResizingColumn ?? false,
  );

declare module "@tanstack/table-core" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    headerTitle?: string;
    headerClassName?: string;
    cellClassName?: string;
    skeleton?: ReactNode;
    expandedContent?: (row: TData) => ReactNode;
  }
}

export type DataGridApiFetchParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
  searchQuery?: string;
};

export type DataGridApiResponse<T> = {
  data: T[];
  empty: boolean;
  pagination: {
    total: number;
    page: number;
  };
};

// Layout context — props/recordCount/isLoading only. table flows via useTableContext();
// useDataGrid() below merges both.
interface DataGridLayoutContext<TData extends RowData> {
  props: DataGridProps<TData>;
  recordCount: number;
  isLoading: boolean;
}

export interface DataGridContextProps<TData extends RowData> extends DataGridLayoutContext<TData> {
  table: DataGridApi<TData>;
}

export type DataGridRequestParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
};

export interface DataGridProps<TData extends RowData> {
  className?: string;
  recordCount: number;
  children?: ReactNode;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  loadingMode?: "skeleton" | "spinner";
  loadingMessage?: ReactNode | string;
  fetchingMoreMessage?: ReactNode | string;
  allRowsLoadedMessage?: ReactNode | string;
  emptyMessage?: ReactNode | string;
  tableLayout?: {
    dense?: boolean;
    cellBorder?: boolean;
    rowBorder?: boolean;
    rowRounded?: boolean;
    stripped?: boolean;
    headerBackground?: boolean;
    headerBorder?: boolean;
    headerSticky?: boolean;
    width?: "auto" | "fixed";
    columnsVisibility?: boolean;
    columnsResizable?: boolean;
    columnsPinnable?: boolean;
    columnsMovable?: boolean;
    columnsDraggable?: boolean;
    rowsDraggable?: boolean;
    rowsPinnable?: boolean;
  };
  tableClassNames?: {
    base?: string;
    header?: string;
    headerRow?: string;
    headerSticky?: string;
    body?: string;
    bodyRow?: string;
    footer?: string;
    edgeCell?: string;
  };
}

const DataGridLayoutContextCtx = createContext<
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  DataGridLayoutContext<any> | undefined
>(undefined);

const useDataGrid = () => {
  const layout = use(DataGridLayoutContextCtx);
  if (!layout) {
    throw new Error("useDataGrid must be used within a DataGrid");
  }
  const table = useTableContext();
  return { ...layout, table } as DataGridContextProps<object>;
};

const DataGrid = <TData extends RowData>({ children, ...props }: DataGridProps<TData>) => {
  const defaultProps: Partial<DataGridProps<TData>> = {
    loadingMode: "skeleton",
    tableLayout: {
      dense: false,
      cellBorder: false,
      rowBorder: true,
      rowRounded: false,
      stripped: false,
      headerSticky: false,
      headerBackground: true,
      headerBorder: true,
      width: "fixed",
      columnsVisibility: false,
      columnsResizable: false,
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
      rowsPinnable: false,
    },
    tableClassNames: {
      base: "",
      header: "",
      headerRow: "",
      headerSticky: "sticky top-0 z-15 bg-background/90 backdrop-blur-xs",
      body: "",
      bodyRow: "",
      footer: "",
      edgeCell: "",
    },
  };

  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: { ...defaultProps.tableLayout, ...props.tableLayout },
    tableClassNames: { ...defaultProps.tableClassNames, ...props.tableClassNames },
  };

  // Stable across table state changes — leaves subscribe via useRowSelected etc.
  const value = useMemo<DataGridLayoutContext<TData>>(
    () => ({
      props: mergedProps,
      recordCount: mergedProps.recordCount,
      isLoading: mergedProps.isLoading || false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      mergedProps.recordCount,
      mergedProps.isLoading,
      mergedProps.loadingMode,
      mergedProps.loadingMessage,
      mergedProps.fetchingMoreMessage,
      mergedProps.allRowsLoadedMessage,
      mergedProps.emptyMessage,
      mergedProps.onRowClick,
      mergedProps.className,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(mergedProps.tableLayout),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(mergedProps.tableClassNames),
    ],
  );

  return (
    <DataGridLayoutContextCtx.Provider value={value as DataGridLayoutContext<object>}>
      {children}
    </DataGridLayoutContextCtx.Provider>
  );
};

const DataGridContainer = ({
  children,
  className,
  border = true,
  ref,
  onScroll,
}: {
  children: ReactNode;
  className?: string;
  border?: boolean;
  ref?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    data-slot="data-grid"
    onScroll={onScroll}
    className={cn("grid w-full", border && "rounded-lg border border-b-0 border-border", className)}
  >
    {children}
  </div>
);

// Mirror of tanstack-form.tsx's createFormHook. Layout components register here so call sites
// use <table.DataGrid> etc.; <table.AppTable> must wrap for useTableContext() to work.
//
// cellComponents/headerComponents NOT used: they only attach inside <table.AppCell>/<AppHeader>
// render-prop wrappers (Object.assign(cell, cellComponents)). Our body renders via flexRender,
// which gets a plain Cell, so cell.MyComponent is undefined at runtime despite the types.
// Standalone components (SelectionCheckbox below) used directly from column defs are runtime-correct.
export const {
  useAppTable,
  createAppColumnHelper,
  useTableContext,
  useCellContext,
  useHeaderContext,
} = createTableHook({
  features: DATA_GRID_FEATURES,
  // Expansion is content-row-only: rowExpandingFeature w/o createExpandedRowModel, so getSubRows
  // flattening silently no-ops — meta.expandedContent rows are rendered manually instead.
  rowModels: {
    filteredRowModel: createFilteredRowModel(filterFns),
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(sortFns),
  },
  tableComponents: {
    DataGrid,
    DataGridContainer,
    DataGridTable,
    DataGridVirtualTable,
    DataGridTableDnd,
    DataGridTableDndRows,
    DataGridColumnVisibility,
  },
});

// React Compiler caches cell renders against the stable Row ref, so direct row.getIsSelected()
// in a cell: function reads stale; subscribing here re-renders just this checkbox on selection.
export const SelectionCheckbox = <TData extends RowData>({
  row,
  ariaLabel,
}: {
  row: Row<DataGridFeatures, TData>;
  ariaLabel?: string;
}) => {
  const table = useTableContext<TData>();
  const isSelected = useSelector(
    table.atoms.rowSelection,
    (rowSelection) => !!rowSelection?.[row.id],
  );
  return (
    <Checkbox
      checked={isSelected}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label={ariaLabel ?? "Select row"}
      className="translate-y-[2px]"
    />
  );
};

export { useDataGrid };
