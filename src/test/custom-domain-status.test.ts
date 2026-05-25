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
} from "@/test/helpers";

vi.mock<typeof import("@/lib/vercel-domains.server")>(
  import("@/lib/vercel-domains.server"),
  async () => ({
    vercelDomains: {
      check: vi.fn(),
      verify: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      detach: vi.fn(),
    },
  }),
);

describe("refreshDomainStatusFromVercel", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-status-${ownerId}@example.com`,
        name: "Owner Status",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
    vi.clearAllMocks();
  });

  it("calls vercelDomains.check (GET) and never vercelDomains.verify (POST)", async () => {
    const domain = await createTestCustomDomain(orgId, { status: "pending" });
    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.check).mockResolvedValue({
      verified: true,
      verification: undefined,
    });

    const { refreshDomainStatusFromVercel } = await import("@/lib/server-fn/custom-domains.server");
    await refreshDomainStatusFromVercel(domain.id);

    expect(vercelDomains.check).toHaveBeenCalledWith(domain.domain);
    expect(vercelDomains.verify).not.toHaveBeenCalled();
  });
});

describe("triggerDomainVerification", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-trigger-${ownerId}@example.com`,
        name: "Owner Trigger",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await db.delete(customDomains).where(eq(customDomains.organizationId, orgId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
    vi.clearAllMocks();
  });

  it("pOSTs /verify and updates DB to verified on success", async () => {
    const domain = await createTestCustomDomain(orgId, { status: "pending" });
    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.verify).mockResolvedValue({
      verified: true,
      verification: undefined,
    });

    const { triggerDomainVerification } = await import("@/lib/server-fn/custom-domains.server");
    const result = await triggerDomainVerification(domain.id);

    expect(vercelDomains.verify).toHaveBeenCalledWith(domain.domain);
    expect(result.status).toBe("verified");
  });

  it("falls back to check() when verify() returns verified=false with no challenge", async () => {
    const domain = await createTestCustomDomain(orgId, { status: "pending" });
    const { vercelDomains } = await import("@/lib/vercel-domains.server");
    vi.mocked(vercelDomains.verify).mockResolvedValue({
      verified: false,
      verification: undefined,
    });
    vi.mocked(vercelDomains.check).mockResolvedValue({
      verified: false,
      verification: [{ type: "TXT", domain: "_vercel.acme.com", value: "vc-abc" }],
    });

    const { triggerDomainVerification } = await import("@/lib/server-fn/custom-domains.server");
    const result = await triggerDomainVerification(domain.id);

    expect(vercelDomains.check).toHaveBeenCalledWith(domain.domain);
    expect(result.verification).toStrictEqual([
      { type: "TXT", domain: "_vercel.acme.com", value: "vc-abc" },
    ]);
  });
});
