import { domAnimation, LazyMotion, m, useReducedMotion } from "motion/react";
import type { MotionValue } from "motion/react";

import { cn } from "@/lib/utils";
import { useElasticSlider } from "./use-elastic-slider";

export type ElasticSliderProps = {
  /** Label shown inside the track. */
  label: string;

  /** Controlled value. Use together with `onValueChange` */
  value?: number;
  /** Initial value for uncontrolled mode. Falls back to `min` */
  defaultValue?: number;
  /** Called with the new value on drag, click, or key press. */
  onValueChange?: (value: number) => void;

  /** Minimum value. Default 0. */
  min?: number;
  /** Maximum value. Default 1. */
  max?: number;
  /** Smallest increment. Default 0.01. */
  step?: number;
  /** Format the displayed value. Defaults to `value.toFixed(...)` based on `step` */
  formatValue?: (value: number) => string;

  className?: string;
  /** Class applied to the inner track (where border/rounded/bg live so they stretch with rubber band). */
  trackClassName?: string;
  /** Accessible name. Falls back to `label` */
  "aria-label"?: string;

  /** Reserve a hidden zone at the left edge that emits `onAutoChange` when clicked. */
  allowAuto?: boolean;
  /** Whether the control is currently in the auto/default state. Fill collapses to 0. */
  isAuto?: boolean;
  /** Called when the user clicks/drags into the auto zone. */
  onAutoChange?: () => void;

  /** Hash-mark style: "line" (dashes, Figma Size) or "dot" (Figma Radius). Both are functional
   * snap guides — the handle lands on them. Default "line". */
  markStyle?: "line" | "dot";
  /** Replaces the right-side value text with an icon (e.g. the corner-radius glyph for Radius). */
  endIcon?: React.ReactNode;

  /** Flat at rest: track fill + chrome (marks, fill, handle) hidden until hover/drag/keyboard-focus.
   * Label + value stay visible, so the row reads like a plain ConfigRow until you interact (Figma). */
  revealOnHover?: boolean;
};

export const ElasticSlider = ({
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = 1,
  step = 0.01,
  formatValue,
  className,
  trackClassName,
  "aria-label": ariaLabel,
  allowAuto = false,
  isAuto = false,
  onAutoChange,
  markStyle = "line",
  endIcon,
  revealOnHover = false,
}: ElasticSliderProps) => {
  const shouldReduceMotion = useReducedMotion();
  const {
    wrapperRef,
    trackRef,
    labelRef,
    valueRef,
    value,
    displayValue,
    isActive,
    keyboardFocusRing,
    valueDodge,
    handleOpacity,
    hashMarks,
    dotMarks,
    fillWidth,
    handleLeft,
    rubberWidth,
    rubberX,
    handlers,
  } = useElasticSlider({
    label,
    value: valueProp,
    defaultValue,
    onValueChange,
    min,
    max,
    step,
    formatValue,
    allowAuto,
    isAuto,
    onAutoChange,
    shouldReduceMotion,
    markStyle,
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        ref={wrapperRef}
        data-slot="elastic-slider"
        className={cn(
          "[--elastic-slider-height:--spacing(9)] [--elastic-slider-radius:var(--radius-lg)]",
          "[--elastic-slider-bg:var(--muted)]",
          // Filled state (Figma gray/300): a rounded tile spanning left edge → handle. Override
          // --elastic-slider-tile-radius per row. Dark equivalents keep contrast on dark surfaces.
          "[--elastic-slider-tile-bg:var(--color-gray-300)] dark:[--elastic-slider-tile-bg:var(--color-gray-600)]",
          "[--elastic-slider-tile-radius:var(--elastic-slider-radius)]",
          // Dot marks = gray/400 (Figma 25441-4850) — darker than the fill so they stay visible on it.
          "[--elastic-slider-hash:var(--color-gray-400)] dark:[--elastic-slider-hash:var(--color-gray-500)]",
          // Line marks = gray/300 (Figma 25441-4645 stroke #E0E0E0, round cap) — matches the fill, so
          // it reads on the track and blends into the filled tile, as in Figma. Token flips for dark.
          "[--elastic-slider-line:var(--color-gray-300)]",
          "[--elastic-slider-handle:var(--color-gray-500)] dark:[--elastic-slider-handle:var(--color-gray-400)]",
          "[--elastic-slider-label:var(--muted-foreground)]",
          "[--elastic-slider-focus:var(--foreground)]",
          "relative h-(--elastic-slider-height)",
          className,
        )}
      >
        <m.div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          data-slot="elastic-slider-track"
          data-active={isActive}
          data-focus-visible={keyboardFocusRing}
          aria-label={ariaLabel ?? label}
          aria-orientation="horizontal"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
          className={cn(
            "group/elastic-slider absolute inset-0 cursor-pointer touch-none overflow-hidden rounded-(--elastic-slider-radius) transition-colors outline-none select-none",
            // revealOnHover: transparent at rest, gray track only on hover/drag/keyboard-focus (Figma).
            revealOnHover
              ? "bg-transparent hover:bg-(--elastic-slider-bg) data-[active=true]:bg-(--elastic-slider-bg) data-[focus-visible=true]:bg-(--elastic-slider-bg)"
              : "bg-(--elastic-slider-bg)",
            // No focus ring (not in Figma): the revealed gray track already signals keyboard focus.
            trackClassName,
          )}
          style={{ width: rubberWidth, x: rubberX }}
          {...handlers}
        >
          <div
            data-slot="elastic-slider-chrome"
            className={cn(
              "pointer-events-none absolute inset-0",
              // Fade marks/fill/handle in together with the track bg (handle keeps its own opacity).
              revealOnHover &&
                "opacity-0 transition-opacity group-hover/elastic-slider:opacity-100 group-data-[active=true]/elastic-slider:opacity-100 group-data-[focus-visible=true]/elastic-slider:opacity-100",
            )}
          >
            <m.div
              data-slot="elastic-slider-fill"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 inset-s-0 rounded-(--elastic-slider-tile-radius) bg-(--elastic-slider-tile-bg)"
              style={{ width: fillWidth }}
            />

            {/* Marks render ABOVE the fill so they stay visible inside the filled tile (Figma). */}
            {markStyle === "dot" ? (
              <SliderDotMarks dotMarks={dotMarks} />
            ) : (
              <SliderHashMarks hashMarks={hashMarks} />
            )}

            <SliderHandle
              handleLeft={handleLeft}
              handleOpacity={handleOpacity}
              isActive={isActive}
              valueDodge={valueDodge}
              shouldReduceMotion={shouldReduceMotion}
              dimmed={isAuto}
            />
          </div>

          <SliderLabels
            labelRef={labelRef}
            valueRef={valueRef}
            label={label}
            displayValue={displayValue}
            endIcon={endIcon}
          />
        </m.div>
      </div>
    </LazyMotion>
  );
};

// Dash variant (Figma Size): evenly spaced vertical lines, rendered ABOVE the fill so they stay
// visible inside the filled tile. Marks under the label text are hidden (hook's `hidden` flag).
const SliderHashMarks = ({ hashMarks }: { hashMarks: { pct: number; hidden: boolean }[] }) => (
  <div
    data-slot="elastic-slider-hash-marks"
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
  >
    {hashMarks.map(({ pct, hidden }) => (
      <div
        key={`hash-${pct}`}
        className={cn(
          "absolute top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--elastic-slider-line) rtl:translate-x-1/2",
          hidden && "opacity-0",
        )}
        style={{ left: `${pct}%` }}
      />
    ))}
  </div>
);

// Dot variant (Figma Radius): a dot per snap stop, rendered ABOVE the fill so dots stay visible
// inside the filled tile. The hook hides the dot the handle sits on (no collision) and any dot that
// falls under the label text.
const SliderDotMarks = ({ dotMarks }: { dotMarks: { pct: number; hidden: boolean }[] | null }) => (
  <div
    data-slot="elastic-slider-dot-marks"
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
  >
    {dotMarks?.map(({ pct, hidden }) => (
      <div
        key={`dot-${pct}`}
        className={cn(
          "absolute top-1/2 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--elastic-slider-hash) transition-opacity duration-150 rtl:translate-x-1/2",
          hidden && "opacity-0",
        )}
        style={{ left: `${pct}%` }}
      />
    ))}
  </div>
);

interface SliderHandleProps {
  handleLeft: MotionValue<string>;
  handleOpacity: number;
  isActive: boolean;
  valueDodge: boolean;
  shouldReduceMotion: boolean | null;
  /** Auto/min state: handle is gray/300 (Figma), matching the fill tile color; gray/500 otherwise. */
  dimmed: boolean;
}

// Figma Frame 1533208826: 2×12px rounded bar, always visible, riding the fill tile's right edge.
const SliderHandle = ({
  handleLeft,
  handleOpacity,
  isActive,
  valueDodge,
  shouldReduceMotion,
  dimmed,
}: SliderHandleProps) => (
  <m.div
    data-slot="elastic-slider-handle"
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute top-1/2 h-3 w-[2px] rounded-full",
      dimmed ? "bg-(--elastic-slider-tile-bg)" : "bg-(--elastic-slider-handle)",
    )}
    style={{ left: handleLeft, y: "-50%" }}
    animate={{
      opacity: handleOpacity,
      scaleY: isActive && valueDodge ? 0.75 : 1,
    }}
    transition={
      shouldReduceMotion
        ? { duration: 0 }
        : {
            scaleY: { type: "spring", visualDuration: 0.2, bounce: 0.1 },
            opacity: { duration: 0.15 },
          }
    }
  />
);

interface SliderLabelsProps {
  labelRef: React.RefObject<HTMLSpanElement | null>;
  valueRef: React.RefObject<HTMLSpanElement | null>;
  label: string;
  displayValue: string;
  /** When set, replaces the value text (Figma Radius corner glyph). */
  endIcon?: React.ReactNode;
}

const SliderLabels = ({ labelRef, valueRef, label, displayValue, endIcon }: SliderLabelsProps) => (
  <>
    <span
      ref={labelRef}
      data-slot="elastic-slider-label"
      aria-hidden="true"
      className="pointer-events-none absolute inset-s-3 top-1/2 inline-flex -translate-y-1/2 items-center text-sm/none font-medium text-(--elastic-slider-label) transition-colors"
    >
      {label}
    </span>

    <span
      ref={valueRef}
      data-slot="elastic-slider-value"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-e-3 top-1/2 inline-flex -translate-y-1/2 items-center text-sm/none font-medium transition-colors",
        "text-(--elastic-slider-label) group-data-[active=true]/elastic-slider:text-(--elastic-slider-focus)",
      )}
    >
      {endIcon ?? displayValue}
    </span>
  </>
);
