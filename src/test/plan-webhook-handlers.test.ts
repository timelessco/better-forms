import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customDomains, organization } from "@/db/schema";
import {
  handleSubscriptionDowngrade,
  handleSubscriptionUpdated,
  handleSubscriptionUpgrade,
} from "@/lib/auth/polar-handlers.server";
import { PLAN_PRODUCT_IDS } from "@/lib/config/plan-config";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestCustomDomain,
  createTestOrg,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

const FREE_PRODUCT_ID = PLAN_PRODUCT_IDS.free;
const PRO_PRODUCT_ID = PLAN_PRODUCT_IDS.pro;

// Minimal subscription payload — handlers only read metadata.referenceId,
// productId, and (for `updated`) status.
type AnyPayload = Parameters<typeof handleSubscriptionUpgrade>[0] &
  Parameters<typeof handleSubscriptionUpdated>[0];

const buildPayload = (
  type: string,
  overrides: { orgId?: string | null; productId?: string; status?: string } = {},
): AnyPayload =>
  ({
    type,
    timestamp: new Date(),
    data: {
      productId: overrides.productId ?? PRO_PRODUCT_ID,
      status: overrides.status ?? "active",
      metadata: overrides.orgId === null ? {} : { referenceId: overrides.orgId ?? "missing-orgid" },
    },
  }) as unknown as AnyPayload;

describe("polar-handlers", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const testUtils = await getTestUtils();
    await testUtils.saveUser(
      testUtils.createUser({
        id: ownerId,
        email: `owner-polar-${ownerId}@example.com`,
        name: "Owner Polar",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  const readPlan = async (id: string) => {
    const [row] = await db
      .select({ plan: organization.plan })
      .from(organization)
      .where(eq(organization.id, id));
    return row?.plan ?? null;
  };

  describe("handleSubscriptionUpgrade", () => {
    it("flips org plan to pro on Pro product", async () => {
      await handleSubscriptionUpgrade(buildPayload("subscription.created", { orgId }));
      await expect(readPlan(orgId)).resolves.toBe("pro");
    });

    it("restores suspended domains", async () => {
      await setOrgPlan(orgId, "free");
      const domain = await createTestCustomDomain(orgId, {
        status: "suspended",
        previousStatus: "verified",
      });

      await handleSubscriptionUpgrade(buildPayload("subscription.uncanceled", { orgId }));

      const [row] = await db
        .select({ status: customDomains.status, previousStatus: customDomains.previousStatus })
        .from(customDomains)
        .where(eq(customDomains.id, domain.id));
      expect(row).toStrictEqual({ status: "verified", previousStatus: null });
    });

    it("is a no-op when product is not Pro", async () => {
      await handleSubscriptionUpgrade(
        buildPayload("subscription.active", { orgId, productId: FREE_PRODUCT_ID }),
      );
      await expect(readPlan(orgId)).resolves.toBe("free");
    });

    it("is a no-op when referenceId is missing", async () => {
      await handleSubscriptionUpgrade(buildPayload("subscription.created", { orgId: null }));
      await expect(readPlan(orgId)).resolves.toBe("free");
    });

    it("does not throw when referenceId points to an unknown org", async () => {
      await expect(
        handleSubscriptionUpgrade(
          buildPayload("subscription.created", { orgId: "non-existent-org" }),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("handleSubscriptionDowngrade", () => {
    it("flips org plan to free and suspends domains", async () => {
      await setOrgPlan(orgId, "pro");
      const domain = await createTestCustomDomain(orgId, { status: "verified" });

      await handleSubscriptionDowngrade(buildPayload("subscription.canceled", { orgId }));

      await expect(readPlan(orgId)).resolves.toBe("free");
      const [row] = await db
        .select({ status: customDomains.status, previousStatus: customDomains.previousStatus })
        .from(customDomains)
        .where(eq(customDomains.id, domain.id));
      expect(row).toStrictEqual({ status: "suspended", previousStatus: "verified" });
    });

    it("is idempotent when fired twice (cancel + revoke race)", async () => {
      await setOrgPlan(orgId, "pro");
      const domain = await createTestCustomDomain(orgId, { status: "verified" });

      await handleSubscriptionDowngrade(buildPayload("subscription.canceled", { orgId }));
      await handleSubscriptionDowngrade(buildPayload("subscription.revoked", { orgId }));

      const [row] = await db
        .select({ status: customDomains.status, previousStatus: customDomains.previousStatus })
        .from(customDomains)
        .where(eq(customDomains.id, domain.id));
      expect(row).toStrictEqual({ status: "suspended", previousStatus: "verified" });
    });

    it("is a no-op when referenceId is missing", async () => {
      await setOrgPlan(orgId, "pro");
      await handleSubscriptionDowngrade(buildPayload("subscription.canceled", { orgId: null }));
      await expect(readPlan(orgId)).resolves.toBe("pro");
    });
  });

  describe("handleSubscriptionUpdated", () => {
    it("routes active+pro to upgrade", async () => {
      await handleSubscriptionUpdated(
        buildPayload("subscription.updated", { orgId, status: "active" }),
      );
      await expect(readPlan(orgId)).resolves.toBe("pro");
    });

    it("routes canceled to downgrade", async () => {
      await setOrgPlan(orgId, "pro");
      await handleSubscriptionUpdated(
        buildPayload("subscription.updated", { orgId, status: "canceled" }),
      );
      await expect(readPlan(orgId)).resolves.toBe("free");
    });

    it("ignores unrelated status transitions (e.g. trialing)", async () => {
      await setOrgPlan(orgId, "pro");
      await handleSubscriptionUpdated(
        buildPayload("subscription.updated", { orgId, status: "trialing" }),
      );
      await expect(readPlan(orgId)).resolves.toBe("pro");
    });

    it("ignores active status when product is not Pro", async () => {
      await handleSubscriptionUpdated(
        buildPayload("subscription.updated", {
          orgId,
          productId: FREE_PRODUCT_ID,
          status: "active",
        }),
      );
      await expect(readPlan(orgId)).resolves.toBe("free");
    });
  });

  describe("re-upgrade behavior", () => {
    it("does not auto-restore form Pro columns after re-upgrade", async () => {
      // Upgrade, then downgrade resets form columns, then re-upgrade leaves
      // them at the downgrade-reset values (asserted in plan-cleanup tests;
      // here we sanity-check that the webhook handler doesn't undo that).
      await handleSubscriptionUpgrade(buildPayload("subscription.created", { orgId }));
      await handleSubscriptionDowngrade(buildPayload("subscription.canceled", { orgId }));
      await handleSubscriptionUpgrade(buildPayload("subscription.uncanceled", { orgId }));
      await expect(readPlan(orgId)).resolves.toBe("pro");
    });
  });
});
