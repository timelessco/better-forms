// One-off: create the analytics_rate_limits table (plan 005). Additive, idempotent DDL applied
// through DIRECT_URL — NOT db:migrate/db:push (migration tracking is drifted; db:push would DROP
// non-empty tables). Safe to re-run. Mirrors the upload_rate_limits / ai_request_rate_limits tables.
//   pnpm exec tsx scripts/apply-analytics-rate-limit-ddl.ts
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

config({ path: [".env.local", ".env"] });

const DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Neither DIRECT_URL nor DATABASE_URL is set");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle({ client });

const main = async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS analytics_rate_limits (
      ip text PRIMARY KEY,
      window_start timestamptz NOT NULL DEFAULT now(),
      count integer NOT NULL DEFAULT 0
    )
  `);
  console.log("✓ analytics_rate_limits ready");
  await client.end();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
