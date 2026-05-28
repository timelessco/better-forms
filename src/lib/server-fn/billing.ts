import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import { db } from "@/db";
import { member } from "@/db/schema";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";

/** Opens Polar's hosted portal for an org-scoped customer. Better Auth's customer.portal() looks
 * up by externalId = user.id, but subs are bought with referenceId: orgId so the Polar customer is
 * keyed by org. Bypass the adapter and create a customer session via the SDK directly. */
export const openOrgBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(v.object({ orgId: v.string() }))
  .handler(async ({ data, context }) => {
    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, context.session.user.id), eq(member.organizationId, data.orgId)),
      );

    if (!membership) {
      throw createError({
        code: "billing/forbidden" satisfies ErrorCode,
        status: 403,
        message: "Not authorized to manage billing for this organization",
        why: "User isn't a member of the requested org",
        fix: "Switch to an org you're a member of",
        internal: { orgId: data.orgId, userId: context.session.user.id },
      });
    }

    const { polarClient } = await import("@/lib/auth/auth");
    const email = context.session.user.email;

    // Customer has no externalId (checkout created it with email only; referenceId lives on the
    // subscription's metadata, not the customer). Look up by email, then mint a session by customerId.
    const list = await polarClient.customers.list({ email, limit: 1 });
    const customer = list.result.items[0];
    if (!customer) {
      throw createError({
        code: "billing/no-customer" satisfies ErrorCode,
        status: 404,
        message: "No Polar customer found for this account",
        why: "Polar customer lookup by email returned no results — no checkout has been completed yet",
        fix: "Subscribe to a paid plan first, then return to the billing portal",
        internal: { orgId: data.orgId, email },
      });
    }

    const session = await polarClient.customerSessions.create({
      customerId: customer.id,
    });

    return { url: session.customerPortalUrl };
  });
