import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRequestRateLimits } from "@/db/schema";

/** Per-org short-window burst limit for AI form-generate. Separate from the per-day quota
 * (ai-quota.server) — this caps a runaway client loop / leaked session regardless of plan. */

export const WINDOW_MINUTES = 10;
export const MAX_PER_WINDOW = 100;
const CLEANUP_PROBABILITY = 0.01;

// SQL literal: Postgres can't concat a parameterized int with text in an interval cast. Build-time constant, safe.
const WINDOW_INTERVAL_SQL = sql.raw(`interval '${WINDOW_MINUTES} minutes'`);

export interface AiRateLimitCheck {
  allowed: boolean;
  count: number;
  limit: number;
  windowMinutes: number;
}

/** Atomic upsert: insert count=1, or on conflict reset (window expired) or increment. Returns the
 * post-increment count and whether it's within the window limit. */
export const checkAiRequestRateLimit = async (orgId: string): Promise<AiRateLimitCheck> => {
  if (Math.random() < CLEANUP_PROBABILITY) {
    await db.execute(
      sql`DELETE FROM ai_request_rate_limits WHERE window_start < now() - interval '1 hour'`,
    );
  }

  const result = await db
    .insert(aiRequestRateLimits)
    .values({ orgId, count: 1 })
    .onConflictDoUpdate({
      target: aiRequestRateLimits.orgId,
      set: {
        count: sql`CASE
          WHEN ${aiRequestRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN 1
          ELSE ${aiRequestRateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${aiRequestRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN now()
          ELSE ${aiRequestRateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: aiRequestRateLimits.count });

  const count = result[0]?.count ?? 0;
  return {
    allowed: count <= MAX_PER_WINDOW,
    count,
    limit: MAX_PER_WINDOW,
    windowMinutes: WINDOW_MINUTES,
  };
};
