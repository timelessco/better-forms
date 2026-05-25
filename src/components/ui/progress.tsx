"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

export const Progress = ({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props) => (
  <ProgressPrimitive.Root
    value={value}
    data-slot="progress"
    className={cn("flex flex-wrap gap-3", className)}
    {...props}
  >
    {children}
    <ProgressTrack>
      <ProgressIndicator />
    </ProgressTrack>
  </ProgressPrimitive.Root>
);

export const ProgressTrack = ({ className, ...props }: ProgressPrimitive.Track.Props) => (
  <ProgressPrimitive.Track
    className={cn(
      "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
      className,
    )}
    data-slot="progress-track"
    {...props}
  />
);

export const ProgressIndicator = ({ className, ...props }: ProgressPrimitive.Indicator.Props) => (
  <ProgressPrimitive.Indicator
    data-slot="progress-indicator"
    className={cn("h-full bg-primary transition-all", className)}
    {...props}
  />
);

export const ProgressLabel = ({ className, ...props }: ProgressPrimitive.Label.Props) => (
  <ProgressPrimitive.Label
    className={cn("text-sm", className)}
    data-slot="progress-label"
    {...props}
  />
);

export const ProgressValue = ({ className, ...props }: ProgressPrimitive.Value.Props) => (
  <ProgressPrimitive.Value
    className={cn("ms-auto text-sm text-muted-foreground tabular-nums", className)}
    data-slot="progress-value"
    {...props}
  />
);
