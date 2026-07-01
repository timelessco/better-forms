import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useReanchorThemeProps } from "@/hooks/use-form-theme";

interface DatePickerProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  className?: string;
  /** Trigger label shown when no date is selected. Defaults to "Pick a date". */
  placeholder?: string;
  /** id forwarded to the trigger button so `<label htmlFor>` resolves. */
  id?: string;
  name?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

export const DatePicker = ({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
  id,
  name,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) => {
  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (value) {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
  });
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate && onChange) {
      const formatted = format(selectedDate, "yyyy-MM-dd");
      onChange(formatted);
    } else if (onChange) {
      onChange(null);
    }
    setIsOpen(false);
  };

  const displayText = date ? format(date, "MMM d, yyyy") : placeholder;

  // PopoverContent portals to body, breaking .bf-themed CSS-var inheritance — re-anchor on the popup.
  const themeReanchor = useReanchorThemeProps("w-auto p-0");

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            name={name}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid}
            data-empty={!date}
            data-bf-input-fill
            className={cn(
              "inline-flex h-[30px] w-full items-center justify-start rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-1.5 pl-2.5 text-left text-sm font-normal elevation-sm",
              // Value text/icon color comes from the data-bf-input-fill rule (auto-contrast with the
              // Input bg). Empty = dim it to a placeholder tone via opacity (keeps the contrast ink).
              !date && "opacity-70",
              className,
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {displayText}
          </button>
        }
      />
      <PopoverContent className={themeReanchor.className} style={themeReanchor.style} align="start">
        <Calendar mode="single" selected={date} onSelect={handleDateSelect} />
      </PopoverContent>
    </Popover>
  );
};
