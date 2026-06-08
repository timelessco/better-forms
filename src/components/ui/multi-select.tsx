/* oxlint-disable jsx-a11y/prefer-tag-over-role -- outer trigger must stay a
   div; making it a <button> would nest the inner tag-remove <button>s,
   producing invalid HTML and React hydration errors. */
import { useState } from "react";

import { getMultiSelectColor } from "@/components/ui/form-option-item-constants";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormIsDark, useReanchorThemeProps } from "@/hooks/use-form-theme";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  /** id forwarded to the trigger so `<label htmlFor>` / aria-labelledby resolve. */
  id?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

export const MultiSelect = ({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  // PopoverContent portals to body, losing .bf-themed CSS vars — re-anchor theme on the popup.
  const themeReanchor = useReanchorThemeProps();
  // Chip colors follow the form's mode, not the app's global `.dark` (the trigger lives in the
  // editor canvas; the dropdown re-anchors via themeReanchor but neither strips the app `.dark`).
  const isDark = useFormIsDark();

  // Roving focus across options: adds listbox-style ArrowUp/Down + Home/End; Tab still works natively.
  const handleOptionsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-mselect-option]"),
    );
    if (buttons.length === 0) return;
    const activeIndex = buttons.findIndex((btn) => btn === document.activeElement);
    let nextIndex = activeIndex;
    if (event.key === "ArrowDown") {
      nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % buttons.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        activeIndex < 0 ? buttons.length - 1 : (activeIndex - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = buttons.length - 1;
    }
    if (nextIndex !== activeIndex) {
      event.preventDefault();
      buttons[nextIndex]?.focus();
    }
  };

  // Outer trigger can't be a <button> — it holds inner "remove tag" buttons (nested interactive =
  // invalid HTML / hydration errors). div with role=button keeps a11y without the nesting.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            role="button"
            id={id}
            tabIndex={0}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid}
            className={cn(
              "flex min-h-[30px] w-full cursor-pointer items-center gap-1 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2 py-1 text-sm elevation-sm outline-none focus-visible:bg-accent",
              className,
            )}
          >
            <div className="flex flex-1 flex-wrap gap-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((opt) => {
                  const colorIndex = options.findIndex((o) => o.value === opt.value);
                  const color = getMultiSelectColor(colorIndex, isDark);
                  return (
                    <span
                      key={opt.value}
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                        color.bg,
                        color.text,
                      )}
                    >
                      {opt.label}
                      <button
                        type="button"
                        className="ml-1 inline-flex size-3 items-center justify-center rounded-full hover:bg-black/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOption(opt.value);
                        }}
                        aria-label={`Remove ${opt.label}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-foreground/70">{placeholder}</span>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                "size-3 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn("w-(--anchor-width) p-1", themeReanchor.className)}
        style={themeReanchor.style}
        onKeyDown={handleOptionsKeyDown}
      >
        {options.map((opt, idx) => {
          const isSelected = value.includes(opt.value);
          const color = getMultiSelectColor(idx, isDark);
          return (
            <button
              key={opt.value}
              type="button"
              data-mselect-option
              className={cn(
                // Gray-shade highlight (hover + keyboard focus), no focus ring — uniform with other options.
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                isSelected && cn(color.bg, color.text),
              )}
              onClick={() => toggleOption(opt.value)}
            >
              <span>{opt.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
