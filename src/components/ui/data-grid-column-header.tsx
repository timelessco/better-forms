import { HTMLAttributes, ReactNode, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Search,
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
  /** Per-column search: hover reveals a search icon; click swaps the header for a filter input. */
  searchable?: boolean;
}

// Column-header label that truncates and, only when actually overflowing, shows the full text
// in a styled tooltip (Figma 26582-15457). Overflow is measured via a callback ref (no effect).
const TruncatedLabel = ({ title }: { title: string }) => {
  const [truncated, setTruncated] = useState(false);
  // ResizeObserver (not just mount) so truncation re-measures as columns resize/settle.
  // React 19 ref-cleanup disconnects it — no useEffect needed.
  const measureRef = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    const update = () => setTruncated(el.scrollWidth > el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Always wrap in the Tooltip with a STABLE trigger span — the ResizeObserver target never moves
  // between DOM positions, so it can't remount/oscillate at the overflow threshold. Only the
  // tooltip *content* is gated on actual overflow.
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span ref={measureRef} className="truncate">
            {title}
          </span>
        }
      />
      {truncated && <TooltipContent>{title}</TooltipContent>}
    </Tooltip>
  );
};

export const DataGridColumnHeader = <TData extends RowData, TValue>({
  column,
  title = "",
  icon,
  className,
  filter,
  visibility = false,
  searchable = false,
}: DataGridColumnHeaderProps<TData, TValue>) => {
  const { isLoading, table, props, recordCount } = useDataGrid();
  const sortDirection = useColumnSorted(table, column.id);
  const pinDirection = useColumnPinned(table, column.id);

  // Per-column search (Figma 27015:17071/18967): hover → search icon; click → in-header filter input.
  const [isSearching, setIsSearching] = useState(false);
  const filterValue = (column.getFilterValue() as string | undefined) ?? "";
  const canSearch = searchable && column.getCanFilter();

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
    >
      <span className="inline-flex shrink-0">{icon}</span>
      <TruncatedLabel title={title} />
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
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="inline-flex shrink-0">{icon}</span>
        <TruncatedLabel title={title} />
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

  // In-header filter input (Figma 27015:18967): the column header becomes a search box scoped to
  // this column. Esc / empty-blur exits; clearing also clears the column filter.
  const searchInput = (
    <div className="flex h-full w-full items-center">
      {/* Figma 27015:18967 — subtle gray rounded pill, gray placeholder + trailing search glyph. */}
      <div className="flex h-7 w-full items-center gap-1.5 rounded-lg border border-gray-300 bg-background px-2">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus lands on the field the user opened
          autoFocus
          value={filterValue}
          onChange={(e) => column.setFilterValue(e.target.value || undefined)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              column.setFilterValue(undefined);
              setIsSearching(false);
            }
          }}
          onBlur={() => {
            if (!filterValue) setIsSearching(false);
          }}
          placeholder={title}
          aria-label={`Search ${title}`}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-normal text-gray-700 outline-none placeholder:text-gray-500"
        />
        <Search className="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
      </div>
    </div>
  );

  // Wrap a header body with the hover search affordance. A block wrapper with right padding shrinks
  // the body's content box so the title truncates (→ "…") within it; the icon sits absolutely in
  // that reserved gap, so it never overlaps the label. Padding is always present (no hover shift).
  const withSearch = (body: ReactNode): ReactNode =>
    canSearch ? (
      <div className="group/colsearch relative h-full pr-7">
        {body}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSearching(true);
          }}
          aria-label={`Search ${title}`}
          className="absolute end-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/colsearch:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
        >
          <Search className="size-3.5" />
        </button>
      </div>
    ) : (
      body
    );

  if (canSearch && isSearching) return searchInput;

  if (
    props.tableLayout?.columnsMovable ||
    (props.tableLayout?.columnsVisibility && visibility) ||
    (props.tableLayout?.columnsPinnable && column.getCanPin()) ||
    filter
  ) {
    return withSearch(headerControls);
  }

  if (column.getCanSort() || (props.tableLayout?.columnsResizable && column.getCanResize())) {
    return withSearch(<div className="flex h-full items-center">{headerButton}</div>);
  }

  return withSearch(headerLabel);
};

export { type DataGridColumnHeaderProps };
