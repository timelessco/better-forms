import { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// eslint-disable-next-line import/no-cycle -- registered into createTableHook's tableComponents in data-grid.tsx
import { useTableContext } from "@/components/ui/data-grid";

export const DataGridColumnVisibility = ({ trigger }: { trigger: ReactElement }) => {
  const table = useTableContext();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" className="max-h-[60vh] min-w-[220px] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
          {table.getAllColumns().flatMap((column) => {
            if (typeof column.accessorFn === "undefined" || !column.getCanHide()) return [];
            return [
              <DropdownMenuCheckboxItem
                key={column.id}
                className="whitespace-nowrap capitalize"
                checked={column.getIsVisible()}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                <span className="truncate">{column.columnDef.meta?.headerTitle || column.id}</span>
              </DropdownMenuCheckboxItem>,
            ];
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
