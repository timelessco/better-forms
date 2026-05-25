# TanStack Table v8 → v9 Migration

**Status:** In progress (2026-05-12).
**Captured:** 2026-05-11.
**Trigger:** React Compiler incompatibility with v8 caused selection state to desync from rendered cells in `submissions.tsx`. Mitigated with a `"use no memo"` directive on that route. v9 is built for compiler compatibility and removes the root cause, so the directive is debt we want to retire.

## Version pin

- **Installed:** `@tanstack/react-table@9.0.0-alpha.42` (oldest v9 alpha that passes the 7-day `.npmrc` quarantine on 2026-05-12).
- v9 is still alpha — there is **no beta yet** (the `beta` dist-tag points to `8.0.0-beta.9`, a v8 pre-release). Re-evaluate version pin when `alpha.45+` ages into the quarantine (around 2026-05-15) or when v9 enters real beta/RC.
- Migration guide at `tanstack.com/table/alpha/docs/...` is still incomplete; rely on the `./legacy` shim and source-reading rather than the guide.

## Migration strategy: legacy shim, not feature-array rewrite

v9 ships a `@tanstack/react-table/legacy` subpath that is a near-drop-in v8 compat layer:

- `useLegacyTable` replaces `useReactTable`.
- All v8 type names preserved as `Legacy*` aliases: `LegacyRow`, `LegacyCell`, `LegacyHeader`, `LegacyHeaderGroup`, `LegacyColumn`, `LegacyTable`, `LegacyColumnDef`.
- `legacyCreateColumnHelper` replaces `createColumnHelper`.
- All `get*RowModel()` getters (`getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getExpandedRowModel`, `getPaginationRowModel`, `getFacetedRowModel`, `getFacetedMinMaxValues`, `getFacetedUniqueValues`, `getGroupedRowModel`) are preserved as marker stubs — call sites don't change.
- **`useLegacyTable` is React Compiler safe.** Internally it calls the new `useTable` hook with `_features: stockFeatures`. `_rowModels` is stabilised via `useState(() => …)`, and the return value is wrapped in `useMemo`. No `setOptions`-during-render side effect — which is the exact v8 pattern that broke the compiler.
- `flexRender` is still on the root export.
- State types (`SortingState`, `ColumnFiltersState`, `VisibilityState`, `RowSelectionState`, `PinningState`, `RowData`) are re-exported from the root path via `export * from "@tanstack/table-core"` — **not** from `./legacy`. Import these from `@tanstack/react-table` (root).
- `table.options.enableRowSelection` reads still work — the v9 Table type still exposes `readonly options`.

### Import rewrite recipe

Per file:

```ts
// before
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import type {
  Row,
  Cell,
  Header,
  HeaderGroup,
  Column,
  Table,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  PinningState,
} from "@tanstack/react-table";

// after
import {
  useLegacyTable as useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  legacyCreateColumnHelper as createColumnHelper,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import type {
  LegacyRow as Row,
  LegacyCell as Cell,
  LegacyHeader as Header,
  LegacyHeaderGroup as HeaderGroup,
  LegacyColumn as Column,
  LegacyTable as Table,
  LegacyColumnDef as ColumnDef,
} from "@tanstack/react-table/legacy";
import type {
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  PinningState,
} from "@tanstack/react-table";
```

The `as X` aliases mean call-site code (e.g. `Row<T>`, `useReactTable({...})`, `createColumnHelper<T>()`) is unchanged.

## Surface area in this repo

10 files import `@tanstack/react-table`:

**Data-grid wrapper components** (`src/components/ui/`)

- `data-grid.tsx` — root provider + container, exports `useDataGrid` context
- `data-grid-table.tsx` — biggest file; row/cell/header primitives
- `data-grid-virtual-table.tsx` — virtualized body, memoized
- `data-grid-table-dnd.tsx` / `data-grid-table-dnd-rows.tsx` — DnD column + row reordering
- `data-grid-column-header.tsx` — sort header
- `data-grid-column-filter.tsx` — column filter UI
- `data-grid-column-visibility.tsx` — visibility menu

**Consumers**

- `routes/_authenticated/workspace/$workspaceId/form-builder/$formId/submissions.tsx` — the route hitting the bug today (`"use no memo"` directive in place)
- `components/form-builder/insights/dropoff-funnel.tsx`

## Migration order

Same order as before. Each step is now mostly an import rewrite + type alias swap, **not** a feature-array rewrite.

1. **`data-grid.tsx`** — switch imports; `useDataGrid` context type unchanged thanks to alias.
2. **`data-grid-table.tsx`** — biggest file but mechanical. Verify `table.options.enableRowSelection` reads still typecheck.
3. **`data-grid-virtual-table.tsx`** — same as above. Verify `MemoizedVirtualBody`'s `isResizingColumn` comparator still reads the same state shape (it should — legacy preserves v8 state-access patterns).
4. **`data-grid-table-dnd.tsx` + `data-grid-table-dnd-rows.tsx`** — DnD handlers read column order / row order from `table.getState()` and update via `setColumnOrder` / `setRowSelection` etc. Those state-access methods are preserved by the legacy shim.
5. **`data-grid-column-header.tsx` / `column-filter.tsx` / `column-visibility.tsx`** — type swaps only.
6. **`dropoff-funnel.tsx`** — small consumer.
7. **`submissions.tsx`** — migrate imports, then **remove the `"use no memo"` directive** and verify select-all works under React Compiler.

## Acceptance checks

- `select-all` in the submissions table checks every row checkbox and `data-state="selected"` lights up every `<tr>` — without any `"use no memo"` directive in the codebase.
- DnD column reordering still works.
- DnD row reordering still works.
- Column visibility menu still hides/shows columns.
- Column filters and global filter still narrow the table.
- Sort works on `Submitted at` and any other sortable column.
- Row pinning works in any view that uses `rowsPinnable`.
- The `dropoff-funnel.tsx` insights component still renders.
- `pnpm run check` and `pnpm exec tsc --noEmit` both clean.

## Things to confirm at migration time

- ~~Current v9 alpha version when migration begins. If still alpha, hold unless beta/RC dropped.~~ Resolved — pinned to alpha.42 by user override (2026-05-12).
- ~~Whether v9 ships a built-in compiler-compat shim for v8 patterns (would shrink the migration surface).~~ Resolved — yes, the `./legacy` subpath. This is the strategy.
- Whether the `data-grid*` family in this repo is upstream-vendored from a third party — if so, prefer upgrading the upstream rather than diverging. (Still open — but for a shim-based migration this is low risk because the import rewrite is mechanical and easy to redo against an upstream bump.)
