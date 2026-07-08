# Reform

Reform is a TanStack Start (Router + Vite) + React 19 app with TanStack DB collections, Drizzle ORM, Better Auth, Polar billing, the Plate.js editor, and the AI SDK.

## Quick Reference

- **Install**: `pnpm install` (`--frozen-lockfile` in CI)
- **Format / fix**: `pnpm fix` (oxfmt, then oxlint `--fix`)
- **Check**: `pnpm run check` (oxfmt `--check`, then oxlint + knip)
- **Typecheck**: `pnpm exec tsc --noEmit` (the `pnpm typecheck` script runs oxlint's type-check, not tsc)
- **Tests**: `pnpm run test` (Vitest); single file: `pnpm exec vitest run path/to/file.test.ts`
- **Dev server**: `pnpm dev` (`pnpm dev:auto` picks a free port)
- **Run TS scripts**: `pnpm exec tsx scripts/<name>.ts`

## TanStack Start / Router

- File-based routes under `src/routes/`; `src/routeTree.gen.ts` is generated — never edit by hand.
- Backend logic goes in server functions (`createServerFn`), not ad-hoc API routes.
- Reach for route loaders + `staleTime` before client-side fetching.
- Use typed `Link` and `useNavigate()` from `@tanstack/react-router`.
- For routing patterns (auth gates, search params, code splitting, not-found), load the matching skill file listed in `.claude/CLAUDE.md`.

## TanStack DB / Drizzle

- Client state lives in query-based collections under `src/collections/` and `src/db/`; for writes and reads, load the `mutations-optimistic` and `live-queries` skills listed in `.claude/CLAUDE.md`.
- DB schema in `src/db/`; inspect with `pnpm db:studio`.
- Do NOT run `db:generate` / `db:migrate` / `db:push` — migration tracking has drifted from `schema.ts`, and `db:push` wants to DROP non-empty tables. Apply additive, idempotent DDL via a tsx script against `DIRECT_URL` instead.

## Agent skills

- **Issue tracker** — GitHub Issues on `timelessco/reform` via the `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context (`CONTEXT.md` and `docs/adr/` at root, created lazily). See `docs/agents/domain.md`.
