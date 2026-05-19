/* oxlint-disable jsx-a11y/prefer-tag-over-role -- outer trigger must stay a
   div; making it a <button> would nest the inner tag-remove <button>s,
   producing invalid HTML and React hydration errors. */
import { useState } from "react";

import { MULTI_SELECT_COLORS } from "@/components/ui/form-option-item-constants";
import { ChevronDownIcon } from "@/components/ui/icons";
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

  // PopoverContent portals to document.body, so it loses the .bf-themed
  // CSS-var context. Re-anchor the theme on the popup.
  const themeReanchor = useReanchorThemeProps();

  // Outer trigger must NOT be a <button> — it contains inner "remove tag"
  // buttons, and nested interactive elements are invalid HTML / cause
  // React hydration errors. A div with role=button preserves a11y without
  // the nesting violation.
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
              "flex min-h-[30px] w-full cursor-pointer items-center gap-1 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2 py-1 text-sm elevation-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <div className="flex flex-1 flex-wrap gap-1">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((opt) => {
                  const colorIndex = options.findIndex((o) => o.value === opt.value);
                  const color = MULTI_SELECT_COLORS[colorIndex % MULTI_SELECT_COLORS.length];
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
                <span className="text-muted-foreground">{placeholder}</span>
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
      >
        {options.map((opt, idx) => {
          const isSelected = value.includes(opt.value);
          const color = MULTI_SELECT_COLORS[idx % MULTI_SELECT_COLORS.length];
          return (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
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
