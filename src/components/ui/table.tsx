import * as React from "react";

import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: React.ComponentProps<"table">) => (
  <div data-slot="table-container" className="relative w-full overflow-x-auto">
    <table
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

export const TableHeader = ({ className, ...props }: React.ComponentProps<"thead">) => (
  <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />
);

export const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => (
  <tbody
    data-slot="table-body"
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
);

export const TableFooter = ({ className, ...props }: React.ComponentProps<"tfoot">) => (
  <tfoot
    data-slot="table-footer"
    className={cn("border-t bg-muted/50 [&>tr]:last:border-b-0", className)}
    {...props}
  />
);

export const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => (
  <tr
    data-slot="table-row"
    // Asymmetric hover: 100ms ease-out on enter, duration-0 base so leaving snaps back instantly
    // (single fade-in on B, not the mushy two-fade). Kill border on active row + prev sibling
    // (has-[+tr:hover]) so the highlight reads as one bar, not a stack sliced by row rules.
    className={cn(
      "border-b transition-colors duration-0 data-[state=selected]:bg-muted",
      "hover:border-transparent hover:bg-muted/50 hover:duration-100 hover:ease-out",
      "has-[+tr:hover]:border-transparent",
      className,
    )}
    {...props}
  />
);

export const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => (
  <th
    data-slot="table-head"
    className={cn(
      "h-10 px-2 text-start align-middle whitespace-nowrap text-foreground [&:has([role=checkbox])]:pe-0",
      className,
    )}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => (
  <td
    data-slot="table-cell"
    className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0", className)}
    {...props}
  />
);

export const TableCaption = ({ className, ...props }: React.ComponentProps<"caption">) => (
  <caption
    data-slot="table-caption"
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
);
