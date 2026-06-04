import * as React from "react";
import type { KeyboardEvent } from "react";
import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";

/**
 * When an option group uses Letter/Number labels, those ordinals double as selection hotkeys.
 * Returns the index of the option whose ordinal matches the pressed key, or null. Single-key
 * only — numbers past 9 (two digits) aren't reachable and modified keystrokes are ignored.
 */
export const matchOrdinalKey = (
  event: KeyboardEvent,
  labelStyle: OptionLabelStyle,
  optionCount: number,
): number | null => {
  if (labelStyle === "none" || event.metaKey || event.ctrlKey || event.altKey) return null;
  const pressed = event.key.toLowerCase();
  if (pressed.length !== 1) return null;
  for (let i = 0; i < optionCount; i++) {
    if (getOptionOrdinal(labelStyle, i).toLowerCase() === pressed) return i;
  }
  return null;
};

/**
 * Shared option-list keyboard wiring for Checkbox/MultiChoice: owns the per-option button refs and
 * builds an onKeyDown that maps an ordinal hotkey to a selection, then moves focus to that option.
 * Selection logic differs per field, so the caller passes `onSelect(index)`.
 */
export const useOptionHotkeys = (labelStyle: OptionLabelStyle, optionCount: number) => {
  const optionRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const getKeyDownHandler =
    (onSelect: (index: number) => void) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const idx = matchOrdinalKey(event, labelStyle, optionCount);
      if (idx === null) return;
      event.preventDefault();
      onSelect(idx);
      optionRefs.current[idx]?.focus();
    };
  return { optionRefs, getKeyDownHandler };
};
