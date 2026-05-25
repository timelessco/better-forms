import type { ReactNode } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonBaseClasses = [
  "relative inline-flex shrink-0 cursor-pointer appearance-none items-center justify-center",
  "align-middle whitespace-nowrap transition select-none",
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
  "rounded-lg border border-transparent bg-clip-padding",
  "text-sm font-normal",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "group/button",
  "pl-2.5 pr-2",
];

const buttonVariants = cva(buttonBaseClasses.join(" "), {
  variants: {
    variant: {
      default:
        "border-none bg-primary text-primary-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] [a]:hover:bg-primary/80",
      outline:
        "border-border bg-background hover:bg-(--color-gray-alpha-100) hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
      secondary:
        "border-none bg-secondary text-secondary-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-secondary/80 aria-expanded:bg-secondary",
      ghost:
        "hover:bg-secondary hover:text-secondary-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
      destructive:
        "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
      link: "text-primary underline-offset-4 hover:underline",
      tab: "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground",
    },
    size: {
      default:
        "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-auto",
      xs: "h-6 gap-1.5 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-4",
      sm: "h-7 gap-1.5 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-4.5",
      lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
      md: "h-7.5 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
      icon: "size-7 cursor-pointer [&_svg:not([class*='size-'])]:size-4.5",
      "icon-xs":
        "size-6 cursor-pointer rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
      "icon-sm":
        "size-6.5 cursor-pointer rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-4",
      "icon-lg": "size-9.5 cursor-pointer",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export const Button = ({
  className,
  variant = "default",
  size = "default",
  prefix,
  suffix,
  children,
  ...props
}: Omit<ButtonPrimitive.Props, "prefix"> &
  VariantProps<typeof buttonVariants> & {
    prefix?: ReactNode;
    suffix?: ReactNode;
  }) => (
  <ButtonPrimitive
    data-slot="button"
    focusableWhenDisabled
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
  >
    {prefix && (
      <span
        data-icon="inline-start"
        className="relative inline-flex shrink-0 items-center justify-center [&_svg:not([class*='size-'])]:size-4"
      >
        {prefix}
      </span>
    )}
    {children}
    {suffix && (
      <span
        data-icon="inline-end"
        className="relative inline-flex shrink-0 items-center justify-center [&_svg:not([class*='size-'])]:size-[1em]"
      >
        {suffix}
      </span>
    )}
  </ButtonPrimitive>
);

export { buttonBaseClasses, buttonVariants };
