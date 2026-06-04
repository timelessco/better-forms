import * as React from "react";

import { useReanchorThemeProps } from "@/hooks/use-form-theme";
import { cn } from "@/lib/utils";
import { ChevronSelectIcon, ClockLineIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface TimePickerProps {
  /** Stored value — 24-hour "HH:MM" (matches the old native input), or "" when unset. */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  /** Trigger label shown when no time is selected. */
  placeholder?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

type Period = "AM" | "PM";
type TimeParts = { hour12: number; minute: number; period: Period };

const DEFAULT_PARTS: TimeParts = { hour12: 12, minute: 0, period: "AM" };

// "HH:MM" (24h) → 12h parts. Returns null for empty/malformed so the trigger shows the placeholder.
const parse = (value: string | undefined): TimeParts | null => {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h24 = Number(match[1]);
  const minute = Number(match[2]);
  if (h24 > 23 || minute > 59) return null;
  const period: Period = h24 >= 12 ? "PM" : "AM";
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
};

// 12h parts → "HH:MM" (24h), zero-padded.
const serialize = ({ hour12, minute, period }: TimeParts): string => {
  let h24 = hour12 % 12; // 12 → 0
  if (period === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const formatDisplay = (parts: TimeParts): string =>
  `${parts.hour12}:${String(parts.minute).padStart(2, "0")} ${parts.period}`;

// Step with wrap-around within [min, max].
const wrap = (n: number, min: number, max: number): number => {
  if (n > max) return min;
  if (n < min) return max;
  return n;
};

type SegmentProps = {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onCommit: (n: number) => void;
};

// Figma "input-select" segment: gray-100 box, typeable value, ChevronSelect up/down stepper.
const TimeSegment = ({ value, min, max, ariaLabel, onCommit }: SegmentProps) => {
  // Local draft so partial typing isn't fought by the controlled, zero-padded display.
  const [draft, setDraft] = React.useState<string | null>(null);
  const display = draft ?? String(value).padStart(2, "0");

  const step = (delta: number) => {
    setDraft(null);
    onCommit(wrap(value + delta, min, max));
  };

  return (
    <div className="flex min-w-px flex-[1_0_0] items-center gap-2 rounded-lg bg-(--color-gray-alpha-100) px-2 py-1.5">
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(-2);
          setDraft(digits);
          if (digits !== "") onCommit(Math.min(max, Math.max(min, Number(digits))));
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="min-w-0 flex-1 [appearance:textfield] bg-transparent text-[14px] tracking-[0.28px] text-foreground tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {/* Single Figma icon/line/select glyph; transparent top/bottom halves drive ±1. */}
      <div className="relative flex h-4 w-3 shrink-0 flex-col text-muted-foreground">
        <ChevronSelectIcon className="pointer-events-none absolute inset-0 m-auto size-3" />
        <button
          type="button"
          aria-label={`Increase ${ariaLabel}`}
          onClick={() => step(1)}
          className="flex-1"
        />
        <button
          type="button"
          aria-label={`Decrease ${ariaLabel}`}
          onClick={() => step(-1)}
          className="flex-1"
        />
      </div>
    </div>
  );
};

export const TimePicker = ({
  value,
  onChange,
  onBlur,
  className,
  placeholder = "Choose time",
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) => {
  const [open, setOpen] = React.useState(false);
  const parts = parse(value);
  // Popover edits operate on the parsed value, falling back to a sensible default when unset.
  const view = parts ?? DEFAULT_PARTS;

  const emit = (next: Partial<TimeParts>) => onChange?.(serialize({ ...view, ...next }));

  // PopoverContent portals to body, breaking .bf-themed CSS-var inheritance — re-anchor on the popup.
  const themeReanchor = useReanchorThemeProps();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            name={name}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid}
            data-empty={!parts}
            onBlur={onBlur}
            className={cn(
              "inline-flex h-7 w-full items-center justify-between gap-1 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] px-2.5 text-left text-sm font-normal elevation-sm",
              "aria-invalid:form-input-error",
              // Foreground (not muted token) so custom themes can't drop placeholder below WCAG AA.
              !parts && "text-foreground/70",
              className,
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {parts ? formatDisplay(parts) : placeholder}
            </span>
            <ClockLineIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent
        align="start"
        className={cn(
          "flex w-[320px] flex-col gap-2.5 rounded-[12px] bg-popover px-3.5 py-4 elevation-xl",
          themeReanchor.className,
        )}
        style={themeReanchor.style}
      >
        <span className="text-[14px] font-medium text-foreground">Time</span>
        <div className="flex items-center gap-2">
          <TimeSegment
            value={view.hour12}
            min={1}
            max={12}
            ariaLabel="Hours"
            onCommit={(hour12) => emit({ hour12 })}
          />
          <TimeSegment
            value={view.minute}
            min={0}
            max={59}
            ariaLabel="Minutes"
            onCommit={(minute) => emit({ minute })}
          />
          <button
            type="button"
            aria-label="Toggle AM or PM"
            onClick={() => emit({ period: view.period === "AM" ? "PM" : "AM" })}
            className="flex shrink-0 items-center rounded-lg bg-(--color-gray-alpha-100) px-2.5 py-1.5 text-[14px] tracking-[0.28px] text-foreground tabular-nums"
          >
            {view.period}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
