import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customDomains } from "@/db/schema";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestCustomDomain,
  createTestOrg,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

vi.mock<typeof import("@/lib/vercel-domains.server")>(
  import("@/lib/vercel-domains.server"),
  async () => ({
    vercelDomains: {
      add: vi.fn(),
      check: vi.fn(),
      verify: vi.fn(),
      remove: vi.fn(),
      detach: vi.fn(),
    },
  }),
);

describe("applyDowngradeCleanup — Vercel sync", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-down-${ownerId}@example.com`,
        name: "Owner Down",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await setOrgPlan(orgId, "pro");
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
    vi.clearAllMocks();
  });

  it("calls vercelDomains.detach (project-only) once per non-suspended domain", async () => {
    const a = await createTestCustomDomain(orgId, { domain: "a.example.com", status: "verified" });
    const b = await createTestCustomDomain(orgId, { domain: "b.example.com", status: "pending" });
    await createTestCustomDomain(orgId, { domain: "c.example.com", status: "suspended" });

    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.detach).mockResolvedValue(undefined);

    const { applyDowngradeCleanup } = await import("@/lib/server-fn/plan-cleanup.server");
    await applyDowngradeCleanup(orgId);

    expect(vercelDomains.detach).toHaveBeenCalledTimes(2);
    expect(vercelDomains.detach).toHaveBeenCalledWith(a.domain);
    expect(vercelDomains.detach).toHaveBeenCalledWith(b.domain);
    expect(vercelDomains.remove).not.toHaveBeenCalled();
  });

  it("still suspends rows in DB even if Vercel detach throws", async () => {
    const a = await createTestCustomDomain(orgId, { domain: "a.example.com", status: "verified" });

    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.detach).mockRejectedValue(new Error("Vercel down"));

    const { applyDowngradeCleanup } = await import("@/lib/server-fn/plan-cleanup.server");
    await applyDowngradeCleanup(orgId);

    const [row] = await db.select().from(customDomains).where(eq(customDomains.id, a.id));
    expect(row.status).toBe("suspended");
    expect(row.previousStatus).toBe("verified");
  });
});

describe("applyUpgradeRestore — Vercel sync", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-up-${ownerId}@example.com`,
        name: "Owner Up",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await setOrgPlan(orgId, "free");
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
    vi.clearAllMocks();
  });

  it("calls vercelDomains.add for each suspended domain on upgrade", async () => {
    const a = await createTestCustomDomain(orgId, {
      domain: "a.example.com",
      status: "suspended",
      previousStatus: "verified",
    });

    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.add).mockResolvedValue({
      domain: a.domain,
      verified: true,
      verification: undefined,
    });

    const { applyUpgradeRestore } = await import("@/lib/server-fn/plan-cleanup.server");
    await applyUpgradeRestore(orgId);

    expect(vercelDomains.add).toHaveBeenCalledWith(a.domain);
  });
});
