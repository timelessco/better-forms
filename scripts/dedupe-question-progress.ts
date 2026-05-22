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

const [{ dupes }] = await db.execute<{ dupes: number }>(sql`
  SELECT COALESCE(SUM(c - 1), 0)::int AS dupes
  FROM (
    SELECT count(*) AS c
    FROM form_question_progress
    GROUP BY "visitId", "questionId"
    HAVING count(*) > 1
  ) AS dup_keys
`);

console.log(`Found ${dupes} duplicate row(s) to delete.`);

if (dupes === 0) {
  console.log("Nothing to delete; the unique index can be created safely.");
  await client.end();
  process.exit(0);
}

const result = await db.execute(sql`
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY "visitId", "questionId"
             ORDER BY "completedAt" DESC NULLS LAST,
                      "startedAt"  DESC NULLS LAST,
                      "viewedAt"   DESC,
                      id
           ) AS rn
    FROM form_question_progress
  )
  DELETE FROM form_question_progress
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
`);

console.log(`Deleted ${result.count} duplicate row(s).`);
await client.end();
process.exit(0);
