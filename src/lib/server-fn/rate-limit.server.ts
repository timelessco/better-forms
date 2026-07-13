import { getRequestIP } from "@tanstack/react-start/server";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";

// null when there's no client IP — callers skip the rate limit then. getRequestIP throws off the
// server runtime ("No StartEvent in AsyncLocalStorage", e.g. unit tests), so guard it. Production
// traffic always carries x-forwarded-for (set by Vercel); this only fails open off-platform, where
// flooding isn't the concern (the published-form / auth gates still apply).
export const getClientIp = (): string | null => {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? null;
  } catch {
    return null;
  }
};

interface SlidingWindowRateLimitArgs {
  table: PgTable;
  /** onConflict target — the primary key (ip / orgId). */
  keyColumn: AnyPgColumn;
  windowStartColumn: AnyPgColumn;
  countColumn: AnyPgColumn;
  /** Row to insert on first hit, e.g. `{ ip, count: 1 }` or `{ orgId, count: 1 }`. */
  values: Record<string, unknown>;
  /** Build-time `interval '<n> minutes'` literal (Postgres can't cast a parameterized int → interval). */
  windowIntervalSql: SQL;
  /** DELETE stale rows; run with `cleanupProbability` to keep the table small without a cron. */
  cleanupSql: SQL;
  cleanupProbability: number;
}

/** Atomic per-key sliding-window upsert shared by the analytics / upload / AI limiters. Insert
 * count=1, or on conflict reset (window expired) or increment; returns the post-increment count.
 * Callers keep their own outward contract (boolean / throw / struct) on top of it. */
export const slidingWindowRateLimit = async ({
  table,
  keyColumn,
  windowStartColumn,
  countColumn,
  values,
  windowIntervalSql,
  cleanupSql,
  cleanupProbability,
}: SlidingWindowRateLimitArgs): Promise<number> => {
  if (Math.random() < cleanupProbability) {
    await db.execute(cleanupSql);
  }

  const result = await db
    .insert(table)
    .values(values)
    .onConflictDoUpdate({
      target: keyColumn,
      set: {
        count: sql`CASE
          WHEN ${windowStartColumn} < now() - ${windowIntervalSql}
            THEN 1
          ELSE ${countColumn} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${windowStartColumn} < now() - ${windowIntervalSql}
            THEN now()
          ELSE ${windowStartColumn}
        END`,
      },
    })
    .returning({ count: countColumn });

  return (result[0]?.count as number | undefined) ?? 0;
};
