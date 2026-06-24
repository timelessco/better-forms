"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

export const Slider = ({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) => {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          // Figma 25634-17867: 2px track, design-system gray-300 / gray-950 range — pinned (not
          // muted/primary) so the bf-themed menu doesn't tint them with the form's palette.
          className="relative grow overflow-hidden rounded-full bg-gray-300 select-none data-horizontal:h-0.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-0.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-gray-950 select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {_values.map((_value, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // Key by thumb slot (index), not value: the value changes every drag tick, and a
            // value-derived key would remount the thumb mid-drag (breaking base-ui's drag) and
            // collide when two thumbs momentarily share a value.
            // biome-ignore lint/suspicious/noArrayIndexKey: thumb count is fixed; slot is the identity
            key={index}
            // Figma knob: 14px white circle with a soft drop-shadow (no colored border).
            className="relative block size-3.5 shrink-0 rounded-full bg-white shadow-[0px_0px_0.75px_0px_rgba(0,0,0,0.16),0px_2px_2.5px_0px_rgba(0,0,0,0.14)] ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
};
