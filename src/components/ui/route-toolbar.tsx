import type { ComponentProps, ReactElement, ReactNode } from "react";

import { FigSearchAltIcon } from "@/components/dashboard/dashboard-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Shared route-toolbar primitives (dashboard / analytics / submissions). The gray "pill", the search
// pill, the CSV/PDF/Excel export menu, and the two-icon grid/list toggle were hand-rewritten in every
// toolbar; these consolidate the class strings + typography so the Figma spec stays single-sourced.

// Gray secondary pill (Figma 26208:8074). font-case 14px/450 gray-800; icons size-4 gray-800.
export const TOOLBAR_PILL_CLS =
  "h-7 rounded-lg bg-secondary px-2 font-case text-base font-[450] tracking-[0.14px] text-gray-800 hover:bg-secondary/80 [&_svg]:size-4 [&_svg]:text-gray-800";

// Styled Button; callers keep their own children / prefix / suffix (padding differs by icon slot).
export const ToolbarPill = ({ className, ...props }: ComponentProps<typeof Button>) => (
  <Button variant="ghost-flat" size="sm" className={cn(TOOLBAR_PILL_CLS, className)} {...props} />
);

// 170px search pill (Figma 26835:10024 / 27015:16994) — search-alt icon + transparent input.
export const ToolbarSearch = ({
  value,
  onChange,
  placeholder = "Search",
  className,
  ...inputProps
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
} & Omit<ComponentProps<"input">, "value" | "onChange" | "className" | "placeholder">) => (
  <div
    className={cn(
      "flex h-7 w-[170px] items-center gap-1.5 rounded-lg bg-secondary pr-2.5 pl-2",
      className,
    )}
  >
    <FigSearchAltIcon className="size-4 shrink-0 text-muted-foreground" />
    <input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-transparent font-case text-base font-[450] tracking-[0.14px] text-foreground outline-none placeholder:text-muted-foreground"
      {...inputProps}
    />
  </div>
);

// CSV / PDF / Excel export dropdown. `trigger` is the render element; its label is `children`.
export const ExportMenu = ({
  onExport,
  trigger,
  children,
  contentClassName = "w-36",
}: {
  onExport: (format: "csv" | "pdf" | "excel") => void;
  trigger: ReactElement;
  children: ReactNode;
  contentClassName?: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={contentClassName}>
      <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onExport("pdf")}>PDF</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onExport("excel")}>Excel</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// Square icon-only trigger for the segmented toggle: w-[26px] (sm trigger is already h-6.5),
// flex-none + px-0! drop the stretch/padding the text-tab variant applies.
const VIEW_TOGGLE_TAB = "w-[26px] flex-none px-0! text-muted-foreground";

export type ViewToggleOption<T extends string> = {
  value: T;
  icon: ReactNode;
  /** aria-label for the icon-only trigger. */
  label: string;
};

// Two-icon segmented control (Figma 26208:8090 / 26586:29914) — shared animated Tabs so the active
// pill slides. `listClassName` covers per-toolbar deltas (e.g. submissions adds a muted track).
export const ViewToggle = <T extends string>({
  value,
  onValueChange,
  options,
  listClassName,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly [ViewToggleOption<T>, ViewToggleOption<T>];
  listClassName?: string;
}) => (
  <Tabs value={value} onValueChange={(next) => onValueChange(next as T)}>
    <TabsList className={cn("gap-1 rounded-lg", listClassName)}>
      {options.map((opt) => (
        <TabsTrigger
          key={opt.value}
          value={opt.value}
          aria-label={opt.label}
          className={VIEW_TOGGLE_TAB}
        >
          {opt.icon}
        </TabsTrigger>
      ))}
      <TabsIndicator />
    </TabsList>
  </Tabs>
);
