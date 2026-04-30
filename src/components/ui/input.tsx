import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "relative h-[30px] w-full min-w-0 cursor-text rounded-lg border-0 px-2.5 pr-1.5 text-base caret-current transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive",
  {
    variants: {
      variant: {
        primary:
          "bg-card text-foreground shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)] dark:border dark:border-border dark:shadow-none",
        secondary:
          "bg-secondary text-foreground shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)] dark:border dark:border-border dark:shadow-none",
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
