import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

// drizzle-kit (push/pull/introspect) needs a direct, non-transaction-pooled
// Postgres connection — Supabase's transaction pooler on :6543 strips
// prepared statements and recycles connections per-transaction, which makes
// schema introspection hang indefinitely. Prefer DIRECT_URL (port 5432 /
// `db.<ref>.supabase.co`) and fall back to DATABASE_URL only if it isn't set.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  schemaFilter: ["public"], // Only manage public schema, ignore Supabase system schemas
});
