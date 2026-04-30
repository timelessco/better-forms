"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Label = ({ className, htmlFor, ...props }: React.ComponentProps<"label">) => (
  <label
    data-slot="label"
    htmlFor={htmlFor}
    className={cn(
      "flex items-center gap-2 text-sm select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
);
