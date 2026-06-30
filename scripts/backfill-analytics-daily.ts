// One-time backfill: roll up raw form_visits + form_question_progress into the daily aggregate
// tables (form_analytics_daily / form_dropoff_daily) for every historical date. Reuses the EXACT
// production builders so output matches the nightly cron. Idempotent (delete-then-insert per date).
// Unlike the cron it does NOT prune raw rows.
//
//   pnpm exec tsx scripts/backfill-analytics-daily.ts [startDate] [endDate]   (YYYY-MM-DD, UTC)
//
// Defaults: startDate = earliest raw event, endDate = yesterday (UTC).
import { config } from "dotenv";
import { and, eq, gte, lte, min } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  formAnalyticsDaily,
  formDropoffDaily,
  formQuestionProgress,
  formVisits,
} from "../src/db/schema";
import {
  buildDailyAnalyticsRows,
  buildDailyDropoffRows,
} from "../src/lib/analytics/aggregate-utils";

config({ path: [".env.local", ".env"] });
const DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("Neither DIRECT_URL nor DATABASE_URL is set");

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle({ client });

const MS_PER_DAY = 86_400_000;
const toDateKey = (d: Date): string => d.toISOString().slice(0, 10);

const resolveStart = async (override?: string): Promise<string> => {
  if (override) return override;
  const [{ v }] = await db.select({ v: min(formVisits.visitStartedAt) }).from(formVisits);
  const [{ p }] = await db
    .select({ p: min(formQuestionProgress.viewedAt) })
    .from(formQuestionProgress);
  const earliest = [v, p].filter(Boolean).map((d) => new Date(d as string | Date).getTime());
  return earliest.length > 0 ? toDateKey(new Date(Math.min(...earliest))) : toDateKey(new Date());
};

const main = async (): Promise<void> => {
  const now = new Date();
  const startKey = await resolveStart(process.argv[2]);
  const endKey = process.argv[3] ?? toDateKey(new Date(now.getTime() - MS_PER_DAY)); // yesterday UTC

  let cursor = new Date(`${startKey}T00:00:00.000Z`);
  const end = new Date(`${endKey}T00:00:00.000Z`);
  let analyticsTotal = 0;
  let dropoffTotal = 0;
  let days = 0;

  while (cursor.getTime() <= end.getTime()) {
    const date = toDateKey(cursor);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const visits = await db
      .select()
      .from(formVisits)
      .where(and(gte(formVisits.visitStartedAt, dayStart), lte(formVisits.visitStartedAt, dayEnd)));
    const progress = await db
      .select()
      .from(formQuestionProgress)
      .where(
        and(
          gte(formQuestionProgress.viewedAt, dayStart),
          lte(formQuestionProgress.viewedAt, dayEnd),
        ),
      );

    const analyticsRows = buildDailyAnalyticsRows(visits, date, now);
    const dropoffRows = buildDailyDropoffRows({ rows: progress, visits, dateKey: date, now });

    // Idempotent per-date replace (same as the cron's transaction, minus pruning).
    await db.transaction(async (tx) => {
      await tx.delete(formAnalyticsDaily).where(eqDate(formAnalyticsDaily.date, date));
      if (analyticsRows.length > 0) await tx.insert(formAnalyticsDaily).values(analyticsRows);
      await tx.delete(formDropoffDaily).where(eqDate(formDropoffDaily.date, date));
      if (dropoffRows.length > 0) await tx.insert(formDropoffDaily).values(dropoffRows);
    });

    if (analyticsRows.length || dropoffRows.length) {
      console.log(`${date}: ${analyticsRows.length} analytics, ${dropoffRows.length} dropoff rows`);
    }
    analyticsTotal += analyticsRows.length;
    dropoffTotal += dropoffRows.length;
    days += 1;
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }

  console.log(
    `\nDone. ${days} days [${startKey}..${endKey}] → ${analyticsTotal} analytics, ${dropoffTotal} dropoff rows.`,
  );
  await client.end();
};

// `date` columns are plain text 'YYYY-MM-DD'.
const eqDate = (col: typeof formAnalyticsDaily.date | typeof formDropoffDaily.date, v: string) =>
  eq(col, v);

await main();
