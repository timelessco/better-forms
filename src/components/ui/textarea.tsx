import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = ({ className, ...props }: React.ComponentProps<"textarea">) => (
  <textarea
    data-slot="textarea"
    className={cn(
      "relative flex field-sizing-content min-h-16 w-full cursor-text rounded-[var(--radius-lg)] border-0 bg-card px-[10px] py-2 pr-[8px] text-sm caret-current shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)] transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:ring-1 aria-invalid:ring-destructive dark:disabled:bg-input/80",
      className,
    )}
    {...props}
  />
);
