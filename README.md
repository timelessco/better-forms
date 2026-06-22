# Better Form

A modern form builder application that lets you create, customize, and share beautiful forms with a rich text editor experience. Built with a real-time local-first architecture for instant responsiveness.

## Features

- **Rich Form Editor** — Block-based editor powered by Plate.js with support for text formatting, media, tables, code blocks, math equations, callouts, and more
- **AI Assistance** — AI-powered content generation and editing within the form builder
- **Form Submissions** — Collect and manage responses with a built-in data grid view
- **Drag & Drop** — Reorder form elements with intuitive drag-and-drop interactions
- **Embeddable Forms** — Share forms via direct links or embed them in external sites
- **Password Protection** — Restrict form access with password gates
- **Workspaces & Organizations** — Multi-tenant workspace management with team invitations and role-based access
- **Billing & Subscriptions** — Integrated payment handling via Polar
- **Theme Support** — Light and dark mode with customizable styling
- **Real-time Sync** — Local-first data layer with TanStack DB (query-based, local-first collections) for instant UI updates

## Tech Stack

| Layer        | Technology                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Framework    | [TanStack Start](https://tanstack.com/start) (Vite + React 19)                                                     |
| Routing      | [TanStack Router](https://tanstack.com/router) (file-based, type-safe)                                             |
| Data         | [TanStack DB](https://tanstack.com/db) (query-based, local-first collections)                                      |
| Database     | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)                                                               |
| Auth         | [Better Auth](https://www.better-auth.com) (email/password, OTP, 2FA, organizations)                               |
| Editor       | [Plate.js](https://platejs.org) (rich text, block-based)                                                           |
| UI           | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| AI           | [Vercel AI SDK](https://sdk.vercel.ai)                                                                             |
| Payments     | [Polar](https://polar.sh)                                                                                          |
| File Uploads | [Vercel Blob](https://vercel.com/docs/vercel-blob)                                                                 |
| Monitoring   | [Sentry](https://sentry.io)                                                                                        |
| Server       | [Nitro](https://nitro.unjs.io)                                                                                     |

## Prerequisites

- [Node.js](https://nodejs.org) 24.x
- [pnpm](https://pnpm.io) (`corepack enable` or `npm i -g pnpm`)
- [PostgreSQL](https://www.postgresql.org) database

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd better-form
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values in `.env` (database URL, auth secrets, API keys, etc.).

4. **Set up the database**

   Point `DATABASE_URL` / `DIRECT_URL` at your Postgres instance, then apply the
   schema as described in [CONTRIBUTING.md → Database changes](CONTRIBUTING.md#database-changes).

   > ⚠️ **Database commands are not safe to run blindly in this repo.**
   > Migration tracking has drifted from `src/db/schema.ts`; `pnpm db:push` will
   > try to DROP existing tables. Do **not** run `db:push` / `db:migrate` /
   > `db:generate` without coordinating with a maintainer. Schema changes are
   > applied as additive, idempotent DDL via the direct connection. See
   > CONTRIBUTING.md → Database changes.

5. **Start the development server**

   ```bash
   pnpm dev
   ```

   Open the URL printed in the terminal.

## Scripts

| Command            | Description                                         |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Start the Vite dev server                           |
| `pnpm build`       | Production build                                    |
| `pnpm start`       | Start production server                             |
| `pnpm test`        | Run tests with Vitest                               |
| `pnpm lint`        | Lint with oxlint + knip                             |
| `pnpm fmt`         | Format with oxfmt                                   |
| `pnpm check`       | Run all checks (oxfmt format check + oxlint + knip) |
| `pnpm fix`         | Auto-fix lint and format issues                     |
| `pnpm db:generate` | Generate Drizzle migrations (⚠️ see warning)        |
| `pnpm db:migrate`  | Run database migrations (⚠️ see warning)            |
| `pnpm db:push`     | Push schema changes directly (⚠️ see warning)       |
| `pnpm db:studio`   | Open Drizzle Studio                                 |

> ⚠️ `db:generate` / `db:migrate` / `db:push` are **not** safe to run blindly —
> migration tracking has drifted and `db:push` will try to DROP existing tables.
> See [CONTRIBUTING.md → Database changes](CONTRIBUTING.md#database-changes).
