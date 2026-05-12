import { memo, ReactNode, useCallback, useMemo, useRef, useState } from "react";
// eslint-disable-next-line import/no-cycle -- registered in data-grid.tsx's tableComponents
import { useDataGrid } from "@/components/ui/data-grid";
import type { DataGridFeatures, DataGridApi } from "@/components/ui/data-grid";
/* eslint-disable import/no-cycle -- data-grid-table imports back from data-grid which imports us */
import {
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableEmpty,
  DataGridTableFoot,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRenderedRow,
  DataGridTableRowSpacer,
  DataGridTableViewport,
  getDataGridTableRowSections,
} from "@/components/ui/data-grid-table";
/* eslint-enable import/no-cycle */
import { flexRender } from "@tanstack/react-table";
import type { Row, RowData } from "@tanstack/table-core";
import {
  useVirtualizer,
  VirtualItem,
  Virtualizer,
  VirtualizerOptions,
} from "@tanstack/react-virtual";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type DataGridApiVirtualScrollElements = {
  containerElement: HTMLDivElement | null;
  scrollElement: HTMLElement | null;
};

type DataGridApiVirtualizerInstance = Virtualizer<HTMLElement, HTMLTableRowElement>;

type DataGridApiVirtualizerOptions<TData extends RowData> = Omit<
  VirtualizerOptions<HTMLElement, HTMLTableRowElement>,
  "count" | "estimateSize" | "getItemKey" | "getScrollElement"
> & {
  estimateSize?: (index: number, row: Row<DataGridFeatures, TData>) => number;
  getItemKey?: (index: number, row: Row<DataGridFeatures, TData>) => string | number;
  getScrollElement?: (elements: DataGridApiVirtualScrollElements) => HTMLElement | null;
};

interface DataGridApiVirtualProps<TData extends RowData> {
  height?: number | string;
  estimateSize?: number;
  overscan?: number;
  footerContent?: ReactNode;
  renderHeader?: boolean;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  fetchMoreOffset?: number;
  virtualizerOptions?: DataGridApiVirtualizerOptions<TData>;
}

interface VirtualBodyProps<TData extends RowData> {
  table: DataGridApi<TData>;
  columnCount: number;
  topRows: Row<DataGridFeatures, TData>[];
  centerRows: Row<DataGridFeatures, TData>[];
  bottomRows: Row<DataGridFeatures, TData>[];
  virtualItems: VirtualItem[];
  totalSize: number;
  isVirtualizationEnabled: boolean;
  isInfiniteMode: boolean;
  isFetchingMore: boolean;
  hasMore?: boolean;
  loadingMoreMessage: ReactNode;
  allRowsLoadedMessage: ReactNode;
  measureRowRef?: (element: HTMLTableRowElement | null) => void;
}

const DataGridApiVirtualSpacer = ({
  columnCount,
  height,
}: {
  columnCount: number;
  height: number;
}) => {
  if (height <= 0) return null;

  return (
    <tr aria-hidden="true">
      <td colSpan={columnCount} style={{ height, padding: 0 }} />
    </tr>
  );
};

const DataGridApiVirtualStatusRow = ({
  children,
  className,
  columnCount,
}: {
  children: ReactNode;
  className?: string;
  columnCount: number;
}) => (
  <tr>
    <td
      colSpan={columnCount}
      className={cn("py-4 text-center text-sm text-muted-foreground", className)}
    >
      {children}
    </td>
  </tr>
);

// eslint-disable-next-line react-doctor/no-many-boolean-props -- vendored Reui virtualized table; flags are independent rendering modes
const DataGridApiVirtualBody = <TData extends RowData>({
  table: _table,
  columnCount,
  topRows,
  centerRows,
  bottomRows,
  virtualItems,
  totalSize,
  isVirtualizationEnabled,
  isInfiniteMode,
  isFetchingMore,
  hasMore,
  loadingMoreMessage,
  allRowsLoadedMessage,
  measureRowRef,
}: VirtualBodyProps<TData>) => {
  const totalRows = topRows.length + centerRows.length + bottomRows.length;

  if (!totalRows) return <DataGridTableEmpty />;

  const hasCenterRows = centerRows.length > 0;
  const showFetchingRow = isInfiniteMode && isFetchingMore;
  const showCompleteRow = isInfiniteMode && hasMore === false && totalRows > 0;
  const hasMiddleSection = hasCenterRows || showFetchingRow || showCompleteRow;
  const leadingSpacerHeight =
    isVirtualizationEnabled && hasCenterRows && virtualItems.length > 0
      ? (virtualItems[0]?.start ?? 0)
      : 0;
  const trailingSpacerHeight =
    isVirtualizationEnabled && hasCenterRows && virtualItems.length > 0
      ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0))
      : 0;

  const renderedRows: ReactNode[] = [];

  topRows.forEach((row, index) => {
    renderedRows.push(
      <DataGridTableRenderedRow
        key={row.id}
        row={row}
        pinnedBoundary={index === topRows.length - 1 && hasMiddleSection ? "top" : undefined}
      />,
    );
  });

  if (isVirtualizationEnabled) {
    if (leadingSpacerHeight > 0) {
      renderedRows.push(
        <DataGridApiVirtualSpacer
          key="virtual-spacer-start"
          columnCount={columnCount}
          height={leadingSpacerHeight}
        />,
      );
    }

    virtualItems.forEach((virtualRow) => {
      const row = centerRows[virtualRow.index];

      if (!row) return;

      renderedRows.push(<DataGridTableRenderedRow key={row.id} row={row} rowRef={measureRowRef} />);
    });

    if (trailingSpacerHeight > 0) {
      renderedRows.push(
        <DataGridApiVirtualSpacer
          key="virtual-spacer-end"
          columnCount={columnCount}
          height={trailingSpacerHeight}
        />,
      );
    }
  } else {
    centerRows.forEach((row) => {
      renderedRows.push(<DataGridTableRenderedRow key={row.id} row={row} />);
    });
  }

  if (showFetchingRow) {
    renderedRows.push(
      <DataGridApiVirtualStatusRow key="virtual-status-loading" columnCount={columnCount}>
        <div className="flex items-center justify-center gap-2">
          <Spinner className="size-4 opacity-60" />
          {loadingMoreMessage}
        </div>
      </DataGridApiVirtualStatusRow>,
    );
  }

  if (showCompleteRow) {
    renderedRows.push(
      <DataGridApiVirtualStatusRow
        key="virtual-status-complete"
        columnCount={columnCount}
        className="py-3 text-xs"
      >
        {allRowsLoadedMessage}
      </DataGridApiVirtualStatusRow>,
    );
  }

  bottomRows.forEach((row, index) => {
    renderedRows.push(
      <DataGridTableRenderedRow
        key={row.id}
        row={row}
        pinnedBoundary={
          index === 0 && (topRows.length > 0 || hasMiddleSection) ? "bottom" : undefined
        }
      />,
    );
  });

  return <>{renderedRows}</>;
};

/**
 * Memoized virtual body: skip re-renders during active column resize.
 * Column widths update via CSS variables on the <table> element,
 * so the browser handles width changes without React re-renders.
 */
const MemoizedVirtualBody = memo(
  DataGridApiVirtualBody,
  (_prev, next) => !!next.table.state.columnResizing.isResizingColumn,
) as typeof DataGridApiVirtualBody;

const DataGridApiVirtual = <TData extends RowData>({
  height,
  estimateSize = 48,
  overscan = 10,
  footerContent,
  renderHeader = true,
  onFetchMore,
  isFetchingMore = false,
  hasMore,
  fetchMoreOffset = 0,
  virtualizerOptions,
}: DataGridApiVirtualProps<TData>) => {
  const { table, props } = useDataGrid();
  const { topRows, centerRows, bottomRows } = getDataGridTableRowSections(
    table,
    props.tableLayout?.rowsPinnable,
  );
  const columnCount = table.getVisibleFlatColumns().length;
  const isInfiniteMode = typeof onFetchMore === "function";
  const [viewportElements, setViewportElements] = useState<DataGridApiVirtualScrollElements>({
    containerElement: null,
    scrollElement: null,
  });

  const {
    estimateSize: customEstimateSize,
    getItemKey: customGetItemKey,
    getScrollElement: customGetScrollElement,
    measureElement: customMeasureElement,
    overscan: customOverscan,
    ...virtualizerOptionsRest
  } = virtualizerOptions ?? {};

  const isVirtualizationEnabled = virtualizerOptions?.enabled !== false;
  const loadingMoreMessage = props.fetchingMoreMessage || props.loadingMessage || "Loading...";
  const allRowsLoadedMessage = props.allRowsLoadedMessage || "All records loaded";

  const handleViewportRef = useCallback((node: HTMLDivElement | null) => {
    setViewportElements({
      containerElement: node,
      scrollElement:
        (node?.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null) ?? node,
    });
  }, []);

  const usesExternalScrollArea =
    viewportElements.scrollElement !== null &&
    viewportElements.scrollElement !== viewportElements.containerElement;

  const resolveScrollElement = useCallback(() => {
    if (customGetScrollElement) {
      return customGetScrollElement(viewportElements);
    }

    return viewportElements.scrollElement;
  }, [customGetScrollElement, viewportElements]);

  const resolveItemKey = useCallback(
    (index: number) => {
      const row = centerRows[index];

      if (!row) return index;

      return (
        customGetItemKey?.(index, row as unknown as Row<DataGridFeatures, TData>) ?? row.id ?? index
      );
    },
    [centerRows, customGetItemKey],
  );

  const resolveEstimateSize = useCallback(
    (index: number) => {
      const row = centerRows[index];

      return row
        ? (customEstimateSize?.(index, row as unknown as Row<DataGridFeatures, TData>) ??
            estimateSize)
        : estimateSize;
    },
    [centerRows, customEstimateSize, estimateSize],
  );

  const resolvedFetchMoreOffset = useMemo(() => Math.max(0, fetchMoreOffset), [fetchMoreOffset]);

  // Store mutable refs for the onChange callback to avoid re-creating the virtualizer
  const fetchMoreRef = useRef({
    isVirtualizationEnabled,
    isInfiniteMode,
    hasMore,
    isFetchingMore,
    centerRowsLength: centerRows.length,
    resolvedFetchMoreOffset,
    onFetchMore,
  });
  fetchMoreRef.current = {
    isVirtualizationEnabled,
    isInfiniteMode,
    hasMore,
    isFetchingMore,
    centerRowsLength: centerRows.length,
    resolvedFetchMoreOffset,
    onFetchMore,
  };

  const handleVirtualizerChange = useCallback((instance: DataGridApiVirtualizerInstance) => {
    const {
      isVirtualizationEnabled: enabled,
      isInfiniteMode: infinite,
      hasMore: more,
      isFetchingMore: fetching,
      centerRowsLength,
      resolvedFetchMoreOffset: offset,
      onFetchMore: fetchMore,
    } = fetchMoreRef.current;
    if (!enabled || !infinite || more === false || fetching) return;

    const items = instance.getVirtualItems();
    const lastItem = items[items.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= centerRowsLength - 1 - offset) {
      fetchMore?.();
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: centerRows.length,
    getScrollElement: resolveScrollElement,
    getItemKey: resolveItemKey,
    estimateSize: resolveEstimateSize,
    overscan: customOverscan ?? overscan,
    measureElement: customMeasureElement,
    onChange: handleVirtualizerChange,
    ...virtualizerOptionsRest,
  }) as DataGridApiVirtualizerInstance;

  const virtualItems = isVirtualizationEnabled ? virtualizer.getVirtualItems() : [];
  const totalSize = isVirtualizationEnabled ? virtualizer.getTotalSize() : 0;
  const measureRowRef =
    isVirtualizationEnabled && customMeasureElement ? virtualizer.measureElement : undefined;

  return (
    <DataGridTableViewport
      viewportRef={handleViewportRef}
      className={!usesExternalScrollArea ? "block" : undefined}
      style={
        usesExternalScrollArea ? undefined : { height, overflow: "auto", position: "relative" }
      }
    >
      <DataGridTableBase>
        {renderHeader && (
          <DataGridTableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataGridTableHeadRow headerGroup={headerGroup} key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const { column } = header;

                  return (
                    <DataGridTableHeadRowCell header={header} key={header.id}>
                      {header.isPlaceholder ? null : props.tableLayout?.columnsResizable &&
                        column.getCanResize() ? (
                        <div className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {props.tableLayout?.columnsResizable && column.getCanResize() && (
                        <DataGridTableHeadRowCellResize header={header} />
                      )}
                    </DataGridTableHeadRowCell>
                  );
                })}
              </DataGridTableHeadRow>
            ))}
          </DataGridTableHead>
        )}

        {renderHeader && (props.tableLayout?.stripped || !props.tableLayout?.rowBorder) && (
          <DataGridTableRowSpacer />
        )}

        <DataGridTableBody>
          <MemoizedVirtualBody
            table={table}
            columnCount={columnCount}
            topRows={topRows}
            centerRows={centerRows}
            bottomRows={bottomRows}
            virtualItems={virtualItems}
            totalSize={totalSize}
            isVirtualizationEnabled={isVirtualizationEnabled}
            isInfiniteMode={isInfiniteMode}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            loadingMoreMessage={loadingMoreMessage}
            allRowsLoadedMessage={allRowsLoadedMessage}
            measureRowRef={measureRowRef}
          />
        </DataGridTableBody>

        {footerContent && <DataGridTableFoot>{footerContent}</DataGridTableFoot>}
      </DataGridTableBase>
    </DataGridTableViewport>
  );
};

export { DataGridApiVirtual, DataGridApiVirtual as DataGridVirtualTable };
export type {
  DataGridApiVirtualProps,
  DataGridApiVirtualScrollElements,
  DataGridApiVirtualizerOptions,
};
