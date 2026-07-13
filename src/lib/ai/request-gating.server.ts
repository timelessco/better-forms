import { getRequestHeaders } from "@tanstack/react-start/server";
import type { RequestLogger } from "evlog";
import { identifyUser } from "evlog/better-auth";
import type { Session } from "@/lib/auth/auth";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";
import { AI_DAILY_LIMIT_ERROR, checkAiQuota } from "@/lib/server-fn/ai-quota.server";
import { checkAiRequestRateLimit } from "@/lib/server-fn/ai-request-rate-limit.server";
import { logger } from "@/lib/utils";

// activeOrganizationId/Role + ip/userAgent live on the session row (written by the
// session.create databaseHook in auth.ts) but aren't in Better Auth's inferred Session
// type — spell them out here so callers read typed fields instead of casting the session.
type SessionWithOrgMeta = Session & {
  session: {
    activeOrganizationId?: string | null;
    activeOrganizationRole?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
};

type PlanResolution = {
  resolvedPlan: ServerPlan;
  resolvedOrgId: string | null;
};

/** Resolve plan + org from the session, self-healing a stale plan column via Polar, and
 * identify the user on the wide event. Never throws — a lookup failure falls back to
 * free/null orgId (gates as free, skips quota tracking). */
export const resolvePlanAndSession = async (
  log: RequestLogger | undefined,
  mode: string,
): Promise<PlanResolution> => {
  let resolvedPlan: ServerPlan = "free";
  let resolvedOrgId: string | null = null;
  try {
    const { auth } = await import("@/lib/auth/auth");
    const session = (await auth.api.getSession({
      headers: getRequestHeaders(),
    })) as SessionWithOrgMeta | null;
    logger("[ai-plan] session present?", Boolean(session), {
      userId: session?.user?.id ?? null,
      activeOrganizationId: session?.session?.activeOrganizationId ?? null,
    });
    if (session) {
      resolvedOrgId = getActiveOrgId(session);
      const userEmail = session.user?.email ?? null;
      // Self-heal stale plan column (missed webhook): consult Polar by email, rewrite column on drift. Fast path (already paid) skips Polar.
      resolvedPlan = await getOrgPlanWithPolarSync(resolvedOrgId, userEmail);
      if (log) {
        const roleRaw = session.session.activeOrganizationRole;
        const role = typeof roleRaw === "string" ? roleRaw : null;
        const ipAddress =
          typeof session.session.ipAddress === "string" ? session.session.ipAddress : null;
        const userAgent =
          typeof session.session.userAgent === "string" ? session.session.userAgent : null;
        identifyUser(log, session, {
          fields: ["emailVerified"],
          session: false,
          extend: () => ({
            ...((ipAddress || userAgent) && {
              session: {
                ...(ipAddress && { ipAddress }),
                ...(userAgent && { userAgent }),
              },
            }),
            activeOrganizationId: resolvedOrgId,
            plan: resolvedPlan,
            ...(role && { role }),
          }),
        });
      }
      logger("[ai-plan] resolved", {
        mode,
        orgId: resolvedOrgId,
        plan: resolvedPlan,
        note: "plan is read from organization.plan DB column (Polar webhook syncs it; route falls back to Polar API on cached='free')",
      });
    } else {
      logger("[ai-plan] no session — defaulting to free, orgId=null");
    }
  } catch (e) {
    const planLookupError = e instanceof Error ? e.message : String(e);
    logger("[ai-plan] lookup threw — falling back to free", planLookupError);
    // Fall through free/null orgId — skips quota tracking, still gates as free.
  }
  return { resolvedPlan, resolvedOrgId };
};

/** Pre-LLM gating for an org: short-window burst limit (all plans) then per-day quota
 * (pro/business unlimited). Returns a 429 Response to short-circuit the handler, or null
 * to proceed. */
export const checkAiGating = async (orgId: string, plan: ServerPlan): Promise<Response | null> => {
  // Short-window burst limit (all plans, incl. Pro/Business): caps a runaway loop / leaked session before the LLM call, independent of the per-day quota below.
  const burst = await checkAiRequestRateLimit(orgId);
  logger("[ai-rate-limit] check", {
    orgId,
    allowed: burst.allowed,
    count: burst.count,
    limit: burst.limit,
    windowMinutes: burst.windowMinutes,
  });
  if (!burst.allowed) {
    // Distinct `code` so the client shows "slow down" vs. the daily "limit reached". Wire-compatible with client parseError(err).code.
    return new Response(
      JSON.stringify({
        code: "quota/ai-rate-limited",
        error: "ai_rate_limited",
        count: burst.count,
        limit: burst.limit,
        windowMinutes: burst.windowMinutes,
        message: `Too many AI requests. Please wait a moment before generating again.`,
        fix: "Slow down — try again in a few minutes",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  // Rate-limit check. Pro/business get null limit → always allowed.
  const quota = await checkAiQuota(orgId, plan);
  logger("[ai-quota] check", {
    orgId,
    plan,
    allowed: quota.allowed,
    used: quota.used,
    limit: quota.limit,
  });
  if (!quota.allowed) {
    // Wire-compatible with client parseError(err).code. useObject bypasses ofetch — body lands in Error.message string. `code` lets client JSON.parse + branch on stable id vs substring-matching AI_DAILY_LIMIT_ERROR (kept for back-compat).
    return new Response(
      JSON.stringify({
        code: "quota/ai-daily-limit",
        error: AI_DAILY_LIMIT_ERROR,
        used: quota.used,
        limit: quota.limit,
        plan: quota.plan,
        message: `Daily AI limit reached (${quota.used}/${quota.limit}). Upgrade to Pro for unlimited generations.`,
        fix: "Upgrade to Pro for unlimited generations",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  return null;
};
