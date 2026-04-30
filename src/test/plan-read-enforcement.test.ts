import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customDomains, forms } from "@/db/schema";
import { isAnalyticsEnabled } from "@/lib/server-fn/analytics.server";
import { mergeFormSettings } from "@/lib/server-fn/forms";
import {
  resolveCustomDomain,
  resolveDomainForSlug,
} from "@/lib/server-fn/custom-domain-loader.server";
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

describe("plan-read-enforcement", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const testUtils = await getTestUtils();
    await testUtils.saveUser(
      testUtils.createUser({
        id: ownerId,
        email: `owner-read-enforce-${ownerId}@example.com`,
        name: "Owner Read Enforce",
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

  describe("isAnalyticsEnabled", () => {
    it("true when org is pro and forms.analytics is true", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      await db
        .update(forms)
        .set({ settings: mergeFormSettings({ analytics: true }) })
        .where(eq(forms.id, form.id));

      await expect(isAnalyticsEnabled(form.id)).resolves.toBeTruthy();
    });

    it("false when org is pro and forms.analytics is false", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      await expect(isAnalyticsEnabled(form.id)).resolves.toBeFalsy();
    });

    it("false when org is free and forms.analytics is true (post-downgrade race)", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      await db
        .update(forms)
        .set({ settings: mergeFormSettings({ analytics: true }) })
        .where(eq(forms.id, form.id));
      await setOrgPlan(orgId, "free");

      await expect(isAnalyticsEnabled(form.id)).resolves.toBeFalsy();
    });

    it("false when org is free and forms.analytics is false", async () => {
      const form = await createTestForm(workspaceId, ownerId);
      await setOrgPlan(orgId, "free");
      await expect(isAnalyticsEnabled(form.id)).resolves.toBeFalsy();
    });

    it("false for unknown form id", async () => {
      await expect(isAnalyticsEnabled(crypto.randomUUID())).resolves.toBeFalsy();
    });
  });

  describe("resolveCustomDomain (host lookup)", () => {
    it("resolves verified domain on a Pro org", async () => {
      const domain = await createTestCustomDomain(orgId, {
        domain: `pro-${crypto.randomUUID()}.example.com`,
        status: "verified",
      });
      const resolved = await resolveCustomDomain(domain.domain);
      expect(resolved.id).toBe(domain.id);
    });

    it("does not resolve verified domain when org is free (pre-suspend race)", async () => {
      const domain = await createTestCustomDomain(orgId, {
        domain: `free-race-${crypto.randomUUID()}.example.com`,
        status: "verified",
      });
      await setOrgPlan(orgId, "free");

      await expect(resolveCustomDomain(domain.domain)).rejects.toMatchObject({
        isNotFound: true,
      });
    });

    it("does not resolve a suspended domain", async () => {
      const domain = await createTestCustomDomain(orgId, {
        domain: `suspended-${crypto.randomUUID()}.example.com`,
        status: "suspended",
        previousStatus: "verified",
      });
      await expect(resolveCustomDomain(domain.domain)).rejects.toMatchObject({
        isNotFound: true,
      });
    });

    it("resolves again after re-upgrade restores status", async () => {
      const domain = await createTestCustomDomain(orgId, {
        domain: `restored-${crypto.randomUUID()}.example.com`,
        status: "suspended",
        previousStatus: "verified",
      });
      await db
        .update(customDomains)
        .set({ status: "verified", previousStatus: null })
        .where(eq(customDomains.id, domain.id));
      const resolved = await resolveCustomDomain(domain.domain);
      expect(resolved.id).toBe(domain.id);
    });
  });

  describe("resolveDomainForSlug (dev fallback)", () => {
    it("resolves only when org is on Pro AND domain is verified", async () => {
      const domain = await createTestCustomDomain(orgId, { status: "verified" });
      const form = await createTestForm(workspaceId, ownerId);
      await db
        .update(forms)
        .set({ slug: "test-slug", customDomainId: domain.id, status: "published" })
        .where(eq(forms.id, form.id));

      const resolved = await resolveDomainForSlug("test-slug");
      expect(resolved.id).toBe(domain.id);

      await setOrgPlan(orgId, "free");
      await expect(resolveDomainForSlug("test-slug")).rejects.toMatchObject({
        isNotFound: true,
      });
    });
  });
});
