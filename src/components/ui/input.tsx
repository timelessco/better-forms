import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "relative h-[30px] w-full min-w-0 cursor-text rounded-lg border-0 px-2.5 pr-1.5 text-base text-foreground caret-current elevation-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive dark:border dark:border-border dark:shadow-none",
  {
    variants: {
      variant: {
        primary: "bg-card",
        secondary: "bg-secondary",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export const Input = ({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) => (
  <InputPrimitive
    type={type}
    data-slot="input"
    className={cn(inputVariants({ variant }), className)}
    {...props}
  />
);

export { inputVariants };
