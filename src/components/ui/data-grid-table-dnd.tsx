import { CSSProperties, Fragment, useId } from "react";
import { Button } from "@/components/ui/button";
// eslint-disable-next-line import/no-cycle -- registered in data-grid.tsx's tableComponents
import { useDataGrid, useRowExpanded } from "@/components/ui/data-grid";
import type { DataGridFeatures } from "@/components/ui/data-grid";
/* eslint-disable import/no-cycle -- data-grid-table imports back from data-grid which imports us */
import {
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowExpandded,
  DataGridTableBodyRowSkeleton,
  DataGridTableBodyRowSkeletonCell,
  DataGridTableEmpty,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRowSpacer,
} from "@/components/ui/data-grid-table";
/* eslint-enable import/no-cycle */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { flexRender } from "@tanstack/react-table";
import type { Cell, Header, Row, RowData } from "@tanstack/table-core";
import { GripVerticalIcon } from "@/components/ui/icons";

const DataGridTableDndHeader = <TData extends RowData>({
  header,
}: {
  header: Header<DataGridFeatures, TData, unknown>;
}) => {
  const { props } = useDataGrid();
  const { column } = header;

  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <DataGridTableHeadRowCell header={header} dndStyle={style} dndRef={setNodeRef}>
      <div className="flex items-center justify-start gap-0.5">
        <Button
          size="sm"
          variant="ghost"
          className="-ms-2 size-6"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="opacity-50" aria-hidden="true" />
        </Button>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {props.tableLayout?.columnsResizable && column.getCanResize() && (
          <DataGridTableHeadRowCellResize header={header} />
        )}
      </div>
    </DataGridTableHeadRowCell>
  );
};

const DataGridTableDndCell = <TData extends RowData>({
  cell,
}: {
  cell: Cell<DataGridFeatures, TData, unknown>;
}) => {
  const { isDragging, setNodeRef, transform, transition } = useSortable({
    id: cell.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: "relative",
    transform: CSS.Translate.toString(transform),
    transition,
    width: cell.column.getSize(),
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <DataGridTableBodyRowCell cell={cell} dndStyle={style} dndRef={setNodeRef}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </DataGridTableBodyRowCell>
  );
};

// Hooks can't run inside a `.map` callback, so each row gets its own component.
const DataGridTableDndRowWithExpansion = <TData extends RowData>({
  row,
}: {
  row: Row<DataGridFeatures, TData>;
}) => {
  const { table } = useDataGrid();
  const isExpanded = useRowExpanded(table, row.id);
  return (
    <Fragment>
      <DataGridTableBodyRow row={row}>
        {row.getVisibleCells().map((cell) => (
          <SortableContext
            key={cell.id}
            items={table.state.columnOrder}
            strategy={horizontalListSortingStrategy}
          >
            <DataGridTableDndCell cell={cell} />
          </SortableContext>
        ))}
      </DataGridTableBodyRow>
      {isExpanded && <DataGridTableBodyRowExpandded row={row} />}
    </Fragment>
  );
};

export const DataGridTableDnd = ({
  handleDragEnd,
}: {
  handleDragEnd: (event: DragEndEvent) => void;
}) => {
  const { table, isLoading, props } = useDataGrid();
  const pagination = table.state.pagination;

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  return (
    <DndContext
      id={useId()}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="relative">
        <DataGridTableBase>
          <DataGridTableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataGridTableHeadRow headerGroup={headerGroup} key={headerGroup.id}>
                <SortableContext
                  items={table.state.columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {headerGroup.headers.map((header) => (
                    <DataGridTableDndHeader header={header} key={header.id} />
                  ))}
                </SortableContext>
              </DataGridTableHeadRow>
            ))}
          </DataGridTableHead>

          {(props.tableLayout?.stripped || !props.tableLayout?.rowBorder) && (
            <DataGridTableRowSpacer />
          )}

          <DataGridTableBody>
            {props.loadingMode === "skeleton" && isLoading && pagination?.pageSize ? (
              Array.from({ length: pagination.pageSize }, (_, i) => `skeleton-${i}`).map(
                (skeletonId) => (
                  <DataGridTableBodyRowSkeleton key={skeletonId}>
                    {table.getVisibleFlatColumns().map((column) => (
                      <DataGridTableBodyRowSkeletonCell column={column} key={column.id}>
                        {column.columnDef.meta?.skeleton}
                      </DataGridTableBodyRowSkeletonCell>
                    ))}
                  </DataGridTableBodyRowSkeleton>
                ),
              )
            ) : table.getRowModel().rows.length ? (
              table
                .getRowModel()
                .rows.map((row) => <DataGridTableDndRowWithExpansion key={row.id} row={row} />)
            ) : (
              <DataGridTableEmpty />
            )}
          </DataGridTableBody>
        </DataGridTableBase>
      </div>
    </DndContext>
  );
};
