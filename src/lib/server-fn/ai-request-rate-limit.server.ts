import { sql } from "drizzle-orm";
import { aiRequestRateLimits } from "@/db/schema";
import { slidingWindowRateLimit } from "@/lib/server-fn/rate-limit.server";

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
  const count = await slidingWindowRateLimit({
    table: aiRequestRateLimits,
    keyColumn: aiRequestRateLimits.orgId,
    windowStartColumn: aiRequestRateLimits.windowStart,
    countColumn: aiRequestRateLimits.count,
    values: { orgId, count: 1 },
    windowIntervalSql: WINDOW_INTERVAL_SQL,
    cleanupSql: sql`DELETE FROM ai_request_rate_limits WHERE window_start < now() - interval '1 hour'`,
    cleanupProbability: CLEANUP_PROBABILITY,
  });
  return {
    allowed: count <= MAX_PER_WINDOW,
    count,
    limit: MAX_PER_WINDOW,
    windowMinutes: WINDOW_MINUTES,
  };
};
