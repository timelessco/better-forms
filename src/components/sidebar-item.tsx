import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { RegisteredRouter, ValidateLinkOptions } from "@tanstack/react-router";
import * as React from "react";
import { SidebarMenuButton } from "./ui/sidebar";

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
}: SidebarItemProps & { children?: React.ReactNode }): React.ReactNode {
  const Component: React.ElementType = linkOptions ? Link : SidebarMenuButton;
  const componentProps = linkOptions ?? { type: "button" as const };

  return (
    <Component
      {...componentProps}
      onClick={onClick}
      className={cn(
        "group relative flex h-[30px] w-full cursor-pointer items-center justify-between gap-x-2 overflow-clip rounded-lg px-2 py-[7px] text-base font-[450] tracking-[0.14px] transition-colors",
        "text-sidebar-foreground",
        !isActive && "hover:bg-secondary",
        isActive && "bg-secondary text-sidebar-foreground",
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
