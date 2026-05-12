import { createContext, use, useMemo } from "react";
import type { ReactNode, Ref, UIEventHandler } from "react";
import { useSelector } from "@tanstack/react-store";
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
  Table,
  TableFeatures,
  TableState,
} from "@tanstack/table-core";

import { cn } from "@/lib/utils";

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

// `state` lives on the `useTable` return, not on the base `Table` type.
export type DataGridTable<TData extends RowData> = Table<DataGridFeatures, TData> & {
  state: TableState<DataGridFeatures>;
};

// `any` is intentional: row-model factories are contravariant in `TData`, so a
// single module-level value can't be typed both as `Partial<...<RowData>>` and
// be accepted by call sites with specific `TData`. The factories' runtime
// logic is data-agnostic. Consumers that want tighter typing construct inline
// (see `dropoff-funnel.tsx`).
// eslint-disable-next-line typescript-eslint/no-explicit-any
export const DATA_GRID_ROW_MODELS: any = {
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(filterFns),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(sortFns),
};

// Subscribes to `table.store` instead of per-slice `table.atoms.<slice>`: in
// v9 alpha.45 the per-slice derived atoms don't fire reliably when state is
// owned via `options.state.X` (sync into baseAtoms happens during render and
// the derived atom doesn't re-track in time). `table.store` is what v9's own
// `useTable` subscribes to. React Compiler can't track `row.getIsSelected()`
// reads via the stable Row reference, so the subscription is what forces the
// re-render on selection changes.
export const useRowSelected = <T extends RowData>(
  table: DataGridTable<T>,
  rowId: string,
): boolean => useSelector(table.store, (state) => !!state.rowSelection?.[rowId]);

export const useRowExpanded = <T extends RowData>(
  table: DataGridTable<T>,
  rowId: string,
): boolean =>
  useSelector(table.store, (state) =>
    typeof state.expanded === "object" ? !!state.expanded?.[rowId] : !!state.expanded,
  );

export type RowPinPosition = "top" | "bottom" | false;
export const useRowPinned = <T extends RowData>(
  table: DataGridTable<T>,
  rowId: string,
): RowPinPosition =>
  useSelector(table.store, (state) => {
    if (state.rowPinning?.top?.includes(rowId)) return "top";
    if (state.rowPinning?.bottom?.includes(rowId)) return "bottom";
    return false;
  });

export type ColumnSortDirection = "asc" | "desc" | false;
export const useColumnSorted = <T extends RowData>(
  table: DataGridTable<T>,
  columnId: string,
): ColumnSortDirection =>
  useSelector(table.store, (state) => {
    const found = state.sorting?.find((s) => s.id === columnId);
    if (!found) return false;
    return found.desc ? "desc" : "asc";
  });

export type ColumnPinPosition = "left" | "right" | false;
export const useColumnPinned = <T extends RowData>(
  table: DataGridTable<T>,
  columnId: string,
): ColumnPinPosition =>
  useSelector(table.store, (state) => {
    if (state.columnPinning?.left?.includes(columnId)) return "left";
    if (state.columnPinning?.right?.includes(columnId)) return "right";
    return false;
  });

export const useColumnResizingId = <T extends RowData>(table: DataGridTable<T>): false | string =>
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

export interface DataGridContextProps<TData extends RowData> {
  props: DataGridProps<TData>;
  table: DataGridTable<TData>;
  recordCount: number;
  isLoading: boolean;
}

export type DataGridRequestParams = {
  pageIndex: number;
  pageSize: number;
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
};

export interface DataGridProps<TData extends RowData> {
  className?: string;
  table?: DataGridTable<TData>;
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

const DataGridContext = createContext<
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  DataGridContextProps<any> | undefined
>(undefined);

const useDataGrid = () => {
  const context = use(DataGridContext);
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider");
  }
  return context;
};

const DataGridProvider = <TData extends RowData>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: DataGridTable<TData> }) => {
  // Intentionally stable across state changes — leaf components subscribe via
  // `useRowSelected` etc. Including `tableState.*` here would force every
  // consumer to re-render on any state change.
  const value = useMemo(
    () => ({
      props,
      table,
      recordCount: props.recordCount,
      isLoading: props.isLoading || false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      table,
      props.recordCount,
      props.isLoading,
      props.loadingMode,
      props.loadingMessage,
      props.fetchingMoreMessage,
      props.allRowsLoadedMessage,
      props.emptyMessage,
      props.onRowClick,
      props.className,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(props.tableLayout),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(props.tableClassNames),
    ],
  );

  return (
    <DataGridContext.Provider value={value as unknown as DataGridContextProps<object>}>
      {children}
    </DataGridContext.Provider>
  );
};

const DataGrid = <TData extends RowData>({ children, table, ...props }: DataGridProps<TData>) => {
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
    tableLayout: {
      ...defaultProps.tableLayout,
      ...props.tableLayout,
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...props.tableClassNames,
    },
  };

  if (!table) {
    throw new Error('DataGrid requires a "table" prop');
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
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

export { useDataGrid, DataGridProvider, DataGrid, DataGridContainer };
