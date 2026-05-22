import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { createError } from "evlog";
import type { RequestLogger } from "evlog";
import { identifyUser } from "evlog/better-auth";
import type { ErrorCode } from "@/lib/errors/codes";
// Aliased — `useRequest` is a Nitro AsyncLocalStorage accessor, not a React hook,
// but oxlint's react-hooks/rules-of-hooks flags it by name.
import { useRequest as getNitroRequest } from "nitro/context";
import { auth } from "@/lib/auth/auth";
import { planUnlocks } from "@/lib/config/plan-gates";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { formSettingsFeatureGates } from "@/lib/server-fn/plan-helpers";
import type { FormProSettingsInput } from "@/lib/server-fn/plan-helpers";
import { getOrgPlan } from "@/lib/server-fn/plan-helpers.server";

// Tag the active request's evlog wide event with the resolved Better Auth
// user/session, plus the active org's id/role and the org's plan. Plan is
// resolved via one cached-column read (`organization.plan` — synced by Polar
// webhooks), kept best-effort: on any failure we still emit user fields.
// No-op when evlog isn't installed for the request or session is null.
const tagLoggerWithSession = async (
  session: { user: Record<string, unknown>; session: Record<string, unknown> } | null,
) => {
  if (!session) return;
  const log = getNitroRequest().context?.log as RequestLogger | undefined;
  if (!log) return;

  const sessionData = session.session;
  const activeOrgIdRaw = sessionData.activeOrganizationId;
  const activeOrgId = typeof activeOrgIdRaw === "string" ? activeOrgIdRaw : null;
  const roleRaw = sessionData.activeOrganizationRole;
  const role = typeof roleRaw === "string" ? roleRaw : null;
  const ipAddress = typeof sessionData.ipAddress === "string" ? sessionData.ipAddress : null;
  const userAgent = typeof sessionData.userAgent === "string" ? sessionData.userAgent : null;

  const plan = activeOrgId ? await getOrgPlan(activeOrgId).catch(() => null) : null;

  identifyUser(log, session, {
    // Trim the wide event: only keep the user fields we actually filter logs
    // by. `userId` is still emitted as a top-level field by identifyUser.
    // `name` deliberately omitted — PII without observability value.
    fields: ["emailVerified"],
    // Suppress the full session block; we re-add just ip + userAgent via extend.
    session: false,
    extend: () => ({
      ...((ipAddress || userAgent) && {
        session: {
          ...(ipAddress && { ipAddress }),
          ...(userAgent && { userAgent }),
        },
      }),
      ...(activeOrgId && { activeOrganizationId: activeOrgId }),
      ...(role && { role }),
      ...(plan && { plan }),
    }),
  });
};

// Paths that are valid serverFn / API endpoints but not user-navigable. If the
// auth middleware fires for a request to one of these (e.g. a serverFn invoked
// from a route loader during SSR), sending it back as the post-login redirect
// target lands the user on a blank serverFn endpoint after login. Filter them
// out so we only ever round-trip the user through a real page route.
const INTERNAL_PATH_PREFIX = /^\/(?:_|api\/)/;

export const pickPostLoginRedirect = (pathname: string, headers: Headers): string => {
  if (!INTERNAL_PATH_PREFIX.test(pathname)) return pathname;
  const referer = headers.get("referer");
  if (referer) {
    try {
      const refPath = new URL(referer).pathname;
      if (!INTERNAL_PATH_PREFIX.test(refPath)) return refPath;
    } catch {
      // malformed referer — fall through to default
    }
  }
  return "/dashboard";
};

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    const url = getRequestUrl();
    const pathname = new URL(url).pathname;
    throw redirect({
      to: "/login",
      search: { redirect: pickPostLoginRedirect(pathname, headers) },
    });
  }

  await tagLoggerWithSession(session);

  return next({
    context: {
      session,
    },
  });
});

export const formProSettingsMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, data, context }) => {
    const input = data as unknown as FormProSettingsInput;
    const gates = formSettingsFeatureGates(input);
    if (gates.length === 0) return next();

    const plan = await getOrgPlan(getActiveOrgId(context.session));
    const blocked = gates.find((gate) => !planUnlocks(plan, gate));
    if (blocked) {
      throw createError({
        code: "plan/pro-required" satisfies ErrorCode,
        status: 402,
        message: "This feature requires a Pro subscription. Please upgrade to continue.",
        why: `Org plan doesn't unlock the ${blocked} feature gate`,
        fix: "Upgrade to Pro from the billing settings",
        internal: { feature: blocked, plan, gates },
      });
    }
    return next();
  });

// API-route variant of authMiddleware: returns JSON 401 instead of throwing a
// redirect — API consumers expect a status code, not an HTML login page (and
// `useObject`/fetch can't follow a 302 to HTML and recover).
export const apiAuthMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await tagLoggerWithSession(session);

  return next({ context: { session } });
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  // O(1) cookie check instead of DB round-trip (~1.97s saving)
  // authMiddleware on /dashboard will do full session validation + email verification
  const hasSession =
    getCookie("better-auth.session_token") || getCookie("__Secure-better-auth.session_token");

  if (hasSession) {
    throw redirect({ to: "/dashboard" });
  }

  return next({
    context: {
      session: null,
    },
  });
});
