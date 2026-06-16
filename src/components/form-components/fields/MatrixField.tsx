import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

/** Fisher-Yates copy — stable per render (memoized), avoids mutating element.rows. */
const shuffleRows = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

type MatrixValue = Record<string, string | string[]>;

const MatrixField = ({ element, form }: FieldRendererProps<"Matrix">) => {
  const { columns } = element;
  const multiple = Boolean(element.multiple);

  // Shuffle once per mount when enabled, so row order stays stable while answering.
  const rows = useMemo(
    () => (element.shuffle ? shuffleRows(element.rows) : element.rows),
    [element.rows, element.shuffle],
  );

  // Column min is wide enough for typical headers ("Dissatisfied"); deterministic tracks keep
  // every row aligned, and the wrapper scrolls horizontally once the total exceeds the container.
  const gridTemplateColumns = `minmax(120px, 1.6fr) repeat(${columns.length}, minmax(100px, 1fr))`;

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const value = (f.state.value as MatrixValue | undefined) ?? {};

        const selectSingle = (rowValue: string, colValue: string) => {
          // Square markers act as one-per-row: re-clicking the picked column clears it.
          f.handleChange({ ...value, [rowValue]: value[rowValue] === colValue ? "" : colValue });
        };
        const toggleMultiple = (rowValue: string, colValue: string) => {
          const current = Array.isArray(value[rowValue]) ? (value[rowValue] as string[]) : [];
          const next = current.includes(colValue)
            ? current.filter((v) => v !== colValue)
            : [...current, colValue];
          f.handleChange({ ...value, [rowValue]: next });
        };

        const isSelected = (rowValue: string, colValue: string) =>
          multiple
            ? Array.isArray(value[rowValue]) && (value[rowValue] as string[]).includes(colValue)
            : value[rowValue] === colValue;

        return (
          <>
            <div
              className={cn(
                // Shadow-as-border to match the other inputs (border-0 + elevation-sm); hard
                // border only in dark mode, like input.tsx.
                "w-full overflow-hidden rounded-lg bg-background elevation-sm dark:border dark:border-border dark:shadow-none",
                hasErrors && "ring-1 ring-destructive",
              )}
            >
              {/* Horizontal scroll so narrow embeds/popups don't overlap headers. */}
              {/* role=grid lives here so rows stay direct children of the grid. */}
              <div
                role="grid"
                aria-labelledby={getAriaLabelledBy(element)}
                aria-invalid={hasErrors}
                className="overflow-x-auto"
              >
                {/* Column headers */}
                <div
                  role="row"
                  className="grid items-center border-b border-(--color-gray-200) bg-muted/30"
                  style={{ gridTemplateColumns }}
                >
                  <span role="columnheader" className="px-3 py-2" />
                  {columns.map((col) => (
                    <span
                      key={col.value}
                      role="columnheader"
                      className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {col.label}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {rows.map((row, rowIdx) => (
                  <div
                    key={row.value}
                    role="row"
                    className={cn(
                      "grid items-center",
                      rowIdx > 0 && "border-t border-(--color-gray-200)",
                    )}
                    style={{ gridTemplateColumns }}
                  >
                    <span role="rowheader" className="px-3 py-2 text-[14px] text-foreground">
                      {row.label}
                    </span>
                    {columns.map((col) => {
                      const selected = isSelected(row.value, col.value);
                      return (
                        <div
                          key={col.value}
                          role="gridcell"
                          className="flex items-center justify-center py-2"
                        >
                          {/* Rounded square marker (design-system Checkbox) for both modes;
                            single mode enforces one pick per row via selectSingle. */}
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() =>
                              multiple
                                ? toggleMultiple(row.value, col.value)
                                : selectSingle(row.value, col.value)
                            }
                            aria-label={`${row.label}: ${col.label}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default MatrixField;
