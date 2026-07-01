import {
  HTMLAttributes,
  ReactNode,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
  Settings2,
} from "lucide-react";
import { FigSearchAltIcon } from "@/components/dashboard/dashboard-icons";

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

// Which column currently shows its in-header search input. Kept in a MODULE-LEVEL store (not
// component state) so the flag survives a header remount: committing a column filter re-renders
// the data grid and remounts the header cell, which would reset a local `useState(false)` and
// snap the cell back to its label — losing the input and its focus. Only one column searches at a
// time, which is the desired behavior. Reading goes through useSyncExternalStore (no useEffect).
const colSearchStore = {
  current: null as string | null,
  listeners: new Set<() => void>(),
  subscribe: (listener: () => void) => {
    colSearchStore.listeners.add(listener);
    return () => colSearchStore.listeners.delete(listener);
  },
  get: (): string | null => colSearchStore.current,
  set: (id: string | null) => {
    if (colSearchStore.current === id) return;
    colSearchStore.current = id;
    colSearchStore.listeners.forEach((listener) => listener());
  },
};

// Per-column search input (Figma 27015:18967). The value lives in LOCAL state and the commit to
// column.setFilterValue is debounced, so typing never re-renders the table mid-keystroke — the
// input can't remount or lose focus. This is the TanStack "DebouncedInput" filter pattern
// (https://github.com/tanstack/table .../examples/react/filters), done without useEffect.
const ColumnSearchInput = <TData extends RowData, TValue>({
  column,
  title,
  onExit,
}: {
  column: Column<DataGridFeatures, TData, TValue>;
  title: string;
  onExit: () => void;
}) => {
  const [value, setValue] = useState((column.getFilterValue() as string | undefined) ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = useCallback(
    (next: string) => {
      setValue(next);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => column.setFilterValue(next || undefined), 250);
    },
    [column],
  );

  return (
    <div className="flex h-full w-full items-center">
      {/* Figma 27015:18967 — gray/100 fill, 7px radius, px-8/py-6, no icon, gray-600 13px/420 text. */}
      <div className="flex h-7 w-full items-center rounded-[7px] bg-secondary px-2">
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus lands on the field the user opened
          autoFocus
          value={value}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              clearTimeout(debounceRef.current);
              column.setFilterValue(undefined);
              onExit();
            }
          }}
          onBlur={() => {
            // flush the pending debounce; exit back to the header only when left empty
            clearTimeout(debounceRef.current);
            column.setFilterValue(value || undefined);
            if (!value) onExit();
          }}
          placeholder={title}
          aria-label={`Search ${title}`}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-[420] tracking-[0.26px] text-gray-600 outline-none placeholder:text-gray-500"
        />
      </div>
    </div>
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
  // isSearching reads a module store (not useState) so it survives the header remount on filter commit.
  const searchingColumnId = useSyncExternalStore(
    colSearchStore.subscribe,
    colSearchStore.get,
    colSearchStore.get,
  );
  const isSearching = searchingColumnId === column.id;
  const canSearch = searchable && column.getCanFilter();
  const openSearch = useCallback(() => colSearchStore.set(column.id), [column.id]);
  const exitSearch = useCallback(() => colSearchStore.set(null), []);

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
            openSearch();
          }}
          aria-label={`Search ${title}`}
          // Figma 27015:17071 — revealed icon only, no background pill; darkens on direct hover.
          className="absolute end-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground opacity-0 transition-[opacity,color] group-hover/colsearch:opacity-100 hover:text-gray-800 focus-visible:opacity-100"
        >
          <FigSearchAltIcon className="size-4" />
        </button>
      </div>
    ) : (
      body
    );

  if (canSearch && isSearching)
    return <ColumnSearchInput column={column} title={title} onExit={exitSearch} />;

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
