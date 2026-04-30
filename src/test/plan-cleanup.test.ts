import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customDomains, forms, organization } from "@/db/schema";
import { mergeFormSettings } from "@/lib/server-fn/forms";
import { applyDowngradeCleanup, applyUpgradeRestore } from "@/lib/server-fn/plan-cleanup.server";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestCustomDomain,
  createTestForm,
  createTestOrg,
  createTestWorkspace,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

describe("plan-cleanup", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const testUtils = await getTestUtils();
    await testUtils.saveUser(
      testUtils.createUser({
        id: ownerId,
        email: `owner-plan-cleanup-${ownerId}@example.com`,
        name: "Owner Plan Cleanup",
      }),
    );

    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await setOrgPlan(orgId, "pro");

    const workspace = await createTestWorkspace(orgId, ownerId);
    workspaceId = workspace.id;
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await db.delete(forms).where(eq(forms.workspaceId, workspaceId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  describe("applyDowngradeCleanup", () => {
    it("flips organization.plan to free", async () => {
      await applyDowngradeCleanup(orgId);

      const [org] = await db
        .select({ plan: organization.plan })
        .from(organization)
        .where(eq(organization.id, orgId));
      expect(org.plan).toBe("free");
    });

    it("resets every gated form column across all forms in the org", async () => {
      const formA = await createTestForm(workspaceId, ownerId);
      const formB = await createTestForm(workspaceId, ownerId);
      await db
        .update(forms)
        .set({
          settings: mergeFormSettings({
            analytics: true,
            dataRetention: true,
            dataRetentionDays: 30,
            respondentEmailNotifications: true,
            branding: false,
          }),
        })
        .where(eq(forms.id, formA.id));
      await db
        .update(forms)
        .set({
          settings: mergeFormSettings({
            analytics: true,
            dataRetention: true,
            dataRetentionDays: 90,
            respondentEmailNotifications: true,
            branding: false,
          }),
        })
        .where(eq(forms.id, formB.id));

      await applyDowngradeCleanup(orgId);

      const rows = await db
        .select({ settings: forms.settings })
        .from(forms)
        .where(eq(forms.workspaceId, workspaceId));

      for (const row of rows) {
        expect(row.settings?.analytics).toBeFalsy();
        expect(row.settings?.dataRetention).toBeFalsy();
        expect(row.settings?.dataRetentionDays).toBeNull();
        expect(row.settings?.respondentEmailNotifications).toBeFalsy();
        expect(row.settings?.branding).toBeTruthy();
      }
    });

    it("preserves form.customization on downgrade", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      const customization = { primaryColor: "#abcdef" };
      await db.update(forms).set({ customization }).where(eq(forms.id, form.id));

      await applyDowngradeCleanup(orgId);

      const [row] = await db
        .select({ customization: forms.customization })
        .from(forms)
        .where(eq(forms.id, form.id));
      expect(row.customization).toStrictEqual(customization);
    });

    it("suspends every non-suspended domain and records previousStatus", async () => {
      const verified = await createTestCustomDomain(orgId, { status: "verified" });
      const pending = await createTestCustomDomain(orgId, { status: "pending" });

      await applyDowngradeCleanup(orgId);

      const rows = await db
        .select({
          id: customDomains.id,
          status: customDomains.status,
          previousStatus: customDomains.previousStatus,
        })
        .from(customDomains)
        .where(eq(customDomains.organizationId, orgId));

      const verifiedAfter = rows.find((r) => r.id === verified.id);
      const pendingAfter = rows.find((r) => r.id === pending.id);
      expect(verifiedAfter).toStrictEqual({
        id: verified.id,
        status: "suspended",
        previousStatus: "verified",
      });
      expect(pendingAfter).toStrictEqual({
        id: pending.id,
        status: "suspended",
        previousStatus: "pending",
      });
    });

    it("is idempotent — running twice does not stomp previousStatus", async () => {
      const domain = await createTestCustomDomain(orgId, { status: "verified" });

      await applyDowngradeCleanup(orgId);
      await applyDowngradeCleanup(orgId);

      const [row] = await db
        .select({
          status: customDomains.status,
          previousStatus: customDomains.previousStatus,
        })
        .from(customDomains)
        .where(eq(customDomains.id, domain.id));
      expect(row).toStrictEqual({ status: "suspended", previousStatus: "verified" });
    });

    it("is a no-op for an org with no forms or domains", async () => {
      const otherOwnerId = crypto.randomUUID();
      const testUtils = await getTestUtils();
      await testUtils.saveUser(
        testUtils.createUser({
          id: otherOwnerId,
          email: `owner-empty-${otherOwnerId}@example.com`,
          name: "Empty Org Owner",
        }),
      );
      const emptyOrg = await createTestOrg(otherOwnerId);

      await expect(applyDowngradeCleanup(emptyOrg.id)).resolves.toBeUndefined();

      await cleanupTestOrg(emptyOrg.id);
      await cleanupTestUser(otherOwnerId);
    });

    it("does not touch forms or domains in other orgs", async () => {
      const otherOwnerId = crypto.randomUUID();
      const testUtils = await getTestUtils();
      await testUtils.saveUser(
        testUtils.createUser({
          id: otherOwnerId,
          email: `owner-other-${otherOwnerId}@example.com`,
          name: "Other Org Owner",
        }),
      );
      const otherOrg = await createTestOrg(otherOwnerId);
      await setOrgPlan(otherOrg.id, "pro");
      const otherWorkspace = await createTestWorkspace(otherOrg.id, otherOwnerId);
      const otherForm = await createTestForm(otherWorkspace.id, otherOwnerId);
      await db
        .update(forms)
        .set({ settings: mergeFormSettings({ analytics: true, branding: false }) })
        .where(eq(forms.id, otherForm.id));
      const otherDomain = await createTestCustomDomain(otherOrg.id, { status: "verified" });

      await applyDowngradeCleanup(orgId);

      const [otherFormAfter] = await db
        .select({ settings: forms.settings })
        .from(forms)
        .where(eq(forms.id, otherForm.id));
      const [otherDomainAfter] = await db
        .select({ status: customDomains.status })
        .from(customDomains)
        .where(eq(customDomains.id, otherDomain.id));
      const [otherOrgAfter] = await db
        .select({ plan: organization.plan })
        .from(organization)
        .where(eq(organization.id, otherOrg.id));

      expect(otherFormAfter.settings?.analytics).toBeTruthy();
      expect(otherFormAfter.settings?.branding).toBeFalsy();
      expect(otherDomainAfter.status).toBe("verified");
      expect(otherOrgAfter.plan).toBe("pro");

      await db.delete(customDomains).where(eq(customDomains.organizationId, otherOrg.id));
      await db.delete(forms).where(eq(forms.workspaceId, otherWorkspace.id));
      await cleanupTestOrg(otherOrg.id);
      await cleanupTestUser(otherOwnerId);
    });
  });

  describe("applyUpgradeRestore", () => {
    it("flips organization.plan to pro", async () => {
      await setOrgPlan(orgId, "free");

      await applyUpgradeRestore(orgId);

      const [org] = await db
        .select({ plan: organization.plan })
        .from(organization)
        .where(eq(organization.id, orgId));
      expect(org.plan).toBe("pro");
    });

    it("restores each suspended domain to its previousStatus and clears previousStatus", async () => {
      const verifiedThenSuspended = await createTestCustomDomain(orgId, {
        status: "suspended",
        previousStatus: "verified",
      });
      const pendingThenSuspended = await createTestCustomDomain(orgId, {
        status: "suspended",
        previousStatus: "pending",
      });

      await applyUpgradeRestore(orgId);

      const rows = await db
        .select({
          id: customDomains.id,
          status: customDomains.status,
          previousStatus: customDomains.previousStatus,
        })
        .from(customDomains)
        .where(eq(customDomains.organizationId, orgId));

      expect(rows.find((r) => r.id === verifiedThenSuspended.id)).toStrictEqual({
        id: verifiedThenSuspended.id,
        status: "verified",
        previousStatus: null,
      });
      expect(rows.find((r) => r.id === pendingThenSuspended.id)).toStrictEqual({
        id: pendingThenSuspended.id,
        status: "pending",
        previousStatus: null,
      });
    });

    it("falls back to 'pending' when a suspended domain has no previousStatus", async () => {
      const domain = await createTestCustomDomain(orgId, {
        status: "suspended",
        previousStatus: null,
      });

      await applyUpgradeRestore(orgId);

      const [row] = await db
        .select({
          status: customDomains.status,
          previousStatus: customDomains.previousStatus,
        })
        .from(customDomains)
        .where(eq(customDomains.id, domain.id));
      expect(row).toStrictEqual({ status: "pending", previousStatus: null });
    });

    it("does not auto-restore form Pro columns", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      await db
        .update(forms)
        .set({
          settings: mergeFormSettings({
            analytics: false,
            dataRetention: false,
            dataRetentionDays: null,
            respondentEmailNotifications: false,
            branding: true,
          }),
        })
        .where(eq(forms.id, form.id));
      await setOrgPlan(orgId, "free");

      await applyUpgradeRestore(orgId);

      const [row] = await db
        .select({ settings: forms.settings })
        .from(forms)
        .where(eq(forms.id, form.id));
      expect(row.settings?.analytics).toBeFalsy();
      expect(row.settings?.dataRetention).toBeFalsy();
      expect(row.settings?.respondentEmailNotifications).toBeFalsy();
      expect(row.settings?.branding).toBeTruthy();
    });

    it("round-trip: downgrade then upgrade restores domain status", async () => {
      const verified = await createTestCustomDomain(orgId, { status: "verified" });

      await applyDowngradeCleanup(orgId);
      await applyUpgradeRestore(orgId);

      const [row] = await db
        .select({
          status: customDomains.status,
          previousStatus: customDomains.previousStatus,
        })
        .from(customDomains)
        .where(eq(customDomains.id, verified.id));
      expect(row).toStrictEqual({ status: "verified", previousStatus: null });
    });
  });
});
