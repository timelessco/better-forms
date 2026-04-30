/* eslint-disable react-hooks/refs */

import type { Emoji } from "@emoji-mart/data";
import { EmojiSettings } from "@platejs/emoji";
import type { EmojiCategoryList, EmojiIconList, GridRow } from "@platejs/emoji";
import { useEmojiDropdownMenuState } from "@platejs/emoji/react";
import type { EmojiDropdownMenuOptions, UseEmojiPickerType } from "@platejs/emoji/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppleIcon, CompassIcon, FlagIcon, LeafIcon, LightbulbIcon, MusicIcon } from "lucide-react";
import { ClockIcon, SearchIcon, SmileIcon, StarIcon, XIcon } from "@/components/ui/icons";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { ToolbarButton } from "@/components/ui/toolbar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const EmojiToolbarButton = ({
  options,
  ...props
}: {
  options?: EmojiDropdownMenuOptions;
} & React.ComponentPropsWithoutRef<typeof ToolbarButton>) => {
  const { emojiPickerState, isOpen, setIsOpen } = useEmojiDropdownMenuState(options);

  return (
    <EmojiPopover
      control={
        <ToolbarButton pressed={isOpen} tooltip="Emoji" isDropdown {...props}>
          <SmileIcon />
        </ToolbarButton>
      }
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <EmojiPicker
        {...emojiPickerState}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        settings={options?.settings}
      />
    </EmojiPopover>
  );
};

export const EmojiPopover = ({
  children,
  control,
  isOpen,
  setIsOpen,
}: {
  children: React.ReactNode;
  control: React.ReactElement;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) => (
  <Popover open={isOpen} onOpenChange={setIsOpen}>
    <PopoverTrigger nativeButton={false} render={control} />
    <PopoverContent className="z-100 p-2.5">{children}</PopoverContent>
  </Popover>
);

export const EmojiPicker = ({
  clearSearch,
  emoji,
  emojiLibrary,
  focusedCategory,
  hasFound,
  i18n,
  icons = {
    categories: emojiCategoryIcons,
    search: emojiSearchIcons,
  },
  isSearching,
  refs,
  searchResult,
  searchValue,
  setSearch,
  settings = EmojiSettings,
  visibleCategories,
  handleCategoryClick,
  onMouseOver,
  onSelectEmoji,
}: Omit<UseEmojiPickerType, "icons"> & {
  icons?: EmojiIconList<React.ReactElement>;
}) => (
  <div
    className={cn(
      "flex flex-col rounded-xl bg-popover text-popover-foreground",
      "h-[23rem] w-80 border shadow-md",
    )}
  >
    <EmojiPickerNavigation
      onClick={handleCategoryClick}
      emojiLibrary={emojiLibrary}
      focusedCategory={focusedCategory}
      i18n={i18n}
      icons={icons}
    />
    <EmojiPickerSearchBar i18n={i18n} searchValue={searchValue} setSearch={setSearch}>
      <EmojiPickerSearchAndClear clearSearch={clearSearch} i18n={i18n} searchValue={searchValue} />
    </EmojiPickerSearchBar>
    <EmojiPickerContent
      onMouseOver={onMouseOver}
      onSelectEmoji={onSelectEmoji}
      emojiLibrary={emojiLibrary}
      i18n={i18n}
      isSearching={isSearching}
      refs={refs}
      searchResult={searchResult}
      settings={settings}
      visibleCategories={visibleCategories}
    />
    <EmojiPickerPreview emoji={emoji} hasFound={hasFound} i18n={i18n} isSearching={isSearching} />
  </div>
);

const EmojiButton = React.memo(function EmojiButton({
  emoji,
  index,
  onMouseOver,
  onSelect,
}: {
  emoji: Emoji;
  index: number;
  onMouseOver: (emoji?: Emoji) => void;
  onSelect: (emoji: Emoji) => void;
}) {
  return (
    <Button
      variant="ghost"
      className="group relative flex size-9 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-2xl hover:bg-transparent"
      onClick={() => onSelect(emoji)}
      onMouseEnter={() => onMouseOver(emoji)}
      onMouseLeave={() => onMouseOver()}
      aria-label={emoji.skins[0].native}
      data-index={index}
      tabIndex={-1}
    >
      <div
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100"
        aria-hidden="true"
      />
      <span
        className="relative"
        style={{
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", NotoColorEmoji, "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", EmojiSymbols',
        }}
        data-emoji-set="native"
      >
        {emoji.skins[0].native}
      </span>
    </Button>
  );
});

const RowOfButtons = React.memo(function RowOfButtons({
  emojiLibrary,
  row,
  onMouseOver,
  onSelectEmoji,
}: {
  row: GridRow;
} & Pick<UseEmojiPickerType, "emojiLibrary" | "onMouseOver" | "onSelectEmoji">) {
  return (
    <div key={row.id} className="flex" data-index={row.id}>
      {row.elements.map((emojiId, index) => (
        <EmojiButton
          key={emojiId}
          onMouseOver={onMouseOver}
          onSelect={onSelectEmoji}
          emoji={emojiLibrary.getEmoji(emojiId)}
          index={index}
        />
      ))}
    </div>
  );
});

const EmojiPickerContent = ({
  emojiLibrary,
  i18n,
  isSearching = false,
  refs,
  searchResult,
  settings = EmojiSettings,
  visibleCategories,
  onMouseOver,
  onSelectEmoji,
}: Pick<
  UseEmojiPickerType,
  | "emojiLibrary"
  | "i18n"
  | "isSearching"
  | "onMouseOver"
  | "onSelectEmoji"
  | "refs"
  | "searchResult"
  | "settings"
  | "visibleCategories"
>) => {
  const getRowWidth = settings.perLine.value * settings.buttonSize.value;

  const isCategoryVisible = React.useCallback(
    (categoryId: string) => {
      if (visibleCategories.size === 0) return true;
      const key = categoryId as Parameters<typeof visibleCategories.has>[0];
      return visibleCategories.has(key) ? visibleCategories.get(key) : false;
    },
    [visibleCategories],
  );

  const EmojiList = React.useCallback(
    () =>
      emojiLibrary
        .getGrid()
        .sections()
        .map(({ id: categoryId }) => {
          const section = emojiLibrary.getGrid().section(categoryId);
          const { buttonSize } = settings;

          return (
            <div
              key={categoryId}
              ref={section.root}
              style={{ width: getRowWidth }}
              data-id={categoryId}
            >
              <div className="sticky -top-px z-1 bg-popover/90 p-1 py-2 text-sm font-semibold backdrop-blur-xs">
                {i18n.categories[categoryId]}
              </div>
              <div
                className="relative flex flex-wrap"
                style={{ height: section.getRows().length * buttonSize.value }}
              >
                {isCategoryVisible(categoryId) &&
                  section
                    .getRows()
                    .map((row: GridRow) => (
                      <RowOfButtons
                        key={row.id}
                        onMouseOver={onMouseOver}
                        onSelectEmoji={onSelectEmoji}
                        emojiLibrary={emojiLibrary}
                        row={row}
                      />
                    ))}
              </div>
            </div>
          );
        }),
    [
      emojiLibrary,
      getRowWidth,
      i18n.categories,
      isCategoryVisible,
      onSelectEmoji,
      onMouseOver,
      settings,
    ],
  );

  const SearchList = React.useCallback(
    () => (
      <div style={{ width: getRowWidth }} data-id="search">
        <div className="sticky -top-px z-1 bg-popover/90 p-1 py-2 text-sm font-semibold text-card-foreground backdrop-blur-xs">
          {i18n.searchResult}
        </div>
        <div className="relative flex flex-wrap">
          {searchResult.map((emoji: Emoji, index: number) => (
            <EmojiButton
              key={emoji.id}
              onMouseOver={onMouseOver}
              onSelect={onSelectEmoji}
              emoji={emojiLibrary.getEmoji(emoji.id)}
              index={index}
            />
          ))}
        </div>
      </div>
    ),
    [emojiLibrary, getRowWidth, i18n.searchResult, searchResult, onSelectEmoji, onMouseOver],
  );

  return (
    <div
      ref={refs.current.contentRoot}
      className={cn(
        "h-full min-h-[50%] overflow-x-hidden overflow-y-auto px-2",
        "[&::-webkit-scrollbar]:w-4",
        "[&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-button]:size-0",
        "[&::-webkit-scrollbar-thumb]:min-h-11 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/25",
        "[&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-popover [&::-webkit-scrollbar-thumb]:bg-clip-padding",
      )}
      data-id="scroll"
    >
      <div ref={refs.current.content} className="h-full">
        {isSearching ? SearchList() : EmojiList()}
      </div>
    </div>
  );
};

const EmojiPickerSearchBar = ({
  children,
  i18n,
  searchValue,
  setSearch,
}: {
  children: React.ReactNode;
} & Pick<UseEmojiPickerType, "i18n" | "searchValue" | "setSearch">) => (
  <div className="flex items-center px-2">
    <div className="relative flex grow items-center">
      <input
        className="block w-full appearance-none rounded-full border-0 bg-muted px-10 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-none"
        value={searchValue}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={i18n.search}
        aria-label="Search"
        autoComplete="off"
        type="text"
      />
      {children}
    </div>
  </div>
);

const EmojiPickerSearchAndClear = ({
  clearSearch,
  i18n,
  searchValue,
}: Pick<UseEmojiPickerType, "clearSearch" | "i18n" | "searchValue">) => (
  <div className="flex items-center text-foreground">
    <div
      className={cn(
        "absolute top-1/2 left-2.5 z-10 flex size-5 -translate-y-1/2 items-center justify-center text-foreground",
      )}
    >
      {emojiSearchIcons.loupe}
    </div>
    {searchValue && (
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "absolute top-1/2 right-0.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-popover-foreground hover:bg-transparent",
        )}
        onClick={clearSearch}
        title={i18n.clear}
        aria-label="Clear"
        type="button"
      >
        {emojiSearchIcons.delete}
      </Button>
    )}
  </div>
);

const EmojiPreview = ({ emoji }: Pick<UseEmojiPickerType, "emoji">) => (
  <div className="flex h-14 max-h-14 min-h-14 items-center border-t border-muted p-2">
    <div className="flex items-center justify-center text-2xl">{emoji?.skins[0].native}</div>
    <div className="overflow-hidden pl-2">
      <div className="truncate text-sm font-semibold">{emoji?.name}</div>
      <div className="truncate text-sm">{`:${emoji?.id}:`}</div>
    </div>
  </div>
);

const NoEmoji = ({ i18n }: Pick<UseEmojiPickerType, "i18n">) => (
  <div className="flex h-14 max-h-14 min-h-14 items-center border-t border-muted p-2">
    <div className="flex items-center justify-center text-2xl">😢</div>
    <div className="overflow-hidden pl-2">
      <div className="truncate text-sm font-bold">{i18n.searchNoResultsTitle}</div>
      <div className="truncate text-sm">{i18n.searchNoResultsSubtitle}</div>
    </div>
  </div>
);

const PickAnEmoji = ({ i18n }: Pick<UseEmojiPickerType, "i18n">) => (
  <div className="flex h-14 max-h-14 min-h-14 items-center border-t border-muted p-2">
    <div className="flex items-center justify-center text-2xl">☝️</div>
    <div className="overflow-hidden pl-2">
      <div className="truncate text-sm font-semibold">{i18n.pick}</div>
    </div>
  </div>
);

const EmojiPickerPreview = ({
  emoji,
  hasFound = true,
  i18n,
  isSearching = false,
  ...props
}: Pick<UseEmojiPickerType, "emoji" | "hasFound" | "i18n" | "isSearching">) => {
  const showPickEmoji = !emoji && (!isSearching || hasFound);
  const showNoEmoji = isSearching && !hasFound;
  const showPreview = emoji && !showNoEmoji && !showNoEmoji;

  return (
    <>
      {showPreview && <EmojiPreview emoji={emoji} {...props} />}
      {showPickEmoji && <PickAnEmoji i18n={i18n} {...props} />}
      {showNoEmoji && <NoEmoji i18n={i18n} {...props} />}
    </>
  );
};

const EmojiPickerNavigation = ({
  emojiLibrary,
  focusedCategory,
  i18n,
  icons,
  onClick,
}: {
  onClick: (id: EmojiCategoryList) => void;
} & Pick<UseEmojiPickerType, "emojiLibrary" | "focusedCategory" | "i18n" | "icons">) => {
  const navigationId = React.useId();
  return (
    <TooltipProvider delay={500}>
      <nav
        id={navigationId}
        className="mb-2.5 border-0 border-b border-solid border-b-border p-1.5"
      >
        <div className="relative flex items-center justify-evenly">
          {emojiLibrary
            .getGrid()
            .sections()
            .map(({ id }) => (
              <Tooltip key={id}>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-fit rounded-full fill-current p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground",
                        id === focusedCategory &&
                          "pointer-events-none bg-accent fill-current text-accent-foreground",
                      )}
                      onClick={() => onClick(id)}
                      aria-label={i18n.categories[id]}
                      type="button"
                    />
                  }
                >
                  <span className="inline-flex size-5 items-center justify-center">
                    {icons.categories[id].outline}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">{i18n.categories[id]}</TooltipContent>
              </Tooltip>
            ))}
        </div>
      </nav>
    </TooltipProvider>
  );
};

const emojiCategoryIcons: Record<
  EmojiCategoryList,
  {
    outline: React.ReactElement;
    solid: React.ReactElement; // Needed to add another solid variant - outline will be used for now
  }
> = {
  activity: {
    outline: (
      <svg
        className="size-full"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Activity category icon</title>
        <circle cx="12" cy="12" r="10" />
        <path d="M2.1 13.4A10.1 10.1 0 0 0 13.4 2.1" />
        <path d="m5 4.9 14 14.2" />
        <path d="M21.9 10.6a10.1 10.1 0 0 0-11.3 11.3" />
      </svg>
    ),
    solid: (
      <svg
        className="size-full"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>Activity category icon</title>
        <circle cx="12" cy="12" r="10" />
        <path d="M2.1 13.4A10.1 10.1 0 0 0 13.4 2.1" />
        <path d="m5 4.9 14 14.2" />
        <path d="M21.9 10.6a10.1 10.1 0 0 0-11.3 11.3" />
      </svg>
    ),
  },

  custom: {
    outline: <StarIcon className="size-full" />,
    solid: <StarIcon className="size-full" />,
  },

  flags: {
    outline: <FlagIcon className="size-full" />,
    solid: <FlagIcon className="size-full" />,
  },

  foods: {
    outline: <AppleIcon className="size-full" />,
    solid: <AppleIcon className="size-full" />,
  },

  frequent: {
    outline: <ClockIcon className="size-full" />,
    solid: <ClockIcon className="size-full" />,
  },

  nature: {
    outline: <LeafIcon className="size-full" />,
    solid: <LeafIcon className="size-full" />,
  },

  objects: {
    outline: <LightbulbIcon className="size-full" />,
    solid: <LightbulbIcon className="size-full" />,
  },

  people: {
    outline: <SmileIcon className="size-full" />,
    solid: <SmileIcon className="size-full" />,
  },

  places: {
    outline: <CompassIcon className="size-full" />,
    solid: <CompassIcon className="size-full" />,
  },

  symbols: {
    outline: <MusicIcon className="size-full" />,
    solid: <MusicIcon className="size-full" />,
  },
};

const emojiSearchIcons = {
  delete: <XIcon className="size-4 text-current" />,
  loupe: <SearchIcon className="size-4 text-current" />,
};
