import { toUnitLess } from "@platejs/basic-styles";
import { FontSizePlugin } from "@platejs/basic-styles/react";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { ToolbarButton } from "./toolbar";

const DEFAULT_FONT_SIZE = "16";

const FONT_SIZE_MAP = {
  h1: "36",
  h2: "24",
  h3: "20",
} as const;

const FONT_SIZES = [
  "8",
  "9",
  "10",
  "12",
  "14",
  "16",
  "18",
  "24",
  "30",
  "36",
  "48",
  "60",
  "72",
  "96",
] as const;

// eslint-disable-next-line typescript-eslint/no-explicit-any
const cursorFontSizeSelector = (editor: any) => {
  const fontSize = editor.api.marks()?.[KEYS.fontSize];

  if (fontSize) {
    return toUnitLess(fontSize as string);
  }

  const [block] = editor.api.block() || [];

  if (!block?.type) return DEFAULT_FONT_SIZE;

  return block.type in FONT_SIZE_MAP
    ? FONT_SIZE_MAP[block.type as keyof typeof FONT_SIZE_MAP]
    : DEFAULT_FONT_SIZE;
};

export const FontSizeToolbarButton = () => {
  const [inputValue, setInputValue] = React.useState(DEFAULT_FONT_SIZE);
  const [isFocused, setIsFocused] = React.useState(false);
  const { editor, tf } = useEditorPlugin(FontSizePlugin);

  const cursorFontSize = useEditorSelector(cursorFontSizeSelector, []);

  const handleInputChange = React.useCallback(() => {
    const newSize = toUnitLess(inputValue);

    if (Number.parseInt(newSize, 10) < 1 || Number.parseInt(newSize, 10) > 100) {
      editor.tf.focus();

      return;
    }
    if (newSize !== toUnitLess(cursorFontSize)) {
      tf.fontSize.addMark(`${newSize}px`);
    }

    editor.tf.focus();
  }, [inputValue, cursorFontSize, editor, tf]);

  const displayValue = isFocused ? inputValue : cursorFontSize;

  const handleDecrease = React.useCallback(() => {
    const newSize = Number(displayValue) + -1;
    tf.fontSize.addMark(`${newSize}px`);
    editor.tf.focus();
  }, [displayValue, tf, editor]);

  const handleIncrease = React.useCallback(() => {
    const newSize = Number(displayValue) + 1;
    tf.fontSize.addMark(`${newSize}px`);
    editor.tf.focus();
  }, [displayValue, tf, editor]);

  const commitOnBlur = React.useCallback(() => {
    setIsFocused(false);
    handleInputChange();
  }, [handleInputChange]);

  const updateInputValue = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const enterFocusedMode = React.useCallback(() => {
    setIsFocused(true);
    setInputValue(toUnitLess(cursorFontSize));
  }, [cursorFontSize]);

  const commitOnEnterKey = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInputChange();
      }
    },
    [handleInputChange],
  );

  const applySizePreset = React.useCallback(
    (size: string) => {
      tf.fontSize.addMark(`${size}px`);
      setIsFocused(false);
    },
    [tf],
  );

  return (
    <div className="flex h-7 items-center gap-1 rounded-md bg-muted/60 p-0">
      <ToolbarButton onClick={handleDecrease}>
        <MinusIcon />
      </ToolbarButton>

      <Popover open={isFocused} modal={false}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <input
              className={cn(
                "h-full w-10 shrink-0 bg-transparent px-1 text-center text-sm hover:bg-muted",
              )}
              value={displayValue}
              onBlur={commitOnBlur}
              onChange={updateInputValue}
              onFocus={enterFocusedMode}
              onKeyDown={commitOnEnterKey}
              data-plate-focus="true"
              type="text"
            />
          }
        />
        <PopoverContent className="w-10 px-px py-1">
          {FONT_SIZES.map((size) => (
            <Button
              variant="ghost"
              key={size}
              className={cn(
                "flex h-8 w-full items-center justify-center text-sm data-[highlighted=true]:bg-accent",
              )}
              onClick={() => applySizePreset(size)}
              data-highlighted={size === displayValue}
            >
              {size}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      <ToolbarButton onClick={handleIncrease}>
        <PlusIcon />
      </ToolbarButton>
    </div>
  );
};
