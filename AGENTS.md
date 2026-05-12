# Reform — Agent Guide

Reform is a TanStack Start (Router + Vite) + React 19 app with TanStack DB collections, Drizzle ORM, Better Auth, Polar billing, the Plate.js editor, and the AI SDK.

## STOP — Package manager rules (read first)

**Never run `bun`, `bun x`, `bun run`, or `bunx` in this repository.** This includes invoking binaries: no `bun x tsc`, `bun x vitest`, `bun x oxlint`, `bun x knip`, `bun x prettier`, etc. Use `pnpm` / `pnpm exec` for everything. Mise installs `node` 24.x; pnpm-installed binaries shell out to node and will not work under Bun's runtime.

Why this matters (real failures observed in this repo):

- `bun x vitest run …` silently skips vitest's `vi.mock` hoisting transform, so mocked modules resolve to the real implementation and tests fail with bogus `vi.mocked(x).mockResolvedValue is not a function` errors. The same tests pass under `pnpm exec vitest run`.
- `bun x tsc --noEmit` can pass while `pnpm exec tsc --noEmit` fails (different module-resolution behavior with the project's `tsconfig.json`).
- Lefthook pre-commit / pre-push hooks invoke `pnpm exec …`, which calls `node`. If you verified locally under Bun and saw green, the hooks will still fail in the user's shell when pushing — and `--no-verify` is **not** the answer. Re-run the checks under `pnpm exec` and fix any real failures before pushing.

If a check passes for you, re-run it under `pnpm exec` before claiming success or pushing. If `node` isn't on PATH inside your shell, run `eval "$(mise activate bash)"` first — node is installed via mise.

The `.npmrc` also sets `minimum-release-age=10080` (7 days) to quarantine fresh registry publishes as a supply-chain defense. `ERR_PNPM_NO_MATURE_MATCHING_VERSION` from `pnpm install` is that defense working — widen or pin the semver, don't add to `minimum-release-age-exclude` without a real reason.

## Quick Reference

- **Install**: `pnpm install` (use `--frozen-lockfile` in CI)
- **Format / fix**: `pnpm fix` (runs `oxfmt .` then `oxlint --type-aware --fix`)
- **Check**: `pnpm run check` (runs `oxfmt --check` then `oxlint --type-aware && knip`)
- **Lint**: `pnpm lint` (oxlint --type-aware + knip)
- **Typecheck**: `pnpm exec tsc --noEmit` (the `pnpm typecheck` script runs oxlint's type-check, which is separate)
- **Tests**: `pnpm run test` (Vitest). To run a single file: `pnpm exec vitest run path/to/file.test.ts`.
- **Dev server**: `pnpm dev` (or `pnpm dev:auto` to pick a free port)
- **Run TS scripts**: `pnpm exec tsx scripts/<name>.ts`

Oxlint + Oxfmt (configured via `.oxlintrc.json`) enforce formatting, type safety, accessibility, security, and most code-quality rules automatically. Run `pnpm fix` before committing — focus your judgement on what the linter can't check: business logic, naming, architecture, edge cases, UX.

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

- Schema in `src/db/`. Use `pnpm db:generate | db:migrate | db:push | db:studio`.

## Testing

- Vitest. Assertions inside `it()` / `test()`. Use async/await, not done callbacks. No `.only` / `.skip` committed.
- Match the current typed `vi.mock` signature — don't regress to older shapes.
- Always run via `pnpm run test` (or `pnpm exec vitest run <file>` for a single file).

## Agent skills

- **Issue tracker** — GitHub Issues on `timelessco/reform` via the `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels** — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.
- **Domain docs** — single-context (`CONTEXT.md` and `docs/adr/` at root, created lazily). See `docs/agents/domain.md`.
