import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log("Connecting to database...");
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle({ client });

console.log("Dropping public + drizzle schemas (wipes tables and migration ledger)...");
await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);
await db.execute(sql`GRANT ALL ON SCHEMA public TO postgres`);
await db.execute(sql`GRANT ALL ON SCHEMA public TO public`);

console.log("Done.");
await client.end();
process.exit(0);
