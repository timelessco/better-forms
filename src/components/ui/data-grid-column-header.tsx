import { HTMLAttributes, ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDataGrid } from "@/components/ui/data-grid";
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
import { Column } from "@tanstack/react-table";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  PinOff,
  Settings2,
} from "lucide-react";

interface DataGridColumnHeaderProps<TData, TValue> extends HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title?: string;
  icon?: ReactNode;
  filter?: ReactNode;
  visibility?: boolean;
}

export const DataGridColumnHeader = <TData, TValue>({
  column,
  title = "",
  icon,
  className,
  filter,
  visibility = false,
}: DataGridColumnHeaderProps<TData, TValue>) => {
  const { isLoading, table, props, recordCount } = useDataGrid();

  const getColumnPosition = () => {
    const stateOrder = table.getState().columnOrder;
    const order = stateOrder.length > 0 ? stateOrder : table.getAllLeafColumns().map((c) => c.id);
    const index = order.indexOf(column.id);
    return { order, index };
  };

  const canMove = (direction: "left" | "right"): boolean => {
    const { order, index } = getColumnPosition();
    return direction === "left" ? index > 0 : index < order.length - 1;
  };

  const moveColumn = useCallback(
    (direction: "left" | "right") => {
      if (!canMove(direction)) return;
      const { order, index } = getColumnPosition();
      const newOrder = [...order];
      const [moved] = newOrder.splice(index, 1);
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      newOrder.splice(targetIndex, 0, moved);
      table.setColumnOrder(newOrder);
    },
    // eslint-disable-next-line eslint-plugin-react-hooks/exhaustive-deps -- canMove and getColumnPosition read from table state
    [table],
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

  const handleSort = useCallback(() => {
    const isSorted = column.getIsSorted();
    if (isSorted === "asc") {
      column.toggleSorting(true);
    } else if (isSorted === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  }, [column]);

  const handleUnpin = useCallback(() => column.pin(false), [column]);

  const handleSortAsc = useCallback(() => {
    if (column.getIsSorted() === "asc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  }, [column]);

  const handleSortDesc = useCallback(() => {
    if (column.getIsSorted() === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(true);
    }
  }, [column]);

  const handlePinLeft = useCallback(
    () => column.pin(column.getIsPinned() === "left" ? false : "left"),
    [column],
  );

  const handlePinRight = useCallback(
    () => column.pin(column.getIsPinned() === "right" ? false : "right"),
    [column],
  );

  const handleMoveLeft = useCallback(() => moveColumn("left"), [moveColumn]);
  const handleMoveRight = useCallback(() => moveColumn("right"), [moveColumn]);

  const headerButtonProps = {
    variant: "ghost" as const,
    className: cn(
      "h-full w-full justify-between rounded-none px-2 font-normal text-secondary-foreground/80 hover:bg-transparent! aria-expanded:bg-transparent! data-[state=open]:bg-transparent!",
      className,
    ),
    disabled: isLoading || recordCount === 0,
    onClick: handleSort,
  };

  const headerButtonContent = (
    <>
      <span className="inline-flex min-w-0 items-center gap-1.5" title={title}>
        <span className="inline-flex shrink-0">{icon}</span>
        <span className="truncate">{title}</span>
      </span>
      {column.getCanSort() &&
        (column.getIsSorted() === "desc" ? (
          <ArrowDown className="mt-px size-[0.7rem]!" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="mt-px size-[0.7rem]!" />
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
        <DropdownMenuTrigger render={<Button {...headerButtonProps} />}>
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
                {column.getIsSorted() === "asc" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSortDesc} disabled={!column.getCanSort()}>
                <ArrowDown className="size-3.5!" />
                <span className="grow">Desc</span>
                {column.getIsSorted() === "desc" && (
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
                {column.getIsPinned() === "left" && (
                  <CheckIcon className="size-4 text-primary opacity-100!" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePinRight}>
                <ArrowRightToLine className="size-3.5!" aria-hidden="true" />
                <span className="grow">Pin to right</span>
                {column.getIsPinned() === "right" && (
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
                  {table
                    .getAllColumns()
                    .filter((col) => typeof col.accessorFn !== "undefined" && col.getCanHide())
                    .map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(value) => col.toggleVisibility(!!value)}
                        className="capitalize"
                      >
                        {col.columnDef.meta?.headerTitle || col.id}
                      </DropdownMenuCheckboxItem>
                    ))}
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
