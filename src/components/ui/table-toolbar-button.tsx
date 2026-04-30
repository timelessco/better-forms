import { TablePlugin, useTableMergeState } from "@platejs/table/react";

import { ArrowDown, ArrowUp, Combine, Grid3x3Icon, Table, Ungroup } from "lucide-react";
import { ArrowLeftIcon, ArrowRightIcon, Trash2Icon, XIcon } from "@/components/ui/icons";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector } from "platejs/react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ToolbarButton } from "./toolbar";

type TablePickerCell = {
  id: string;
  active: boolean;
};

const createInitialTableGrid = () =>
  Array.from({ length: 8 }, (_unused, rowIndex) =>
    Array.from({ length: 8 }, (_item, columnIndex) => ({
      id: `table-picker-${rowIndex}-${columnIndex}`,
      active: false,
    })),
  );

export const TableToolbarButton = (props: React.ComponentProps<typeof DropdownMenu>) => {
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: KEYS.table } }),
    [],
  );

  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = React.useState(false);
  const mergeState = useTableMergeState();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger render={<ToolbarButton pressed={open} tooltip="Table" isDropdown />}>
        <Table />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="flex w-[180px] min-w-0 flex-col" align="start">
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <Grid3x3Icon className="size-4" />
              <span>Table</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="m-0 p-0">
              <TablePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>Cell</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canMerge}
                onSelect={() => {
                  tf.table.merge();
                  editor.tf.focus();
                }}
              >
                <Combine />
                Merge cells
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canSplit}
                onSelect={() => {
                  tf.table.split();
                  editor.tf.focus();
                }}
              >
                <Ungroup />
                Split cell
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>Row</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowUp />
                Insert row before
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow();
                  editor.tf.focus();
                }}
              >
                <ArrowDown />
                Insert row after
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableRow();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete row
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>Column</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowLeftIcon />
                Insert column before
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn();
                  editor.tf.focus();
                }}
              >
                <ArrowRightIcon />
                Insert column after
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableColumn();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="min-w-[180px]"
            disabled={!tableSelected}
            onSelect={() => {
              tf.remove.table();
              editor.tf.focus();
            }}
          >
            <Trash2Icon />
            Delete table
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
  }
};

const TablePicker = () => {
  const { editor, tf } = useEditorPlugin(TablePlugin);

  const [tablePicker, setTablePicker] = React.useState<{
    grid: TablePickerCell[][];
    size: { colCount: number; rowCount: number };
  }>(() => ({
    grid: createInitialTableGrid(),
    size: { colCount: 0, rowCount: 0 },
  }));

  const onCellMove = (rowIndex: number, colIndex: number) => {
    setTablePicker((prev) => ({
      grid: prev.grid.map((rows, currentRow) =>
        rows.map((cell, currentCol) => ({
          ...cell,
          active: currentRow <= rowIndex && currentCol <= colIndex,
        })),
      ),
      size: { colCount: colIndex + 1, rowCount: rowIndex + 1 },
    }));
  };
  const handleInsertTable = () => {
    tf.insert.table(tablePicker.size, { select: true });
    editor.tf.focus();
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      handleInsertTable();
    }
  };

  return (
    <Button
      variant="ghost"
      className="m-0 flex! h-auto flex-col p-0 hover:bg-transparent"
      onClick={handleInsertTable}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label="Insert table"
    >
      <div className="grid size-[130px] grid-cols-8 gap-0.5 p-1">
        {tablePicker.grid.map((rows, rowIndex) =>
          rows.map((cell, columnIndex) => (
            <span
              aria-hidden="true"
              key={cell.id}
              className={cn(
                "col-span-1 size-3 border border-solid bg-secondary",
                cell.active && "border-current",
              )}
              onMouseMove={() => {
                onCellMove(rowIndex, columnIndex);
              }}
            />
          )),
        )}
      </div>

      <div className="text-center text-xs text-current">
        {tablePicker.size.rowCount} x {tablePicker.size.colCount}
      </div>
    </Button>
  );
};
