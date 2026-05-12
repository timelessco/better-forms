import { createContext, use, useMemo } from "react";
import type { ReactNode, Ref, UIEventHandler } from "react";
import { useSelector } from "@tanstack/react-store";
import { createTableHook } from "@tanstack/react-table";
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
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
  RowData,
  SortingState,
  TableFeatures,
} from "@tanstack/table-core";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Cycle: these files import `useTableContext` / `useDataGrid` back from this
// file. createTableHook needs them as values at registration time; they only
// read from us inside their function bodies, so runtime resolution is safe.
// Same shape as the official TanStack composable-tables example.
/* eslint-disable import/no-cycle -- layout components register into tableComponents below */
import { DataGridColumnVisibility } from "@/components/ui/data-grid-column-visibility";
import { DataGridTable } from "@/components/ui/data-grid-table";
import { DataGridTableDnd } from "@/components/ui/data-grid-table-dnd";
import { DataGridTableDndRows } from "@/components/ui/data-grid-table-dnd-rows";
import { DataGridVirtualTable } from "@/components/ui/data-grid-virtual-table";
/* eslint-enable import/no-cycle */

// Stable module-level reference required by v9's `_features`.
export const DATA_GRID_FEATURES = tableFeatures({
  columnFacetingFeature,
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

// The full `useAppTable` return — includes `state`, the registered
// `tableComponents` (`table.DataGrid`, `table.DataGridVirtualTable`, etc.),
// and `table.AppTable` / `table.AppCell` / `table.AppHeader` wrappers.
export type DataGridApi<TData extends RowData> = ReturnType<typeof useAppTable<TData>>;

// Subscribes to `table.store` instead of per-slice `table.atoms.<slice>`: in
// v9 alpha.45 the per-slice derived atoms don't fire reliably when state is
// owned via `options.state.X` (sync into baseAtoms happens during render and
// the derived atom doesn't re-track in time). `table.store` is what v9's own
// `useTable` subscribes to. React Compiler can't track `row.getIsSelected()`
// reads via the stable Row reference, so the subscription is what forces the
// re-render on selection changes.
export const useRowSelected = <T extends RowData>(table: DataGridApi<T>, rowId: string): boolean =>
  useSelector(table.store, (state) => !!state.rowSelection?.[rowId]);

export const useRowExpanded = <T extends RowData>(table: DataGridApi<T>, rowId: string): boolean =>
  useSelector(table.store, (state) =>
    typeof state.expanded === "object" ? !!state.expanded?.[rowId] : !!state.expanded,
  );

export type RowPinPosition = "top" | "bottom" | false;
export const useRowPinned = <T extends RowData>(
  table: DataGridApi<T>,
  rowId: string,
): RowPinPosition =>
  useSelector(table.store, (state) => {
    if (state.rowPinning?.top?.includes(rowId)) return "top";
    if (state.rowPinning?.bottom?.includes(rowId)) return "bottom";
    return false;
  });

export type ColumnSortDirection = "asc" | "desc" | false;
export const useColumnSorted = <T extends RowData>(
  table: DataGridApi<T>,
  columnId: string,
): ColumnSortDirection =>
  useSelector(table.store, (state) => {
    const found = state.sorting?.find((s) => s.id === columnId);
    if (!found) return false;
    return found.desc ? "desc" : "asc";
  });

export type ColumnPinPosition = "left" | "right" | false;
export const useColumnPinned = <T extends RowData>(
  table: DataGridApi<T>,
  columnId: string,
): ColumnPinPosition =>
  useSelector(table.store, (state) => {
    if (state.columnPinning?.left?.includes(columnId)) return "left";
    if (state.columnPinning?.right?.includes(columnId)) return "right";
    return false;
  });

export const useColumnResizingId = <T extends RowData>(table: DataGridApi<T>): false | string =>
  useSelector(table.store, (state) => state.columnResizing?.isResizingColumn ?? false);

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

// Layout context — only props/recordCount/isLoading. The `table` instance
// flows separately via `useTableContext()` (from createTableHook). The public
// `useDataGrid()` hook below merges both for callers that need everything.
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

  // Stable across table state changes — leaf components subscribe via
  // `useRowSelected` etc. instead.
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

// Registered as a `cellComponent` so the row-selection checkbox subscribes
// to its own slice — React Compiler can't track `row.getIsSelected()` reads
// via the stable Row reference and would cache stale JSX otherwise.
const SelectionCheckbox = () => {
  const cell = useCellContext();
  const table = useTableContext();
  const rowId = cell.row.id;
  const isSelected = useSelector(table.store, (state) => !!state.rowSelection?.[rowId]);
  return (
    <Checkbox
      checked={isSelected}
      onCheckedChange={(value) => cell.row.toggleSelected(!!value)}
      aria-label="Select row"
      className="translate-y-[2px]"
    />
  );
};

// Mirror of `tanstack-form.tsx`'s `createFormHook` setup. All layout
// components register here, so call sites use `<table.DataGrid>` /
// `<table.DataGridVirtualTable>` etc. instead of importing each one.
// `<table.AppTable>` must wrap so `useTableContext()` works inside.
export const {
  useAppTable,
  createAppColumnHelper,
  useTableContext,
  useCellContext,
  useHeaderContext,
} = createTableHook({
  _features: DATA_GRID_FEATURES,
  _rowModels: {
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    filteredRowModel: createFilteredRowModel(filterFns),
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(sortFns),
  },
  cellComponents: {
    SelectionCheckbox,
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

export { useDataGrid };
