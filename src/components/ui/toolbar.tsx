import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "@/components/ui/icons";
import * as React from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Toolbar = ({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Root>) => (
  <ToolbarPrimitive.Root
    className={cn("relative flex items-center select-none", className)}
    {...props}
  />
);

export const ToolbarToggleGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Group>) => (
  <ToolbarPrimitive.Group className={cn("flex items-center", className)} {...props} />
);

export const ToolbarLink = ({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Link>) => (
  <ToolbarPrimitive.Link className={cn("underline underline-offset-4", className)} {...props} />
);

export const ToolbarSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Separator>) => (
  <ToolbarPrimitive.Separator
    className={cn("mx-2 my-1 w-px shrink-0 bg-border", className)}
    {...props}
  />
);

// From toggleVariants
const toolbarButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-accent aria-pressed:text-accent-foreground dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 min-w-9 px-2",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-1.5",
      },
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
    },
  },
);

const dropdownArrowVariants = cva(
  cn(
    "inline-flex items-center justify-center rounded-r-md text-sm text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    defaultVariants: {
      size: "sm",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 w-6",
        lg: "h-10 w-8",
        sm: "h-8 w-4",
      },
      variant: {
        default:
          "bg-transparent hover:bg-muted hover:text-muted-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground",
        outline:
          "border border-l-0 border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
    },
  },
);

type TooltipProps<T extends React.ElementType> = {
  tooltip?: React.ReactNode;
  tooltipContentProps?: Omit<React.ComponentPropsWithoutRef<typeof TooltipContent>, "children">;
  tooltipProps?: Omit<React.ComponentPropsWithoutRef<typeof Tooltip>, "children">;
  tooltipTriggerProps?: React.ComponentPropsWithoutRef<typeof TooltipTrigger>;
} & React.ComponentProps<T>;

const withTooltip = <T extends React.ElementType>(Component: T) =>
  function ExtendComponent({
    tooltip,
    tooltipContentProps,
    tooltipProps,
    tooltipTriggerProps,
    ...props
  }: TooltipProps<T>) {
    const [mounted, setMounted] = React.useState(false);

    useMountEffect(() => setMounted(true));

    const component = <Component {...(props as React.ComponentProps<T>)} />;

    if (tooltip && mounted) {
      return (
        <Tooltip {...tooltipProps}>
          <TooltipTrigger render={component} {...tooltipTriggerProps} />

          <TooltipContent {...tooltipContentProps}>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return component;
  };

type ToolbarButtonProps = {
  isDropdown?: boolean;
  pressed?: boolean;
} & Omit<React.ComponentPropsWithoutRef<typeof ToolbarToggleItem>, "value"> &
  VariantProps<typeof toolbarButtonVariants>;

export const ToolbarButton = withTooltip(function ToolbarButton({
  children,
  className,
  isDropdown,
  pressed,
  size = "sm",
  variant,
  ...props
}: ToolbarButtonProps) {
  return typeof pressed === "boolean" ? (
    <ToolbarToggleGroup disabled={props.disabled}>
      <ToolbarToggleItem
        className={cn(
          toolbarButtonVariants({
            size,
            variant,
          }),
          isDropdown && "justify-between gap-1 pr-1",
          className,
        )}
        aria-pressed={pressed}
        {...props}
      >
        {isDropdown ? (
          <>
            <div className="flex flex-1 items-center gap-2 whitespace-nowrap">{children}</div>
            <div>
              <ChevronDownIcon
                className="size-3.5 text-muted-foreground"
                data-icon
                aria-hidden="true"
              />
            </div>
          </>
        ) : (
          children
        )}
      </ToolbarToggleItem>
    </ToolbarToggleGroup>
  ) : (
    <ToolbarPrimitive.Button
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        isDropdown && "pr-1",
        className,
      )}
      {...props}
    >
      {children}
    </ToolbarPrimitive.Button>
  );
});

export const ToolbarSplitButton = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToolbarButton>) => (
  <ToolbarButton
    className={cn("group flex gap-0 px-0 hover:bg-transparent", className)}
    {...props}
  />
);

type ToolbarSplitButtonPrimaryProps = React.ComponentPropsWithoutRef<typeof ToolbarToggleItem> &
  VariantProps<typeof toolbarButtonVariants>;

export const ToolbarSplitButtonPrimary = ({
  children,
  className,
  size = "sm",
  variant,
  ...props
}: ToolbarSplitButtonPrimaryProps) => (
  <Button
    variant="ghost"
    className={cn(
      toolbarButtonVariants({
        size,
        variant,
      }),
      "rounded-r-none",
      "group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
      className,
    )}
    {...(props as React.ComponentPropsWithoutRef<typeof Button>)}
  >
    {children}
  </Button>
);

export const ToolbarSplitButtonSecondary = ({
  className,
  size,
  variant,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & VariantProps<typeof dropdownArrowVariants>) => (
  <Button
    variant="ghost"
    className={cn(
      dropdownArrowVariants({
        size,
        variant,
      }),
      "group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
      className,
    )}
    onClick={(e) => e.stopPropagation()}
    {...props}
  >
    <ChevronDownIcon className="size-3.5 text-muted-foreground" data-icon aria-hidden="true" />
  </Button>
);

export const ToolbarToggleItem = ({
  className,
  size = "sm",
  variant,
  ...props
}: React.ComponentProps<typeof ToolbarPrimitive.Button> &
  VariantProps<typeof toolbarButtonVariants>) => (
  <ToolbarPrimitive.Button
    className={cn(toolbarButtonVariants({ size, variant }), className)}
    {...props}
  />
);

export const ToolbarGroup = ({ children, className }: React.ComponentProps<"div">) => (
  <div className={cn("group/toolbar-group", "relative hidden has-[button]:flex", className)}>
    <div className="flex items-center">{children}</div>

    <div className="mx-1.5 py-0.5 group-last/toolbar-group:hidden!">
      <Separator orientation="vertical" />
    </div>
  </div>
);

export const ToolbarMenuGroup = ({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup> & { label?: string }) => (
  <>
    <DropdownMenuSeparator
      className={cn(
        "hidden",
        "mb-0 shrink-0 peer-has-[[role=menuitem]]/menu-group:block peer-has-[[role=menuitemradio]]/menu-group:block peer-has-[[role=option]]/menu-group:block",
      )}
    />

    <DropdownMenuRadioGroup
      {...props}
      className={cn(
        "hidden",
        "peer/menu-group group/menu-group my-1.5 has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block has-[[role=option]]:block",
        className,
      )}
    >
      {label && (
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground select-none">
            {label}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
      )}
      {children}
    </DropdownMenuRadioGroup>
  </>
);
