import { HTMLAttributes, ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useColumnPinned, useColumnSorted, useDataGrid } from "@/components/ui/data-grid";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Column, RowData } from "@tanstack/table-core";

import type { DataGridFeatures } from "@/components/ui/data-grid";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  PinOff,
  Settings2,
} from "lucide-react";

interface DataGridColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends HTMLAttributes<HTMLDivElement> {
  column: Column<DataGridFeatures, TData, TValue>;
  title?: string;
  icon?: ReactNode;
  filter?: ReactNode;
  visibility?: boolean;
}

export const DataGridColumnHeader = <TData extends RowData, TValue>({
  column,
  title = "",
  icon,
  className,
  filter,
  visibility = false,
}: DataGridColumnHeaderProps<TData, TValue>) => {
  const { isLoading, table, props, recordCount } = useDataGrid();
  const sortDirection = useColumnSorted(table, column.id);
  const pinDirection = useColumnPinned(table, column.id);

  const getFullOrder = () => {
    const stateOrder = table.state.columnOrder;
    return stateOrder.length > 0 ? stateOrder : table.getAllLeafColumns().map((c) => c.id);
  };

  // adjacent VISIBLE column; hidden cols would make index-splice a visual no-op
  const getVisibleNeighbor = (direction: "left" | "right") => {
    const visible = table.getVisibleLeafColumns();
    const index = column.getIndex();
    const neighbor = visible[direction === "left" ? index - 1 : index + 1];
    // never swap with select checkbox column
    if (!neighbor || neighbor.id === "select") return undefined;
    // order splice can't cross a pin region — disable instead of silently no-oping
    if (neighbor.getIsPinned() !== column.getIsPinned()) return undefined;
    return neighbor;
  };

  const canMove = (direction: "left" | "right"): boolean =>
    getVisibleNeighbor(direction) !== undefined;

  const moveColumn = useCallback(
    (direction: "left" | "right") => {
      const neighbor = getVisibleNeighbor(direction);
      if (!neighbor) return;
      const newOrder = [...getFullOrder()];
      const [moved] = newOrder.splice(newOrder.indexOf(column.id), 1);
      // splice relative to neighbor's slot in FULL order so hidden cols are crossed in one move
      const neighborIndex = newOrder.indexOf(neighbor.id);
      newOrder.splice(direction === "left" ? neighborIndex : neighborIndex + 1, 0, moved);
      table.setColumnOrder(newOrder);
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- getVisibleNeighbor and getFullOrder read from table state
    [table, column],
  );

  const headerLabel = (
    <div
      className={cn(
        "inline-flex h-full min-w-0 items-center gap-1.5 text-[0.8125rem] font-normal text-secondary-foreground/80 [&_svg]:size-3.5 [&_svg]:opacity-60",
        className,
      )}
      title={title}
    >
      <span className="inline-flex shrink-0">{icon}</span>
      <span className="truncate">{title}</span>
    </div>
  );

  // built-in: gates getCanSort, shift-click multi-sort, honors getNextSortingOrder/sortDescFirst
  const handleSort = column.getToggleSortingHandler();

  const handleUnpin = useCallback(() => column.pin(false), [column]);

  const handleSortAsc = useCallback(() => {
    if (sortDirection === "asc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  }, [column, sortDirection]);

  const handleSortDesc = useCallback(() => {
    if (sortDirection === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(true);
    }
  }, [column, sortDirection]);

  const handlePinLeft = useCallback(
    () => column.pin(pinDirection === "left" ? false : "left"),
    [column, pinDirection],
  );

  const handlePinRight = useCallback(
    () => column.pin(pinDirection === "right" ? false : "right"),
    [column, pinDirection],
  );

  const handleMoveLeft = useCallback(() => moveColumn("left"), [moveColumn]);
  const handleMoveRight = useCallback(() => moveColumn("right"), [moveColumn]);

  const headerButtonProps = {
    variant: "ghost" as const,
    className: cn(
      "size-full justify-between rounded-none px-2 font-normal text-secondary-foreground/80 hover:bg-transparent! aria-expanded:bg-transparent! data-[state=open]:bg-transparent!",
      className,
    ),
    disabled: isLoading || recordCount === 0,
    onClick: handleSort,
  };

  // Base UI merges render-element props; keep onClick off the trigger or one click sorts AND opens menu
  const { onClick: _sortClick, ...triggerProps } = headerButtonProps;

  const headerButtonContent = (
    <>
      <span className="inline-flex min-w-0 items-center gap-1.5" title={title}>
        <span className="inline-flex shrink-0">{icon}</span>
        <span className="truncate">{title}</span>
      </span>
      {column.getCanSort() &&
        (sortDirection === "desc" ? (
          <ArrowDown className="mt-px size-[0.7rem]!" aria-hidden="true" />
        ) : sortDirection === "asc" ? (
          <ArrowUp className="mt-px size-[0.7rem]!" aria-hidden="true" />
        ) : null)}
    </>
  );

  const headerButton = <Button {...headerButtonProps}>{headerButtonContent}</Button>;

  const headerPin = (
    <Button
      size="sm"
      variant="ghost"
      className="-me-1 size-7 rounded-md"
      onClick={handleUnpin}
      aria-label={`Unpin ${title} column`}
      title={`Unpin ${title} column`}
    >
      <PinOff className="size-3.5! opacity-50!" aria-hidden="true" />
    </Button>
  );

  const headerControls = (
    <div className="flex h-full items-center justify-between gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button {...triggerProps} />}>
          {headerButtonContent}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="start">
          {filter && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>{filter}</DropdownMenuLabel>
            </DropdownMenuGroup>
          )}

          {filter && (column.getCanSort() || column.getCanPin() || visibility) && (
            <DropdownMenuSeparator />
          )}

          {column.getCanSort() && (
            <>
              <DropdownMenuItem onClick={handleSortAsc} disabled={!column.getCanSort()}>
                <ArrowUp className="size-3.5!" />
                <span className="grow">Asc</span>
                {sortDirection === "asc" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSortDesc} disabled={!column.getCanSort()}>
                <ArrowDown className="size-3.5!" />
                <span className="grow">Desc</span>
                {sortDirection === "desc" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
            </>
          )}

          {(filter || column.getCanSort()) &&
            props.tableLayout?.columnsPinnable &&
            column.getCanPin() && <DropdownMenuSeparator />}

          {props.tableLayout?.columnsPinnable && column.getCanPin() && (
            <>
              <DropdownMenuItem onClick={handlePinLeft}>
                <ArrowLeftToLine className="size-3.5!" aria-hidden="true" />
                <span className="grow">Pin to left</span>
                {pinDirection === "left" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePinRight}>
                <ArrowRightToLine className="size-3.5!" aria-hidden="true" />
                <span className="grow">Pin to right</span>
                {pinDirection === "right" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
            </>
          )}

          {props.tableLayout?.columnsMovable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleMoveLeft}
                disabled={!canMove("left") || column.getIsPinned() !== false}
              >
                <ArrowLeftIcon className="size-3.5!" aria-hidden="true" />
                <span>Move to Left</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleMoveRight}
                disabled={!canMove("right") || column.getIsPinned() !== false}
              >
                <ArrowRightIcon className="size-3.5!" aria-hidden="true" />
                <span>Move to Right</span>
              </DropdownMenuItem>
            </>
          )}

          {props.tableLayout?.columnsVisibility &&
            visibility &&
            (column.getCanSort() || column.getCanPin() || filter) && <DropdownMenuSeparator />}

          {props.tableLayout?.columnsVisibility && visibility && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Settings2 className="size-3.5!" />
                <span>Columns</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {table.getAllColumns().flatMap((col) => {
                    if (typeof col.accessorFn === "undefined" || !col.getCanHide()) return [];
                    return [
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(value) => col.toggleVisibility(!!value)}
                        className="capitalize"
                      >
                        {col.columnDef.meta?.headerTitle || col.id}
                      </DropdownMenuCheckboxItem>,
                    ];
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {props.tableLayout?.columnsPinnable &&
        column.getCanPin() &&
        column.getIsPinned() &&
        headerPin}
    </div>
  );

  if (
    props.tableLayout?.columnsMovable ||
    (props.tableLayout?.columnsVisibility && visibility) ||
    (props.tableLayout?.columnsPinnable && column.getCanPin()) ||
    filter
  ) {
    return headerControls;
  }

  if (column.getCanSort() || (props.tableLayout?.columnsResizable && column.getCanResize())) {
    return <div className="flex h-full items-center">{headerButton}</div>;
  }

  return headerLabel;
};

export { type DataGridColumnHeaderProps };
