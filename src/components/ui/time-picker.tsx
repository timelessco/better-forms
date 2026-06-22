import * as React from "react";

import { cn } from "@/lib/utils";
import { ChevronSelectIcon } from "@/components/ui/icons";

export interface TimePickerProps {
  /** Stored value — 24-hour "HH:MM" (matches the old native input), or "" when unset. */
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  /** Railway/24-hour mode: hour spinner 0–23, no AM/PM, "HH:MM" display. Default 12-hour. */
  use24Hour?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
}

type Period = "AM" | "PM";
type TimeParts = { hour12: number; minute: number; period: Period };

const DEFAULT_PARTS: TimeParts = { hour12: 12, minute: 0, period: "AM" };

// "HH:MM" (24h) → 12h parts. Returns null for empty/malformed so segments fall back to defaults.
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
  inputId?: string;
  /** Field is empty — show `value` as muted placeholder instead of a committed value. */
  unset?: boolean;
  onCommit: (n: number) => void;
};

// Figma "input-select" box: gray-100 fill, typeable value, ChevronSelect up/down stepper.
const TimeSegment = ({ value, min, max, ariaLabel, inputId, unset, onCommit }: SegmentProps) => {
  // Local draft so partial typing isn't fought by the controlled, zero-padded display.
  const [draft, setDraft] = React.useState<string | null>(null);
  const padded = String(value).padStart(2, "0");
  // While unset (and not mid-type) show the native placeholder; first edit fills the value.
  const showPlaceholder = unset && draft === null;
  const display = showPlaceholder ? "" : (draft ?? padded);

  const step = (delta: number) => {
    setDraft(null);
    onCommit(wrap(value + delta, min, max));
  };

  return (
    <div className="flex min-w-px flex-[1_0_0] items-center gap-2 rounded-lg bg-(--color-gray-alpha-100) px-2 py-1.5">
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={display}
        placeholder={padded}
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
        className="min-w-0 flex-1 [appearance:textfield] bg-transparent text-base tracking-[0.28px] text-foreground tabular-nums outline-none placeholder:text-foreground/70 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {/* Single Figma icon/line/select glyph; transparent top/bottom halves drive ±1. */}
      <div className="relative flex h-4 w-3 shrink-0 flex-col text-muted-foreground">
        <ChevronSelectIcon className="pointer-events-none absolute inset-0 m-auto size-3" />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${ariaLabel}`}
          onClick={() => step(1)}
          className="flex-1"
        />
        <button
          type="button"
          tabIndex={-1}
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
  use24Hour = false,
  id,
  name,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: TimePickerProps) => {
  const parts = parse(value);
  // Segments are always populated; unset shows the default but the stored value stays "" until edited.
  const view = parts ?? DEFAULT_PARTS;
  const hour24 = view.period === "PM" ? (view.hour12 % 12) + 12 : view.hour12 % 12;

  const emit = (next: Partial<TimeParts>) => onChange?.(serialize({ ...view, ...next }));

  // Fire field blur only when focus leaves the whole group, not when tabbing between segments.
  const groupRef = React.useRef<HTMLDivElement>(null);
  const handleGroupBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!groupRef.current?.contains(e.relatedTarget as Node | null)) onBlur?.();
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-invalid={ariaInvalid}
      onBlur={handleGroupBlur}
      data-name={name}
      className={cn("flex items-center gap-2 rounded-lg aria-invalid:form-input-error", className)}
    >
      {use24Hour ? (
        <TimeSegment
          value={hour24}
          min={0}
          max={23}
          ariaLabel="Hours"
          inputId={id}
          unset={!parts}
          onCommit={(h24) =>
            emit({ hour12: h24 % 12 === 0 ? 12 : h24 % 12, period: h24 >= 12 ? "PM" : "AM" })
          }
        />
      ) : (
        <TimeSegment
          value={view.hour12}
          min={1}
          max={12}
          ariaLabel="Hours"
          inputId={id}
          unset={!parts}
          onCommit={(hour12) => emit({ hour12 })}
        />
      )}
      <TimeSegment
        value={view.minute}
        min={0}
        max={59}
        ariaLabel="Minutes"
        unset={!parts}
        onCommit={(minute) => emit({ minute })}
      />
      {!use24Hour && (
        <button
          type="button"
          aria-label="Toggle AM or PM"
          onClick={() => emit({ period: view.period === "AM" ? "PM" : "AM" })}
          className={cn(
            "flex shrink-0 items-center rounded-lg bg-(--color-gray-alpha-100) px-2.5 py-1.5 text-base tracking-[0.28px] tabular-nums",
            parts ? "text-foreground" : "text-foreground/70",
          )}
        >
          {view.period}
        </button>
      )}
    </div>
  );
};
