import { useCallback, useMemo, useState } from "react";
import { matchSorter } from "match-sorter";
import { NumberPopIn } from "@/components/transitions/number-pop-in";

import { ColorPicker } from "./color-picker";
import { iconOptions } from "./icon-data";
import type { IconPickerProps } from "./types";

const ICONS_PER_PAGE = 99;
const ROW_SIZE = 11;

const allLabels = iconOptions.map((item) => item.label);
const totalPages = Math.ceil(iconOptions.length / ICONS_PER_PAGE);

export type IconPickerContentProps = Omit<IconPickerProps, "buttonIconSize"> & {
  colors?: string[];
  /** Hide the color row (icon renders in `currentColor`, so color is meaningless). */
  hideColors?: boolean;
};

export const IconPickerContent = ({
  iconColor,
  iconValue: _iconValue,
  onColorChange,
  onIconChange,
  colors,
  hideColors = false,
}: IconPickerContentProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const handleColorChange = useCallback(
    (sliderColor: string) => {
      onColorChange(sliderColor);
    },
    [onColorChange],
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setSearchValue(event.target.value),
    [],
  );

  const handleNextPage = useCallback(() => setPageIndex((prev) => prev + 1), []);
  const handlePrevPage = useCallback(() => setPageIndex((prev) => prev - 1), []);

  const isSearching = searchValue.length > 1;

  const filteredLabels = useMemo(() => {
    if (!isSearching) {
      const start = pageIndex * ICONS_PER_PAGE;
      return allLabels.slice(start, start + ICONS_PER_PAGE);
    }

    return matchSorter(allLabels, searchValue);
  }, [isSearching, pageIndex, searchValue]);

  return (
    <div className="h-[368px] w-[310px] bg-muted/50 px-3">
      <IconPickerHeader searchValue={searchValue} onSearchChange={handleSearchChange} />
      {!hideColors && (
        <div
          className="icon-color-container overflow-x-auto pt-2"
          style={{ scrollbarWidth: "none" }}
        >
          <ColorPicker onChange={handleColorChange} selectedColor={iconColor} colors={colors} />
        </div>
      )}
      <div
        className={`flex flex-col overflow-y-auto pt-2 pb-3 ${hideColors ? "h-[300px]" : "h-[253px]"}`}
        style={{ scrollbarWidth: "none" }}
      >
        <IconGrid labels={filteredLabels} onSelect={onIconChange} />
        {!isSearching && (
          <IconPagination
            currentPage={pageIndex + 1}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            totalPages={totalPages}
          />
        )}
      </div>
    </div>
  );
};

type IconPickerHeaderProps = {
  searchValue: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const IconPickerHeader = ({ searchValue, onSearchChange }: IconPickerHeaderProps) => (
  <div className="flex items-center justify-between border-b border-b-border py-3">
    <span className="text-sm text-foreground">Choose an icon</span>
    <div className="flex w-[139px] items-center rounded-lg bg-muted px-[10px] py-[7px]">
      <figure className="mr-[6px] size-3 text-muted-foreground">
        <svg
          fill="none"
          height="12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="12"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </figure>
      <input
        aria-label="Search icons"
        className="w-[101px] bg-muted text-sm font-normal text-muted-foreground focus:outline-hidden"
        onChange={onSearchChange}
        placeholder="Search..."
        type="text"
        value={searchValue}
      />
    </div>
  </div>
);

type IconGridProps = {
  labels: string[];
  onSelect: (icon: string) => void;
};

const IconGrid = ({ labels, onSelect }: IconGridProps) => {
  const rows = useMemo(() => {
    const result: string[][] = [];
    for (let index = 0; index < labels.length; index += ROW_SIZE) {
      result.push(labels.slice(index, index + ROW_SIZE));
    }

    return result;
  }, [labels]);

  return (
    <div style={{ contentVisibility: "auto", containIntrinsicSize: "auto 200px" }}>
      {rows.map((row) => (
        <div className="flex justify-start" key={row[0]}>
          {row.map((label) => (
            <IconGridItem key={label} label={label} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
};

type IconGridItemProps = {
  label: string;
  onSelect: (icon: string) => void;
};

const IconGridItem = ({ label, onSelect }: IconGridItemProps) => {
  const data = iconOptions.find((item) => item.label === label);
  const iconColor = "currentColor";

  return (
    <button
      className="custom-select rounded-md p-1 hover:bg-muted"
      onClick={() => onSelect(label)}
      title={data?.label}
      type="button"
    >
      <div className="size-[18px]">{data?.icon(iconColor)}</div>
    </button>
  );
};

type IconPaginationProps = {
  currentPage: number;
  onNext: () => void;
  onPrev: () => void;
  totalPages: number;
};

const IconPagination = ({
  currentPage,
  onNext,
  onPrev,
  totalPages: pageCount,
}: IconPaginationProps) => (
  <div className="absolute bottom-2 left-0 flex w-full justify-between px-2 pt-2">
    <button
      className="text-13 flex items-center rounded-lg px-2 py-[5px] text-foreground hover:bg-muted disabled:opacity-50"
      disabled={currentPage === 1}
      onClick={onPrev}
      type="button"
    >
      prev
    </button>
    <span className="text-13 text-foreground">
      <NumberPopIn value={currentPage} />/<NumberPopIn value={pageCount} />
    </span>
    <button
      className="text-13 flex items-center rounded-lg px-2 py-[5px] text-foreground hover:bg-muted disabled:opacity-50"
      disabled={currentPage === pageCount}
      onClick={onNext}
      type="button"
    >
      next
    </button>
  </div>
);
