import type { PlateElementProps } from "platejs/react";

import { PlateElement, useReadOnly } from "platejs/react";
import { useCallback } from "react";

import { useClientToday } from "@/hooks/use-client-now";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formatRelativeDate = (dateValue: string | undefined, today: Date | null): string | null => {
  if (!dateValue) return null;
  const elementDate = new Date(dateValue);
  if (today) {
    const isToday =
      elementDate.getDate() === today.getDate() &&
      elementDate.getMonth() === today.getMonth() &&
      elementDate.getFullYear() === today.getFullYear();
    if (isToday) return "Today";

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (yesterday.toDateString() === elementDate.toDateString()) return "Yesterday";

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (tomorrow.toDateString() === elementDate.toDateString()) return "Tomorrow";
  }
  return elementDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const parseDate = (dateValue: string | undefined): Date | undefined =>
  dateValue ? new Date(dateValue) : undefined;

const CalendarForDate = ({
  dateValue,
  onSelect,
}: {
  dateValue: string | undefined;
  onSelect: (date: Date | undefined) => void;
}) => {
  // Calendar only mounts inside a Popover on user interaction, so parsing
  // the date string here is safe — never runs during SSR.
  const selected = parseDate(dateValue);
  return <Calendar selected={selected} onSelect={onSelect} mode="single" initialFocus />;
};

const DateLabel = ({ dateValue }: { dateValue: string | undefined }) => {
  const today = useClientToday();
  if (!dateValue) return null;
  return <span suppressHydrationWarning>{formatRelativeDate(dateValue, today)}</span>;
};

export const DateElement = (props: PlateElementProps) => {
  const { editor, element } = props;

  const readOnly = useReadOnly();
  const dateValue = element.date as string | undefined;

  const trigger = (
    <span
      className={cn("w-fit cursor-pointer rounded-sm bg-muted px-1 text-muted-foreground")}
      contentEditable={false}
      draggable
    >
      {dateValue ? <DateLabel dateValue={dateValue} /> : <span>Pick a date</span>}
    </span>
  );

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      editor.tf.setNodes({ date: date.toDateString() }, { at: element });
    },
    [editor.tf, element],
  );

  if (readOnly) {
    return trigger;
  }

  return (
    <PlateElement
      {...props}
      className="inline-block"
      attributes={{
        ...props.attributes,
        contentEditable: false,
      }}
    >
      <Popover>
        <PopoverTrigger
          nativeButton={false}
          render={
            <span
              className={cn("w-fit cursor-pointer rounded-sm bg-muted px-1 text-muted-foreground")}
              contentEditable={false}
              draggable
              suppressHydrationWarning
            />
          }
        >
          {dateValue ? <DateLabel dateValue={dateValue} /> : <span>Pick a date</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <CalendarForDate dateValue={dateValue} onSelect={handleDateSelect} />
        </PopoverContent>
      </Popover>
      {props.children}
    </PlateElement>
  );
};
