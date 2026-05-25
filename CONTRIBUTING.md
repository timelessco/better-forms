# Contributing to Better Form

Thank you for your interest in contributing! This guide will help you get set up and understand our workflow.

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies** with `pnpm install`
3. **Copy environment variables** — `cp .env.example .env` and fill in required values
4. **Set up the database** — `pnpm db:generate && pnpm db:migrate`
5. **Start developing** — `pnpm dev`

## Code Quality

This project uses [oxlint](https://oxc.rs/docs/guide/usage/linter) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (configured in `.oxlintrc.json`) for automated code quality enforcement.

Before committing, run:

```bash
pnpm fix       # Auto-fix lint and formatting issues
pnpm check     # Verify everything passes
```

Pre-commit hooks are managed by [Lefthook](https://github.com/evilmartians/lefthook) and run automatically on commit.

## Code Style

- **TypeScript** — Use explicit types where they enhance clarity. Prefer `unknown` over `any`.
- **React** — Function components only. Follow the Rules of Hooks.
- **Styling** — Tailwind CSS v4 with shadcn/ui components. Reuse existing UI primitives from `src/components/ui/`.
- **Imports** — Use the `@/` path alias for project imports.
- **Constants** — Use `const` by default, `let` only when reassignment is needed.
- **Error handling** — Throw `Error` objects with descriptive messages. Prefer early returns.

See [CLAUDE.md](.claude/CLAUDE.md) for the full code standards reference.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/add-date-picker-field`
- `fix/submission-count-mismatch`
- `refactor/editor-plugin-loading`

### Commit Messages

Write concise commit messages that focus on **why** rather than what:

```
feat: add password protection for shared forms
fix: resolve race condition in real-time sync
refactor: lazy-load editor plugins for faster initial load
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure all checks pass (`pnpm check` and `pnpm test`)
4. Open a PR with:
   - A short title (under 70 characters)
   - A summary of what changed and why
   - Testing steps if applicable

## Project Structure Overview

- **`src/routes/`** — File-based routing (TanStack Router). Authenticated routes live under `_authenticated/`.
- **`src/components/editor/`** — Plate.js editor configuration and plugins.
- **`src/components/form-builder/`** — Form builder UI components.
- **`src/components/ui/`** — Shared UI primitives (shadcn/ui based).
- **`src/db/`** — Database schema definitions (Drizzle ORM).
- **`src/db-collections/`** — TanStack DB collection definitions for local-first sync.
- **`src/lib/`** — Core utilities — auth, email, config, and helpers.

## Database Changes

When modifying the database schema in `src/db/schema.ts`:

1. Make your schema changes
2. Generate a migration — `pnpm db:generate`
3. Apply the migration — `pnpm db:migrate`
4. Include the generated migration files in your PR

## Testing

Run the test suite with:

```bash
pnpm run test
```

Tests use [Vitest](https://vitest.dev) with [Testing Library](https://testing-library.com).

## Need Help?

If you run into issues or have questions, open a GitHub issue and we'll be happy to help.
