import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { DataGrid, DataGridContainer } from "@/components/ui/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid-column-header";
import { DataGridTable } from "@/components/ui/data-grid-table";
import type { QuestionDropoffMetrics } from "@/types/analytics";

interface DropoffFunnelProps {
  dropoff: QuestionDropoffMetrics;
}

type DropoffRow = QuestionDropoffMetrics["questions"][number];

const numberFormatter = new Intl.NumberFormat("en-US");

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return `${Math.round(value)}%`;
};

// Synthetic IDs from the tracking layer look like `step_0`, `step_1`. Render
// them as "Step 1", "Step 2" (1-indexed) so the user-facing copy matches the
// step counter on the public form. Custom question IDs are left as-is.
const STEP_ID_RE = /^step_(\d+)$/;
const formatQuestionLabel = (row: DropoffRow): string => {
  if (row.questionLabel) {
    return row.questionLabel;
  }
  const match = row.questionId.match(STEP_ID_RE);
  if (match) {
    return `Step ${Number(match[1]) + 1}`;
  }
  return row.questionId;
};

interface SummaryStatProps {
  label: string;
  value: string;
}

const SummaryStat = ({ label, value }: SummaryStatProps) => (
  <div className="flex flex-col gap-1 px-3 py-2">
    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {label}
    </span>
    <span className="text-lg font-semibold text-foreground tabular-nums">{value}</span>
  </div>
);

const toDropoffColumn = <TValue,>(column: ColumnDef<DropoffRow, TValue>): ColumnDef<DropoffRow> =>
  column as ColumnDef<DropoffRow>;

export const DropoffFunnel = ({ dropoff }: DropoffFunnelProps) => {
  const [sorting, setSorting] = useState<SortingState>([{ id: "step", desc: false }]);

  const sortedQuestions = useMemo(
    () => [...dropoff.questions].sort((a, b) => a.questionIndex - b.questionIndex),
    [dropoff.questions],
  );

  const columns = useMemo<ColumnDef<DropoffRow>[]>(() => {
    const columnHelper = createColumnHelper<DropoffRow>();
    return [
      toDropoffColumn(
        columnHelper.accessor("questionIndex", {
          id: "step",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Step" />,
          cell: (info) => (
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {info.getValue() + 1}
            </span>
          ),
          size: 80,
          minSize: 60,
        }),
      ),
      toDropoffColumn(
        columnHelper.accessor("questionLabel", {
          id: "label",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Question" />,
          cell: (info) => {
            const text = formatQuestionLabel(info.row.original);
            return (
              <span className="block truncate text-[13px]" title={text}>
                {text}
              </span>
            );
          },
          size: 280,
          minSize: 160,
        }),
      ),
      toDropoffColumn(
        columnHelper.accessor("viewCount", {
          id: "viewed",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Viewed" />,
          cell: (info) => (
            <span className="text-[13px] tabular-nums">
              {numberFormatter.format(info.getValue())}
            </span>
          ),
          size: 110,
        }),
      ),
      toDropoffColumn(
        columnHelper.accessor("startCount", {
          id: "started",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Started" />,
          cell: (info) => (
            <span className="text-[13px] tabular-nums">
              {numberFormatter.format(info.getValue())}
            </span>
          ),
          size: 110,
        }),
      ),
      toDropoffColumn(
        columnHelper.accessor("completeCount", {
          id: "completed",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Completed" />,
          cell: (info) => (
            <span className="text-[13px] tabular-nums">
              {numberFormatter.format(info.getValue())}
            </span>
          ),
          size: 110,
        }),
      ),
      toDropoffColumn(
        columnHelper.accessor("dropoffRate", {
          id: "dropoff",
          header: ({ column }) => <DataGridColumnHeader column={column} title="Drop-off %" />,
          cell: (info) => (
            <span className="text-[13px] tabular-nums">{formatPercent(info.getValue())}</span>
          ),
          size: 130,
        }),
      ),
    ];
  }, []);

  const table = useReactTable({
    data: sortedQuestions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.questionId,
  });

  if (!dropoff || dropoff.questions.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No drop-off data yet — multi-step / field-by-field forms only.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataGrid
        table={table}
        recordCount={sortedQuestions.length}
        tableLayout={{
          dense: true,
          headerBackground: false,
          headerBorder: true,
          rowBorder: true,
          width: "auto",
        }}
      >
        <DataGridContainer border={false}>
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryStat label="Total started" value={numberFormatter.format(dropoff.totalStarted)} />
        <SummaryStat
          label="Total completed"
          value={numberFormatter.format(dropoff.totalCompleted)}
        />
        <SummaryStat
          label="Overall completion"
          value={formatPercent(dropoff.overallCompletionRate)}
        />
      </div>
    </div>
  );
};
