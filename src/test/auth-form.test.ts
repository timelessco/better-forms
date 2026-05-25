import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTestUtils,
  createTestOrg,
  createTestMember,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";
import { authForm } from "@/lib/server-fn/auth-helpers.server";

describe("authForm", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const strangerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;
  let formId: string;

  beforeEach(async () => {
    const t = await getTestUtils();

    const owner = t.createUser({
      id: ownerId,
      email: `owner2-${ownerId}@example.com`,
      name: "Owner",
    });
    const member = t.createUser({
      id: memberId,
      email: `member2-${memberId}@example.com`,
      name: "Member",
    });
    const stranger = t.createUser({
      id: strangerId,
      email: `stranger2-${strangerId}@example.com`,
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

    const form = await createTestForm(workspaceId, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    await cleanupTestUser(strangerId);
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("allows org member to access form they did not create", async () => {
    const result = await authForm(formId, memberId, orgId);
    expect(result.form.id).toBe(formId);
  });

  it("rejects user who is not an org member", async () => {
    await expect(authForm(formId, strangerId, orgId)).rejects.toThrow(
      "Form not found or access denied",
    );
  });
});
