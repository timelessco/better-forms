// One-off: add forms.previewImageUrl (generated content thumbnail / OG image). Additive, idempotent
// DDL applied through DIRECT_URL — NOT db:migrate/db:push (migration tracking is drifted; db:push
// would DROP non-empty tables). Safe to re-run. camelCase column name (no drizzle casing config).
//   pnpm exec tsx scripts/apply-preview-image-ddl.ts
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
  await db.execute(sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS "previewImageUrl" text`);
  console.log("✓ forms.previewImageUrl ready");
  await client.end();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
