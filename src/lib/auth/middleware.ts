import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/auth";
import { planUnlocks } from "@/lib/config/plan-gates";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { formSettingsFeatureGates } from "@/lib/server-fn/plan-helpers";
import type { FormProSettingsInput } from "@/lib/server-fn/plan-helpers";
import { getOrgPlan } from "@/lib/server-fn/plan-helpers.server";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    const url = getRequestUrl();
    const pathname = new URL(url).pathname;
    throw redirect({
      to: "/login",
      search: { redirect: pathname },
    });
  }

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
      throw new Error("This feature requires a Pro subscription. Please upgrade to continue.");
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
