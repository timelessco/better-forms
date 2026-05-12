import { ReactNode, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useDataGrid } from "@/components/ui/data-grid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type PageButtonsProps = {
  btnBaseClasses: string;
  currentGroupEnd: number;
  currentGroupStart: number;
  pageIndex: number;
  setPageIndex: (i: number) => void;
};

const PageButtons = ({
  btnBaseClasses,
  currentGroupEnd,
  currentGroupStart,
  pageIndex,
  setPageIndex,
}: PageButtonsProps) => {
  const buttons: ReactNode[] = [];
  for (let i = currentGroupStart; i < currentGroupEnd; i++) {
    buttons.push(
      <Button
        // eslint-disable-next-line react-doctor/no-array-index-as-key -- page index IS the stable identity here
        key={i}
        size="sm"
        variant="ghost"
        className={cn(btnBaseClasses, "text-muted-foreground", {
          "bg-accent text-accent-foreground": pageIndex === i,
        })}
        onClick={() => {
          if (pageIndex !== i) {
            setPageIndex(i);
          }
        }}
      >
        {i + 1}
      </Button>,
    );
  }
  return <>{buttons}</>;
};

type EllipsisButtonProps = {
  btnBaseClasses: string;
  ellipsisText: string | undefined;
  onClick: () => void;
  visible: boolean;
};

const EllipsisButton = ({
  btnBaseClasses,
  ellipsisText,
  onClick,
  visible,
}: EllipsisButtonProps) => {
  if (!visible) return null;
  return (
    <Button size="sm" className={btnBaseClasses} variant="ghost" onClick={onClick}>
      {ellipsisText}
    </Button>
  );
};

interface DataGridPaginationProps {
  sizes?: number[];
  sizesInfo?: string;
  sizesLabel?: string;
  sizesDescription?: string;
  sizesSkeleton?: ReactNode;
  more?: boolean;
  moreLimit?: number;
  info?: string;
  infoSkeleton?: ReactNode;
  className?: string;
  rowsPerPageLabel?: string;
  previousPageLabel?: string;
  nextPageLabel?: string;
  ellipsisText?: string;
}

export const DataGridPagination = (props: DataGridPaginationProps) => {
  const { table, recordCount, isLoading } = useDataGrid();

  const defaultProps: Partial<DataGridPaginationProps> = {
    sizes: [5, 10, 25, 50, 100],
    sizesLabel: "Show",
    sizesDescription: "per page",
    sizesSkeleton: <Skeleton className="h-8 w-44" />,
    moreLimit: 5,
    more: false,
    info: "{from} - {to} of {count}",
    infoSkeleton: <Skeleton className="h-8 w-60" />,
    rowsPerPageLabel: "Rows per page",
    previousPageLabel: "Go to previous page",
    nextPageLabel: "Go to next page",
    ellipsisText: "\u2026",
  };

  const mergedProps: DataGridPaginationProps = { ...defaultProps, ...props };

  const btnBaseClasses = "size-7 p-0 text-sm";
  const btnArrowClasses = btnBaseClasses + " rtl:transform rtl:rotate-180";
  const pageIndex = table.state.pagination.pageIndex;
  const pageSize = table.state.pagination.pageSize;
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, recordCount);
  const pageCount = table.getPageCount();

  const paginationInfo = mergedProps?.info
    ? mergedProps.info
        .replace("{from}", from.toString())
        .replace("{to}", to.toString())
        .replace("{count}", recordCount.toString())
    : `${from} - ${to} of ${recordCount}`;

  const paginationMoreLimit = mergedProps?.moreLimit || 5;

  const currentGroupStart = Math.floor(pageIndex / paginationMoreLimit) * paginationMoreLimit;
  const currentGroupEnd = Math.min(currentGroupStart + paginationMoreLimit, pageCount);

  const handlePageSizeChange = useCallback(
    (value: string | null) => {
      const newPageSize = Number(value);
      table.setPageSize(newPageSize);
    },
    [table],
  );

  const handlePreviousPage = useCallback(() => table.previousPage(), [table]);
  const handleNextPage = useCallback(() => table.nextPage(), [table]);

  const setPageIndex = useCallback((i: number) => table.setPageIndex(i), [table]);

  const handleEllipsisPrev = useCallback(
    () => table.setPageIndex(currentGroupStart - 1),
    [table, currentGroupStart],
  );

  const handleEllipsisNext = useCallback(
    () => table.setPageIndex(currentGroupEnd),
    [table, currentGroupEnd],
  );

  return (
    <div
      data-slot="data-grid-pagination"
      className={cn(
        "flex grow flex-col flex-wrap items-center justify-between gap-2.5 py-2.5 sm:flex-row sm:py-0",
        mergedProps?.className,
      )}
    >
      <div className="order-2 flex flex-wrap items-center gap-x-2.5 pb-2.5 sm:order-1 sm:pb-0">
        {isLoading ? (
          mergedProps?.sizesSkeleton
        ) : (
          <>
            <div className="text-sm text-muted-foreground">{mergedProps.rowsPerPageLabel}</div>
            <Select value={`${pageSize}`} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-fit" size="sm">
                <SelectValue placeholder={`${pageSize}`} />
              </SelectTrigger>
              <SelectContent side="top" className="min-w-[50px]">
                {mergedProps?.sizes?.map((size: number) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
      <div className="order-1 flex flex-col items-center justify-center gap-2.5 pt-2.5 sm:order-2 sm:flex-row sm:justify-end sm:pt-0">
        {isLoading ? (
          mergedProps?.infoSkeleton
        ) : (
          <>
            <div className="order-2 text-sm text-nowrap text-muted-foreground sm:order-1">
              {paginationInfo}
            </div>
            {pageCount > 1 && (
              <div className="order-1 flex items-center gap-x-1 sm:order-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className={btnArrowClasses}
                  onClick={handlePreviousPage}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">{mergedProps.previousPageLabel}</span>
                  <ChevronLeftIcon className="size-4" />
                </Button>

                <EllipsisButton
                  btnBaseClasses={btnBaseClasses}
                  ellipsisText={mergedProps.ellipsisText}
                  onClick={handleEllipsisPrev}
                  visible={currentGroupStart > 0}
                />
                <PageButtons
                  btnBaseClasses={btnBaseClasses}
                  currentGroupEnd={currentGroupEnd}
                  currentGroupStart={currentGroupStart}
                  pageIndex={pageIndex}
                  setPageIndex={setPageIndex}
                />
                <EllipsisButton
                  btnBaseClasses={btnBaseClasses}
                  ellipsisText={mergedProps.ellipsisText}
                  onClick={handleEllipsisNext}
                  visible={currentGroupEnd < pageCount}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className={btnArrowClasses}
                  onClick={handleNextPage}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">{mergedProps.nextPageLabel}</span>
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export { type DataGridPaginationProps };
