import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiGenerationCounts } from "@/db/schema";
import { aiQuotaForPlan } from "@/lib/config/plan-gates";
import { AI_DAILY_LIMIT_ERROR } from "@/lib/server-fn/ai-quota-constants";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";

export { AI_DAILY_LIMIT_ERROR };

/** Stable UTC YYYY-MM-DD bucket so the limit resets at 00:00 UTC. */
export const utcDayKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

const rowKey = (orgId: string, day: string) => `${orgId}:${day}`;

/** AI-generation count for orgId on the UTC day; 0 if no row. Pure read, no increment. */
export const getAiCount = async (orgId: string, day: string = utcDayKey()): Promise<number> => {
  const [row] = await db
    .select({ count: aiGenerationCounts.count })
    .from(aiGenerationCounts)
    .where(eq(aiGenerationCounts.id, rowKey(orgId, day)));
  return row?.count ?? 0;
};

/** Atomically increment-or-insert the per-day counter. Called after a successful call so failures don't burn quota. */
export const incrementAiCount = async (orgId: string, day: string = utcDayKey()): Promise<void> => {
  await db
    .insert(aiGenerationCounts)
    .values({
      id: rowKey(orgId, day),
      organizationId: orgId,
      periodDay: day,
      count: 1,
    })
    .onConflictDoUpdate({
      target: aiGenerationCounts.id,
      set: {
        count: sql`${aiGenerationCounts.count} + 1`,
        updatedAt: sql`now()`,
      },
    });
};

export type AiQuotaCheck =
  | { allowed: true; plan: ServerPlan; used: number; limit: number | null }
  | {
      allowed: false;
      plan: ServerPlan;
      used: number;
      limit: number;
      reason: "daily_limit_exceeded";
    };

/** May orgId make another AI call now? Pro/business (limit=null) always allowed; free capped per PLAN_QUOTAS. */
export const checkAiQuota = async (
  orgId: string,
  plan: ServerPlan,
  day: string = utcDayKey(),
): Promise<AiQuotaCheck> => {
  const { aiGenerationsPerDay: limit } = aiQuotaForPlan(plan);
  const used = await getAiCount(orgId, day);
  if (limit === null) return { allowed: true, plan, used, limit: null };
  if (used >= limit) {
    return { allowed: false, plan, used, limit, reason: "daily_limit_exceeded" };
  }
  return { allowed: true, plan, used, limit };
};
