import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "@/components/ui/icons";

export const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    aria-label="pagination"
    data-slot="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);

export const PaginationContent = ({ className, ...props }: React.ComponentProps<"ul">) => (
  <ul
    data-slot="pagination-content"
    className={cn("flex items-center gap-0.5", className)}
    {...props}
  />
);

export const PaginationItem = ({ ...props }: React.ComponentProps<"li">) => (
  <li data-slot="pagination-item" {...props} />
);

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

export const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <Button
    variant={isActive ? "outline" : "ghost"}
    size={size}
    className={cn(className)}
    nativeButton={false}
    render={
      <a
        aria-label="Go to page"
        aria-current={isActive ? "page" : undefined}
        data-slot="pagination-link"
        data-active={isActive}
        {...props}
      />
    }
  />
);

export const PaginationPrevious = ({
  className,
  text = "Previous",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("ps-1.5!", className)}
    {...props}
  >
    <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
    <span className="hidden sm:block">{text}</span>
  </PaginationLink>
);

export const PaginationNext = ({
  className,
  text = "Next",
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("pe-1.5!", className)}
    {...props}
  >
    <span className="hidden sm:block">{text}</span>
    <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
  </PaginationLink>
);

export const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    data-slot="pagination-ellipsis"
    className={cn(
      "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
      className,
    )}
    {...props}
  >
    <MoreHorizontalIcon />
    <span className="sr-only">More pages</span>
  </span>
);
