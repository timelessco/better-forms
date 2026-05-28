import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { createError } from "@/lib/errors/create";
import type { RequestLogger } from "evlog";
import { identifyUser } from "evlog/better-auth";
import type { ErrorCode } from "@/lib/errors/codes";
// Aliased: `useRequest` is a Nitro ALS accessor, not a React hook — oxlint
// rules-of-hooks flags it by name.
import { useRequest as getNitroRequest } from "nitro/context";
import { auth } from "@/lib/auth/auth";
import { planUnlocks } from "@/lib/config/plan-gates";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { formSettingsFeatureGates } from "@/lib/server-fn/plan-helpers";
import type { FormProSettingsInput } from "@/lib/server-fn/plan-helpers";
import { getOrgPlan } from "@/lib/server-fn/plan-helpers.server";

// Tag evlog wide event with user/session + org id/role. SYNCHRONOUS by design:
// any `await` loses the tag — TanStack Start streams, evlog emits the wide event
// when the stream opens, later tags are dropped ("log.set() after wide event").
// `plan` not tagged for the same reason (needs async DB read) — slice by
// activeOrganizationId and join the plan column out-of-band. No-op without evlog
// or null session.
const tagLoggerWithSession = (
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

  identifyUser(log, session, {
    // Keep only filtered-on fields (`userId` still emitted top-level). `name`
    // omitted — PII, no observability value.
    fields: ["emailVerified"],
    // Suppress full session; re-add just ip + userAgent via extend.
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
    }),
  });
};

// serverFn/API paths — valid endpoints but not user-navigable. Using one as the
// post-login redirect lands the user on a blank endpoint, so filter them out.
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

  tagLoggerWithSession(session);

  return next({
    context: {
      session,
    },
  });
});

export const formProSettingsMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, data, context }) => {
    // The gated keys (branding, analytics, presentationMode, …) live inside
    // `draftSettings` on createForm/updateForm payloads, so flatten that
    // bag in before running the gate predicate.
    const raw = data as Record<string, unknown> | undefined;
    const draft = (raw?.draftSettings as Record<string, unknown> | undefined) ?? {};
    const input = { ...draft, ...raw } as unknown as FormProSettingsInput;
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

// API variant: JSON 401 not a redirect — consumers want a status, not HTML;
// useObject/fetch can't follow a 302 to HTML and recover.
export const apiAuthMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  tagLoggerWithSession(session);

  return next({ context: { session } });
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  // O(1) cookie check, not a DB round-trip (~1.97s saved). authMiddleware on
  // /dashboard does full session + email validation.
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
