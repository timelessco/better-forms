import { CSSProperties, useId } from "react";
import { Button } from "@/components/ui/button";
// eslint-disable-next-line import/no-cycle -- registered in data-grid.tsx's tableComponents
import { useDataGrid } from "@/components/ui/data-grid";
/* eslint-disable import/no-cycle -- data-grid-table imports back from data-grid which imports us */
import {
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
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
  UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DataGridFeatures } from "@/components/ui/data-grid";
import { flexRender } from "@tanstack/react-table";
import type { Row, RowData } from "@tanstack/table-core";
import { GripHorizontalIcon } from "@/components/ui/icons";

export const DataGridTableDndRowHandle = ({ rowId }: { rowId: string }) => {
  const { attributes, listeners } = useSortable({
    id: rowId,
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-7"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripHorizontalIcon />
    </Button>
  );
};

const DataGridTableDndRow = <TData extends RowData>({
  row,
}: {
  row: Row<DataGridFeatures, TData>;
}) => {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), //let dnd-kit do its thing
    transition: transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
  };
  return (
    <DataGridTableBodyRow row={row} dndRef={setNodeRef} dndStyle={style} key={row.id}>
      {row.getVisibleCells().map((cell) => (
        <DataGridTableBodyRowCell cell={cell} key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </DataGridTableBodyRowCell>
      ))}
    </DataGridTableBodyRow>
  );
};

export const DataGridTableDndRows = ({
  handleDragEnd,
  dataIds,
}: {
  handleDragEnd: (event: DragEndEvent) => void;
  dataIds: UniqueIdentifier[];
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
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="relative">
        <DataGridTableBase>
          <DataGridTableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <DataGridTableHeadRow headerGroup={headerGroup} key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const { column } = header;

                  return (
                    <DataGridTableHeadRowCell header={header} key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {props.tableLayout?.columnsResizable && column.getCanResize() && (
                        <DataGridTableHeadRowCellResize header={header} />
                      )}
                    </DataGridTableHeadRowCell>
                  );
                })}
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
              <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                {table.getRowModel().rows.map((row) => (
                  <DataGridTableDndRow row={row} key={row.id} />
                ))}
              </SortableContext>
            ) : (
              <DataGridTableEmpty />
            )}
          </DataGridTableBody>
        </DataGridTableBase>
      </div>
    </DndContext>
  );
};
