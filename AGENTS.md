# Reform — Agent Guide

Reform is a TanStack Start (Router + Vite) + React 19 app with TanStack DB collections, Drizzle ORM, Better Auth, Polar billing, the Plate.js editor, and the AI SDK.

## Quick Reference

- **Format / fix**: `bun x ultracite fix`
- **Check**: `bun x ultracite check`
- **Lint**: `bun lint` (oxlint --type-aware + knip)
- **Typecheck**: `bun typecheck`
- **Tests**: `bun run test` (runs Vitest via the package script). Do **not** use `bun test` — that invokes Bun's built-in runner, which doesn't implement parts of the Vitest API the suite uses (`vi.stubGlobal`, `vi.unstubAllGlobals`, etc.) and silently fails those tests. To run a single file, use `bun x vitest run path/to/file.test.ts`.
- **Dev server**: `bun dev` (or `bun dev:auto` to pick a free port)

Ultracite (Oxlint + Oxfmt) enforces formatting, type safety, accessibility, security, and most code-quality rules automatically. Run `bun x ultracite fix` before committing — focus your judgement on what the linter can't check: business logic, naming, architecture, edge cases, UX.

## Stack-Specific Guidance

**TanStack Start / Router**

- File-based routes under `src/routes/`. `src/routeTree.gen.ts` is generated — never edit by hand.
- Use typed `Link` and `useNavigate()` from `@tanstack/react-router`.
- Backend logic goes in server functions (`createServerFn`), not ad-hoc API routes.
- Reach for route loaders + `staleTime` before client-side fetching.
- For auth gates, search-param validation, code-splitting, and not-found handling, follow the TanStack Router skill files referenced in `.claude/CLAUDE.md`.

**TanStack DB**

- Client state lives in collections under `src/collections/` and `src/db/`. Use query-based collections — this project does **not** use Electric SQL.
- Follow the `mutations-optimistic` and `live-queries` skills for writes and reads.

**React 19+**

- `ref` is a prop — don't use `React.forwardRef`.
- Prefer server functions over async Client Components for data fetching.

**Plate.js editor**

- For text truncation inside a `PlateElement`, use `line-clamp-1` (not `text-ellipsis`).

**Drizzle ORM**

- Schema in `src/db/`. Use `bun db:generate | db:migrate | db:push | db:studio`.

## Testing

- Vitest. Assertions inside `it()` / `test()`. Use async/await, not done callbacks. No `.only` / `.skip` committed.
- Match the current typed `vi.mock` signature — don't regress to older shapes.
- Always run via `bun run test` (or `bun x vitest run <file>` for a single file). `bun test` is a different runner — it skips/fails Vitest-only APIs without warning.

## Agent skills

- **Issue tracker** — GitHub Issues on `timelessco/reform` via the `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context (`CONTEXT.md` and `docs/adr/` at root, created lazily). See `docs/agents/domain.md`.
