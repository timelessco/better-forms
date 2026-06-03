import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ValidateLinkOptions } from "@tanstack/react-router";
import * as React from "react";
import { SidebarMenuButton } from "./ui/sidebar";

// Roving arrow-key nav across every sidebar row. Each item carries [data-sidebar-item]; Up/Down
// moves focus to the previous/next one in DOM (== visual) order. stopPropagation keeps the key
// from bubbling to the dnd-kit drag wrapper.
const handleSidebarItemKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  e.stopPropagation();
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-item]"));
  const idx = items.indexOf(e.currentTarget);
  if (idx < 0) return;
  items[idx + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
};

export interface SidebarItemProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  linkOptions?: ValidateLinkOptions<TRouter, TOptions>;
  label: string;
  isNested?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  prefix?: React.ReactNode;
  className?: string;
}

export function SidebarItem<TRouter extends RegisteredRouter, TOptions>(
  props: SidebarItemProps<TRouter, TOptions> & { children?: React.ReactNode },
): React.ReactNode;
export function SidebarItem({
  linkOptions,
  label,
  isActive,
  onClick,
  prefix,
  children,
  className,
}: SidebarItemProps & { children?: React.ReactNode }): React.ReactNode {
  const Component: React.ElementType = linkOptions ? Link : SidebarMenuButton;
  const componentProps = linkOptions ?? { type: "button" as const };

  return (
    <Component
      {...componentProps}
      data-sidebar-item=""
      onClick={onClick}
      onKeyDown={handleSidebarItemKeyDown}
      className={cn(
        "group relative flex h-[30px] w-full cursor-pointer items-center justify-between gap-x-2 overflow-clip rounded-lg px-2 py-[7px] text-base font-[450] tracking-[0.14px] transition-colors",
        // Inset ring: an outset outline gets clipped by the Favorites Accordion panel's
        // overflow-hidden; inset is the element's own decoration, so it's never clipped.
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
        "text-sidebar-foreground",
        !isActive && "hover:bg-secondary",
        isActive && "bg-secondary text-sidebar-foreground",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center justify-center [&>svg]:size-[18px]">
          {prefix}
        </div>
        <span className="truncate font-case">{label}</span>
      </span>
      {children}
    </Component>
  );
}
