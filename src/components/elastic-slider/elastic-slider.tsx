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
    hashMarkCount,
    hashMarkPct,
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
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        ref={wrapperRef}
        data-slot="elastic-slider"
        className={cn(
          "[--elastic-slider-height:--spacing(9)] [--elastic-slider-radius:var(--radius-lg)]",
          "[--elastic-slider-bg:var(--muted)]",
          "[--elastic-slider-fill:var(--muted-foreground)]/10",
          "[--elastic-slider-fill-active:var(--muted-foreground)]/20",
          "[--elastic-slider-hash:var(--muted-foreground)]/30",
          "[--elastic-slider-handle:var(--foreground)]",
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
            "group/elastic-slider absolute inset-0 cursor-pointer touch-none overflow-hidden rounded-(--elastic-slider-radius) bg-(--elastic-slider-bg) outline-none select-none",
            "data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-ring/50 data-[focus-visible=true]:ring-offset-1 data-[focus-visible=true]:ring-offset-background",
            trackClassName,
          )}
          style={{ width: rubberWidth, x: rubberX }}
          {...handlers}
        >
          <SliderHashMarks hashMarkCount={hashMarkCount} hashMarkPct={hashMarkPct} />

          <m.div
            data-slot="elastic-slider-fill"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 inset-s-0 transition-colors",
              "bg-(--elastic-slider-fill) group-data-[active=true]/elastic-slider:bg-(--elastic-slider-fill-active)",
            )}
            style={{ width: fillWidth }}
          />

          <SliderHandle
            handleLeft={handleLeft}
            handleOpacity={handleOpacity}
            isActive={isActive}
            valueDodge={valueDodge}
            shouldReduceMotion={shouldReduceMotion}
          />

          <SliderLabels
            labelRef={labelRef}
            valueRef={valueRef}
            label={label}
            displayValue={displayValue}
          />
        </m.div>
      </div>
    </LazyMotion>
  );
};

const SliderHashMarks = ({
  hashMarkCount,
  hashMarkPct,
}: {
  hashMarkCount: number;
  hashMarkPct: (i: number) => number;
}) => (
  <div
    data-slot="elastic-slider-hash-marks"
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
  >
    {Array.from({ length: hashMarkCount }, (_, i) => {
      const pct = hashMarkPct(i);
      return (
        <div
          key={`hash-${pct}`}
          className={cn(
            "absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200 rtl:translate-x-1/2",
            "bg-transparent group-data-[active=true]/elastic-slider:bg-(--elastic-slider-hash)",
          )}
          style={{ left: `${pct}%` }}
        />
      );
    })}
  </div>
);

interface SliderHandleProps {
  handleLeft: MotionValue<string>;
  handleOpacity: number;
  isActive: boolean;
  valueDodge: boolean;
  shouldReduceMotion: boolean | null;
}

const SliderHandle = ({
  handleLeft,
  handleOpacity,
  isActive,
  valueDodge,
  shouldReduceMotion,
}: SliderHandleProps) => (
  <m.div
    data-slot="elastic-slider-handle"
    aria-hidden="true"
    className="pointer-events-none absolute top-1/2 h-5 w-1 rounded-full bg-(--elastic-slider-handle)"
    style={{ left: handleLeft, y: "-50%" }}
    animate={{
      opacity: handleOpacity,
      scaleX: isActive ? 1 : 0.25,
      scaleY: isActive && valueDodge ? 0.75 : 1,
    }}
    transition={
      shouldReduceMotion
        ? { duration: 0 }
        : {
            scaleX: {
              type: "spring",
              visualDuration: 0.25,
              bounce: 0.15,
            },
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
}

const SliderLabels = ({ labelRef, valueRef, label, displayValue }: SliderLabelsProps) => (
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
        "pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 font-mono text-sm/none font-medium transition-colors",
        "text-(--elastic-slider-label) group-data-[active=true]/elastic-slider:text-(--elastic-slider-focus)",
      )}
    >
      {displayValue}
    </span>
  </>
);
