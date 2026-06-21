// One-off idempotent scrub: removes stale customization keys from stored JSONB.
// Stale keys (e.g. coverFit) are already inert at runtime via migrateCustomization;
// this aligns stored data with runtime behavior. Safe to run repeatedly — the
// `WHERE customization ? '<key>'` guard makes it a no-op once clean.
//
// Run via: pnpm exec tsx scripts/scrub-stale-customization.ts
// Connects through DIRECT_URL (do NOT use db:migrate/db:push for this).
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { STALE_CUSTOMIZATION_KEYS } from "@/lib/theme/customization-migrate";

config({ path: [".env.local", ".env"] });

const DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Neither DIRECT_URL nor DATABASE_URL is set");
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle({ client });

// Tables carrying a customization JSONB column.
const TABLES = ["forms", "form_versions"] as const;

for (const table of TABLES) {
  for (const key of STALE_CUSTOMIZATION_KEYS) {
    const result = await db.execute(sql`
      UPDATE ${sql.identifier(table)}
      SET customization = customization - ${key}
      WHERE customization ? ${key}
    `);
    console.log(`${table}: stripped "${key}" from ${result.count} row(s).`);
  }
}

await client.end();
process.exit(0);
