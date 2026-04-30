import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth/auth";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";
import { defaultFormSettings } from "@/types/form-settings";

interface TestHelpers {
  createUser: (overrides?: Record<string, unknown>) => { id: string; [key: string]: unknown };
  saveUser: (user: {
    id: string;
    [key: string]: unknown;
  }) => Promise<{ id: string; [key: string]: unknown }>;
  deleteUser: (userId: string) => Promise<void>;
  createOrganization: (overrides?: Record<string, unknown>) => {
    id: string;
    [key: string]: unknown;
  };
  saveOrganization: (org: {
    id: string;
    [key: string]: unknown;
  }) => Promise<{ id: string; [key: string]: unknown }>;
  deleteOrganization: (orgId: string) => Promise<void>;
  addMember: (data: {
    userId: string;
    organizationId: string;
    role: string;
  }) => Promise<{ id: string; [key: string]: unknown }>;
}

let _test: TestHelpers;

export const getTestUtils = async (): Promise<TestHelpers> => {
  if (!_test) {
    const ctx = await auth.$context;
    _test = ctx.test as unknown as TestHelpers;
  }
  return _test;
};

export const createTestOrg = async (ownerId: string) => {
  const t = await getTestUtils();
  const org = t.createOrganization({ name: "Test Org", slug: `test-${ownerId}` });
  await t.saveOrganization(org);
  await t.addMember({ userId: ownerId, organizationId: org.id, role: "owner" });
  return org;
};

export const createTestMember = async (userId: string, organizationId: string) => {
  const t = await getTestUtils();
  return t.addMember({ userId, organizationId, role: "member" });
};

export const createTestWorkspace = async (orgId: string, creatorId: string) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({
      id,
      organizationId: orgId,
      createdByUserId: creatorId,
      name: "Test Workspace",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return workspace;
};

export const createTestForm = async (workspaceId: string, creatorId: string) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const [form] = await db
    .insert(schema.forms)
    .values({
      id,
      createdByUserId: creatorId,
      workspaceId,
      title: "Test Form",
      formName: "draft",
      schemaName: "draftFormSchema",
      content: [],
      settings: defaultFormSettings,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return form;
};

export const cleanupTestUser = async (userId: string) => {
  const t = await getTestUtils();
  await t.deleteUser(userId);
};

export const cleanupTestOrg = async (orgId: string) => {
  const t = await getTestUtils();
  await t.deleteOrganization(orgId);
};

export const setOrgPlan = async (orgId: string, plan: ServerPlan) => {
  await db.update(schema.organization).set({ plan }).where(eq(schema.organization.id, orgId));
};

export const createTestCustomDomain = async (
  orgId: string,
  overrides: { domain?: string; status?: string; previousStatus?: string | null } = {},
) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const [domain] = await db
    .insert(schema.customDomains)
    .values({
      id,
      organizationId: orgId,
      domain: overrides.domain ?? `${id}.example.com`,
      status: overrides.status ?? "verified",
      previousStatus: overrides.previousStatus ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return domain;
};
