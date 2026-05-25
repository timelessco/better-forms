import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTestUtils,
  createTestOrg,
  createTestMember,
  createTestWorkspace,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";
import { authWorkspace } from "@/lib/server-fn/auth-helpers.server";

describe("authWorkspace", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const strangerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const t = await getTestUtils();

    const owner = t.createUser({
      id: ownerId,
      email: `owner-${ownerId}@example.com`,
      name: "Owner",
    });
    const member = t.createUser({
      id: memberId,
      email: `member-${memberId}@example.com`,
      name: "Member",
    });
    const stranger = t.createUser({
      id: strangerId,
      email: `stranger-${strangerId}@example.com`,
      name: "Stranger",
    });
    await t.saveUser(owner);
    await t.saveUser(member);
    await t.saveUser(stranger);

    const org = await createTestOrg(ownerId);
    orgId = org.id;

    await createTestMember(memberId, orgId);

    const workspace = await createTestWorkspace(orgId, ownerId);
    workspaceId = workspace.id;
  });

  afterEach(async () => {
    await cleanupTestUser(strangerId);
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("allows org member to access workspace they did not create", async () => {
    const result = await authWorkspace(workspaceId, memberId, orgId);
    expect(result.workspace.id).toBe(workspaceId);
  });

  it("rejects user who is not an org member", async () => {
    await expect(authWorkspace(workspaceId, strangerId, orgId)).rejects.toThrow(
      "Workspace not found or access denied",
    );
  });
});
