import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimeRangeFilter } from "@/types/analytics";

interface TimeRangeSelectorProps {
  value: TimeRangeFilter;
  startDate?: string;
  endDate?: string;
  onChange: (next: { filter: TimeRangeFilter; startDate?: string; endDate?: string }) => void;
}

const PRESET_OPTIONS: { value: TimeRangeFilter; label: string }[] = [
  { value: "last_24_hours", label: "Last 24 hours" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

export const TimeRangeSelector = ({
  value,
  startDate,
  endDate,
  onChange,
}: TimeRangeSelectorProps) => {
  const handlePresetChange = (next: TimeRangeFilter | null): void => {
    if (!next) {
      return;
    }
    if (next === "custom") {
      onChange({ filter: next, startDate, endDate });
      return;
    }
    onChange({ filter: next });
  };

  const handleStartDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ filter: "custom", startDate: event.target.value || undefined, endDate });
  };

  const handleEndDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ filter: "custom", startDate, endDate: event.target.value || undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={handlePresetChange}>
        <SelectTrigger className="min-w-[160px]">
          <SelectValue>
            {(current) =>
              PRESET_OPTIONS.find((option) => option.value === current)?.label ??
              (current as string)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRESET_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "custom" ? (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>From</span>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={handleStartDateChange}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>To</span>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={handleEndDateChange}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
};
