"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  [
    "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2",
    // unchecked states — stays bg-accent through hover/active; only a real toggle (→checked) changes color
    "not-data-disabled:data-unchecked:focus-visible:shadow-3xs data-unchecked:bg-accent not-data-disabled:data-unchecked:focus-visible:bg-accent",
    // checked states
    "not-data-disabled:data-checked:focus-visible:shadow-3xs data-checked:bg-primary not-data-disabled:data-checked:hover:bg-primary/86 not-data-disabled:data-checked:focus-visible:bg-primary not-data-disabled:data-checked:active:bg-primary/74",
    // invalid state (self + Field context)
    "data-invalid:border-destructive! data-invalid:ring-2! data-invalid:ring-destructive/20!",
    "group-data-[invalid=true]/field:border-destructive! group-data-[invalid=true]/field:ring-2! group-data-[invalid=true]/field:ring-destructive/20!",
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    // disabled
    "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:bg-muted",
  ],
  {
    variants: {
      size: {
        sm: "h-4 w-[26px]",
        default: "h-4 w-[26px]",
        lg: "h-5 w-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const switchThumbVariants = cva(
  "pointer-events-none absolute rounded-full bg-background shadow-xs ring-0 drop-shadow-[0_3px_3px_rgba(0,0,0,0.05)] transition-all duration-150 ease-out",
  {
    variants: {
      size: {
        sm: "top-px size-3 group-active/switch:w-[15px] data-checked:left-[11px] group-active/switch:data-checked:left-[8px] data-unchecked:left-px",
        default:
          "top-px size-3 group-active/switch:w-[15px] data-checked:left-[11px] group-active/switch:data-checked:left-[8px] data-unchecked:left-px",
        lg: "top-0.5 size-3.5 group-active/switch:w-[18px] data-checked:left-[14px] group-active/switch:data-checked:left-[10px] data-unchecked:left-0.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const Switch = ({
  className,
  size = "default",
  "data-invalid": dataInvalid,
  ...props
}: SwitchPrimitive.Root.Props &
  VariantProps<typeof switchVariants> & {
    "data-invalid"?: string;
  }) => (
  <SwitchPrimitive.Root
    data-slot="switch"
    data-size={size}
    {...(dataInvalid !== undefined && { "data-invalid": dataInvalid })}
    className={cn(switchVariants({ size, className }))}
    {...props}
  >
    <SwitchPrimitive.Thumb data-slot="switch-thumb" className={switchThumbVariants({ size })} />
  </SwitchPrimitive.Root>
);

export { Switch, switchVariants };
