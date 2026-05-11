# TanStack Table v8 → v9 Migration

**Status:** Planned — not started.
**Captured:** 2026-05-11.
**Trigger:** React Compiler incompatibility with v8 caused selection state to desync from rendered cells in `submissions.tsx`. Mitigated with a `"use no memo"` directive on that route. v9 is built for compiler compatibility and removes the root cause, so the directive is debt we want to retire.

## Why we're not doing it now

- v9 is on **alpha.45** as of capture; TanStack's own migration guide is incomplete.
- Production code on alpha = continued churn risk on every alpha bump.
- The bug is unblocked. Pulling the trigger today buys nothing the directive doesn't, and we pay re-migration cost when API stabilises in beta/RC.

**Re-evaluate when:** TanStack Table v9 enters beta or RC, or when the migration guide is marked stable.

## Surface area in this repo

10 files import `@tanstack/react-table` (current `^8.21.3`):

**Data-grid wrapper components** (`src/components/ui/`)

- `data-grid.tsx` — root provider + container, exports `useDataGrid` context
- `data-grid-table.tsx` — biggest file; row/cell/header primitives
- `data-grid-virtual-table.tsx` — virtualized body, memoized
- `data-grid-table-dnd.tsx` / `data-grid-table-dnd-rows.tsx` — DnD column + row reordering
- `data-grid-column-header.tsx` — sort header
- `data-grid-column-filter.tsx` — column filter UI
- `data-grid-column-visibility.tsx` — visibility menu

**Consumers**

- `routes/_authenticated/workspace/$workspaceId/form-builder/$formId/submissions.tsx` — the route hitting the bug today
- `components/form-builder/insights/dropoff-funnel.tsx`

## v8 APIs in use (call-site tally)

| API                     | Count |
| ----------------------- | ----- |
| `Row<T>` type           | 18    |
| `flexRender`            | 15    |
| `columnHelper.*`        | 10    |
| `ColumnDef`             | 10    |
| `Table<T>` type         | 9     |
| `SortingState`          | 7     |
| `Cell<T>` type          | 7     |
| `HeaderGroup<T>`        | 6     |
| `getSortedRowModel`     | 6     |
| `getCoreRowModel`       | 6     |
| `useReactTable`         | 5     |
| `Column<T>` type        | 5     |
| `createColumnHelper`    | 4     |
| `table.options.*` reads | 3     |
| `Header<T>` type        | 3     |
| `getFilteredRowModel`   | 3     |
| `ColumnFiltersState`    | 3     |
| `VisibilityState`       | 2     |
| `RowSelectionState`     | 2     |
| `PinningState`          | 2     |

## v9 breaking changes that hit us

1. **Row models system removed.** v8's `getCoreRowModel()` / `getSortedRowModel()` / `getFilteredRowModel()` plug-ins are replaced by a feature-array on the table options. Every `useReactTable({ ..., getCoreRowModel: getCoreRowModel(), ... })` call site rewrites.
2. **`useReactTable` API shape changes.** Options now take a `_features` array; features compose what was previously plug-ins.
3. **Type imports shift.** `Row<T>` / `Cell<T>` / `Header<T>` / `HeaderGroup<T>` / `Column<T>` / `Table<T>` move; their generics may change shape.
4. **`createColumnHelper` / `ColumnDef`** — column definition surface largely the same but feature-gated capabilities (sorting, filtering, selection) must be enabled in the features array.
5. **`flexRender`** — likely unchanged.
6. **Row state methods (`row.getIsSelected`, `row.toggleSelected`, etc.)** — still available, but require the selection feature to be enabled.
7. **Compiler compatibility.** v9 doesn't call `setOptions` as a side effect during render; the directive on `submissions.tsx` is removable post-migration.

## Migration order (file-by-file)

Do the wrappers before the consumers so we only touch each call site once.

1. **`data-grid.tsx`** — pin which v9 features we enable globally (sorting/filtering/visibility/pinning/selection/expand). The exported `useDataGrid` context type changes; downstream consumers will follow this typing.
2. **`data-grid-table.tsx`** — biggest churn. All `Row<T>` / `Cell<T>` / `Header<T>` props become v9 types. Row pinning + selection methods are feature-gated.
3. **`data-grid-virtual-table.tsx`** — same surface as `data-grid-table.tsx`. The `MemoizedVirtualBody` custom comparator (`isResizingColumn`) needs to be re-validated against v9 state shape.
4. **`data-grid-table-dnd.tsx` + `data-grid-table-dnd-rows.tsx`** — column-order / row-order updates; rewrite handlers against v9's reordering API (if it exists as a feature; check v9 docs at migrate time).
5. **`data-grid-column-header.tsx` / `column-filter.tsx` / `column-visibility.tsx`** — straightforward type swaps; sorting/filtering/visibility move to features.
6. **`dropoff-funnel.tsx`** — small consumer; finish here.
7. **`submissions.tsx`** — the bug case. Remove the `"use no memo"` directive last and verify select-all works under React Compiler.

## Acceptance checks

- `select-all` in the submissions table checks every row checkbox and `data-state="selected"` lights up every `<tr>` — without any `"use no memo"` directive in the codebase.
- DnD column reordering still works.
- DnD row reordering still works.
- Column visibility menu still hides/shows columns.
- Column filters and global filter still narrow the table.
- Sort works on `Submitted at` and any other sortable column.
- Row pinning works in any view that uses `rowsPinnable`.
- The `dropoff-funnel.tsx` insights component still renders.
- `bun run check` and `bun x tsc --noEmit` both clean.

## Things to confirm at migration time

- Current v9 alpha version when migration begins. If still alpha, hold unless beta/RC dropped.
- Whether v9 ships a built-in compiler-compat shim for v8 patterns (would shrink the migration surface).
- Whether the `data-grid*` family in this repo is upstream-vendored from a third party — if so, prefer upgrading the upstream rather than diverging.
