import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiChatRateLimits } from "@/db/schema";

export const AI_CHAT_RATE_LIMIT_ERROR = "ai_chat_rate_limited";

const WINDOW_MINUTES = 5;
const MAX_PER_WINDOW = 30;
const CLEANUP_PROBABILITY = 0.01;

const WINDOW_INTERVAL_SQL = sql.raw(`interval '${WINDOW_MINUTES} minutes'`);

/**
 * Atomic per-IP token bucket for /api/ai/chat-form. 30 calls / 5 minutes.
 * Returns `{ allowed: false }` once the IP is over budget; otherwise the
 * row is inserted/incremented and the call proceeds.
 */
export const checkChatRateLimit = async (
  ip: string,
): Promise<{ allowed: boolean; count: number }> => {
  if (Math.random() < CLEANUP_PROBABILITY) {
    await db.execute(
      sql`DELETE FROM ai_chat_rate_limits WHERE window_start < now() - interval '1 hour'`,
    );
  }

  const result = await db
    .insert(aiChatRateLimits)
    .values({ ip, count: 1 })
    .onConflictDoUpdate({
      target: aiChatRateLimits.ip,
      set: {
        count: sql`CASE
          WHEN ${aiChatRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN 1
          ELSE ${aiChatRateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${aiChatRateLimits.windowStart} < now() - ${WINDOW_INTERVAL_SQL}
            THEN now()
          ELSE ${aiChatRateLimits.windowStart}
        END`,
      },
    })
    .returning({ count: aiChatRateLimits.count });

  const newCount = result[0]?.count ?? 0;
  return { allowed: newCount <= MAX_PER_WINDOW, count: newCount };
};
