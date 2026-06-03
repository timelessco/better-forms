import { useState } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { cn } from "@/lib/utils";

interface DropdownSelectOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  options: DropdownSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** id forwarded to the trigger so `<label htmlFor>` / aria-labelledby resolve. */
  id?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

/** Single-select dropdown — Figma `dropdown` (system-flat). Mirrors MultiSelect's trigger
 * styling but stores one value and closes on pick. */
export const DropdownSelect = ({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: DropdownSelectProps) => {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  // PopoverContent portals to body, losing .bf-themed CSS vars — re-anchor theme on the popup.
  const themeReanchor = useReanchorThemeProps();

  // Roving focus across options: adds listbox-style ArrowUp/Down + Home/End; Tab still works natively.
  const handleOptionsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-dselect-option]"),
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid}
            className={cn(
              "flex min-h-[30px] w-full cursor-pointer items-center gap-1 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2 py-1 text-left text-sm elevation-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <span className={cn("flex-1 truncate", !selectedOption && "text-foreground/70")}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-3 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn("w-(--anchor-width) p-1", themeReanchor.className)}
        style={themeReanchor.style}
        onKeyDown={handleOptionsKeyDown}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              data-dselect-option
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                isSelected && "bg-accent font-medium",
              )}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span className="flex-1 text-left">{opt.label}</span>
              {isSelected && <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
