import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { planUnlocks } from "@/lib/config/plan-gates";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { formSettingsFeatureGates } from "@/lib/server-fn/plan-helpers";
import type { FormProSettingsInput } from "@/lib/server-fn/plan-helpers";

// `auth` is lazy-imported inside the server body. A static import here would
// drag the entire `@polar-sh/sdk` + `@/db` + `pg` graph into the client
// bundle — this file is statically imported by every server-fn module
// (`forms.ts`, `workspaces.ts`, …) which are in turn imported by route
// components, putting middleware.ts squarely in the client graph.
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const { auth } = await import("@/lib/auth/auth");
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

  return await next({
    context: {
      session,
    },
  });
});

// Gates Pro-only fields on createForm / updateForm. `getOrgPlan` is dynamically
// imported so the `@/db` graph never lands in client bundles that pick up this
// file via `forms.ts` → route components.
export const formProSettingsMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, data, context }) => {
    const input = data as unknown as FormProSettingsInput;
    const gates = formSettingsFeatureGates(input);
    if (gates.length === 0) return next();

    const { getOrgPlan } = await import("@/lib/server-fn/plan-helpers.server");
    const plan = await getOrgPlan(getActiveOrgId(context.session));
    const blocked = gates.find((gate) => !planUnlocks(plan, gate));
    if (blocked) {
      throw new Error("This feature requires a Pro subscription. Please upgrade to continue.");
    }
    return next();
  });

// API-route variant of authMiddleware. Same lazy `auth` import, but returns a
// JSON 401 instead of throwing a redirect — API consumers expect a status
// code, not an HTML login page (and `useObject`/fetch can't follow a 302 to
// HTML and recover).
export const apiAuthMiddleware = createMiddleware().server(async ({ next }) => {
  const { auth } = await import("@/lib/auth/auth");
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return await next({ context: { session } });
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  // O(1) cookie check instead of DB round-trip (~1.97s saving)
  // authMiddleware on /dashboard will do full session validation + email verification
  const hasSession =
    getCookie("better-auth.session_token") || getCookie("__Secure-better-auth.session_token");

  if (hasSession) {
    throw redirect({ to: "/dashboard" });
  }

  return await next({
    context: {
      session: null,
    },
  });
});
