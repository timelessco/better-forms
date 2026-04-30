import { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table } from "@tanstack/react-table";

export const DataGridColumnVisibility = <TData,>({
  table,
  trigger,
}: {
  table: Table<TData>;
  trigger: ReactElement;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger render={trigger} />
    <DropdownMenuContent align="end" className="max-h-[60vh] min-w-[220px] overflow-y-auto">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        {table
          .getAllColumns()
          .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="whitespace-nowrap capitalize"
              checked={column.getIsVisible()}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              <span className="truncate">{column.columnDef.meta?.headerTitle || column.id}</span>
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
