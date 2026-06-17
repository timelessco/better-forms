import { SelectChevronIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ToggleSelectOption {
  label: string;
  value: string;
}

interface ToggleSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Exactly two options — clicking cycles between them (no popup). */
  options: readonly [ToggleSelectOption, ToggleSelectOption];
  /** Trigger styling to match its row — pass the same cls the replaced SelectTrigger used. */
  className?: string;
  /** Stacked up/down chevron sizing (matches the old trigger's caret). */
  iconClassName?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

/** Binary dropdown replacement: a single click-to-toggle button that flips between two values.
 * Visually mirrors a SelectTrigger (value + trailing chevron) but the chevron is the stacked
 * up/down glyph and there's no popup — overkill-dropdown killer for two-option rows. */
export const ToggleSelect = ({
  value,
  onChange,
  options,
  className,
  iconClassName,
  "aria-label": ariaLabel,
  disabled,
}: ToggleSelectProps) => {
  const current = options.find((o) => o.value === value) ?? options[0];
  const next = current.value === options[0].value ? options[1] : options[0];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={current.value === options[1].value}
      aria-label={ariaLabel}
      title={`Switch to ${next.label}`}
      disabled={disabled}
      onClick={() => onChange(next.value)}
      // Mirror SelectTrigger's flex/gap/height/border base; `className` supplies the per-row look.
      className={cn(
        "text-13 flex w-fit cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 ps-2.5 pe-2 whitespace-nowrap outline-hidden transition-colors select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
    >
      {current.label}
      {/* chevron inherits the trigger's text color (Figma: gray-700, same as the label) */}
      <SelectChevronIcon className={cn("size-3", iconClassName)} />
    </button>
  );
};
