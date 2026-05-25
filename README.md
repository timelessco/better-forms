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
- **Real-time Sync** — Local-first data layer with ElectricSQL for instant UI updates

## Tech Stack

| Layer        | Technology                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Framework    | [TanStack Start](https://tanstack.com/start) (Vite + React 19)                                                     |
| Routing      | [TanStack Router](https://tanstack.com/router) (file-based, type-safe)                                             |
| Data         | [TanStack DB](https://tanstack.com/db) + [ElectricSQL](https://electric-sql.com) (local-first sync)                |
| Database     | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)                                                               |
| Auth         | [Better Auth](https://www.better-auth.com) (email/password, OTP, 2FA, organizations)                               |
| Editor       | [Plate.js](https://platejs.org) (rich text, block-based)                                                           |
| UI           | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://radix-ui.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| AI           | [Vercel AI SDK](https://sdk.vercel.ai)                                                                             |
| Payments     | [Polar](https://polar.sh)                                                                                          |
| File Uploads | [UploadThing](https://uploadthing.com)                                                                             |
| Monitoring   | [Sentry](https://sentry.io)                                                                                        |
| Server       | [Nitro](https://nitro.unjs.io)                                                                                     |

## Prerequisites

- [Bun](https://bun.sh) (runtime and package manager)
- [PostgreSQL](https://www.postgresql.org) database

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd better-form
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the required values in `.env` (database URL, auth secrets, API keys, etc.).

4. **Set up the database**

   ```bash
   bun db:generate
   bun db:migrate
   ```

5. **Start the development server**

   ```bash
   bun dev
   ```

   Open the URL printed in the terminal.

## Scripts

| Command           | Description                     |
| ----------------- | ------------------------------- |
| `bun dev`         | Start the Vite dev server       |
| `bun build`       | Production build                |
| `bun start`       | Start production server         |
| `bun test`        | Run tests with Vitest           |
| `bun lint`        | Lint with oxlint + knip         |
| `bun fmt`         | Format with oxfmt               |
| `bun check`       | Run all checks (Ultracite)      |
| `bun fix`         | Auto-fix lint and format issues |
| `bun db:generate` | Generate Drizzle migrations     |
| `bun db:migrate`  | Run database migrations         |
| `bun db:push`     | Push schema changes directly    |
| `bun db:studio`   | Open Drizzle Studio             |
