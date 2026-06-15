/* oxlint-disable jsx-a11y/prefer-tag-over-role -- outer trigger must stay a
   div; making it a <button> would nest the inner tag-remove <button>s,
   producing invalid HTML and React hydration errors. */
import { useState } from "react";

import { CheckCheckIcon, CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
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
              // Figma input-select (25632:9327): 30px gray/50 pill, 10px inline padding, 16px chevron.
              "flex min-h-[30px] w-full cursor-pointer items-center gap-1 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2.5 py-1 text-sm elevation-sm outline-none focus-visible:bg-accent",
              className,
            )}
          >
            <div className="flex flex-1 flex-wrap gap-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((opt) => (
                    <span
                      key={opt.value}
                      className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-900"
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
                  ))
              ) : (
                <span className="text-foreground/70">{placeholder}</span>
              )}
            </div>
            {/* Double-tick marks this as a multi-select (vs a single-pick dropdown). */}
            <CheckCheckIcon className="size-4 shrink-0 text-muted-foreground" />
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </div>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={4}
        // Neutral full-width option rows (normal multi-select), elevation-xl popup.
        className={cn("w-(--anchor-width) gap-0.5 p-1 elevation-xl", themeReanchor.className)}
        style={themeReanchor.style}
        onKeyDown={handleOptionsKeyDown}
      >
        {options.map((opt) => {
          const isSelected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              data-mselect-option
              className={cn(
                // Normal-select rows: neutral, checkmark marks selection, hover/selected tint.
                "flex h-8 w-full cursor-pointer items-center justify-between rounded-[8px] px-2 text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                isSelected && "bg-accent font-medium",
              )}
              onClick={() => toggleOption(opt.value)}
            >
              <span>{opt.label}</span>
              {isSelected && <CheckIcon className="size-4 shrink-0" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
