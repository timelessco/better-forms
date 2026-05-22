import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { createError } from "evlog";
import { z } from "zod";
import { db } from "@/db";
import { member } from "@/db/schema";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Opens Polar's hosted customer portal for an organization-scoped customer.
 *
 * The Better Auth `authClient.customer.portal()` looks up the Polar customer
 * by `externalId = user.id`, but our subscriptions are purchased with
 * `referenceId: orgId` so the customer in Polar is keyed by **org** id.
 * We bypass the adapter and create a customer session directly via the SDK.
 */
export const openOrgBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
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

    // The Polar customer for this org's subscription has no `externalId` set
    // (the @polar-sh/better-auth checkout flow created it with email only,
    // and `referenceId` lives on the subscription's metadata, not the customer).
    // Look up the customer by email, then mint a session with `customerId`.
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
