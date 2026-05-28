import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiChatPreviewCounts, aiChatSessions } from "@/db/schema";
import { aiQuotaForPlan } from "@/lib/config/plan-gates";
import { monthKey } from "@/lib/ai/chat-form-helpers";
import { utcDayKey } from "@/lib/server-fn/ai-quota.server";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";

export const AI_CHAT_CAP_ERROR = "ai_chat_session_cap_exceeded";
export const AI_CHAT_PREVIEW_CAP_ERROR = "ai_chat_preview_cap_exceeded";

export type AiChatSessionCheck =
  | { allowed: true; plan: ServerPlan; used: number; limit: number | null }
  | { allowed: false; plan: ServerPlan; used: number; limit: number; reason: "cap_exceeded" };

/**
 * Checks whether the Org may start a new Chat Session this month. Free Plan
 * always returns blocked (limit=null acts as 0 here because AI Chat is
 * Pro-only — the gate runs upstream). For Pro/Business, checks count against
 * the per-Org-Month cap.
 */
export const checkChatSessionCap = async (
  orgId: string,
  plan: ServerPlan,
  month: string = monthKey(),
): Promise<AiChatSessionCheck> => {
  const { aiChatSessionsPerMonth: limit } = aiQuotaForPlan(plan);
  if (limit === null) {
    // Free Plan path — but the upstream Plan gate should have rejected long
    // before we get here. Treat as blocked defensively.
    return { allowed: false, plan, used: 0, limit: 0, reason: "cap_exceeded" };
  }
  const [row] = await db
    .select({ used: count(aiChatSessions.submissionId) })
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.organizationId, orgId), eq(aiChatSessions.periodMonth, month)));
  const used = row?.used ?? 0;
  if (used >= limit) return { allowed: false, plan, used, limit, reason: "cap_exceeded" };
  return { allowed: true, plan, used, limit };
};

/**
 * Returns `true` when an `ai_chat_sessions` row already exists for this
 * submissionId — i.e. the request is a resume of an existing Chat Session
 * and must not re-consume a quota slot.
 */
export const isExistingChatSession = async (submissionId: string): Promise<boolean> => {
  const [row] = await db
    .select({ submissionId: aiChatSessions.submissionId })
    .from(aiChatSessions)
    .where(eq(aiChatSessions.submissionId, submissionId));
  return Boolean(row);
};

/**
 * Atomically mark a Chat Session as started. Returns `true` when this is the
 * first call for the given submissionId (the row was inserted), `false` when
 * the row already existed (resume — does not re-count). The cap check should
 * be run before this when `firstCall === true`.
 */
export const markChatSessionStarted = async (
  submissionId: string,
  orgId: string,
  month: string = monthKey(),
): Promise<{ firstCall: boolean }> => {
  const inserted = await db
    .insert(aiChatSessions)
    .values({ submissionId, organizationId: orgId, periodMonth: month })
    .onConflictDoNothing({ target: aiChatSessions.submissionId })
    .returning({ submissionId: aiChatSessions.submissionId });
  return { firstCall: inserted.length > 0 };
};

export type AiChatPreviewCheck =
  | { allowed: true; plan: ServerPlan; used: number; limit: number | null }
  | {
      allowed: false;
      plan: ServerPlan;
      used: number;
      limit: number;
      reason: "preview_cap_exceeded";
    };

const previewRowKey = (orgId: string, day: string) => `${orgId}:${day}`;

export const checkPreviewQuota = async (
  orgId: string,
  plan: ServerPlan,
  day: string = utcDayKey(),
): Promise<AiChatPreviewCheck> => {
  const { aiChatPreviewPerDay: limit } = aiQuotaForPlan(plan);
  if (limit === null) {
    return {
      allowed: false,
      plan,
      used: 0,
      limit: 0,
      reason: "preview_cap_exceeded",
    };
  }
  const [row] = await db
    .select({ count: aiChatPreviewCounts.count })
    .from(aiChatPreviewCounts)
    .where(eq(aiChatPreviewCounts.id, previewRowKey(orgId, day)));
  const used = row?.count ?? 0;
  if (used >= limit) {
    return { allowed: false, plan, used, limit, reason: "preview_cap_exceeded" };
  }
  return { allowed: true, plan, used, limit };
};

export const incrementPreviewCount = async (
  orgId: string,
  day: string = utcDayKey(),
): Promise<void> => {
  await db
    .insert(aiChatPreviewCounts)
    .values({ id: previewRowKey(orgId, day), organizationId: orgId, periodDay: day, count: 1 })
    .onConflictDoUpdate({
      target: aiChatPreviewCounts.id,
      set: {
        count: sql`${aiChatPreviewCounts.count} + 1`,
        updatedAt: sql`now()`,
      },
    });
};
