import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth/auth";
import type { FormListing } from "@/collections/query/form-listing";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";
import { generateShortId } from "@/lib/short-id";
import { defaultFormSettings } from "@/types/form-settings";

/** Map a `forms` row → `FormListing`, for tests that fabricate listings from raw DB rows. */
export const toFormListing = (
  form: typeof schema.forms.$inferSelect,
  opts: { submissionCount?: number } = {},
): FormListing => ({
  id: form.id,
  shortId: form.shortId,
  title: form.title,
  status: form.status,
  workspaceId: form.workspaceId,
  content: form.content as unknown[],
  customization: (form.customization ?? {}) as Record<string, unknown>,
  formName: form.formName,
  schemaName: form.schemaName,
  icon: form.icon,
  createdAt: form.createdAt.toISOString(),
  updatedAt: form.updatedAt.toISOString(),
  submissionCount: opts.submissionCount ?? 0,
});

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

export const createTestForm = async (
  workspaceId: string,
  creatorId: string,
  status: "draft" | "published" | "archived" = "draft",
) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const [form] = await db
    .insert(schema.forms)
    .values({
      id,
      shortId: generateShortId(),
      createdByUserId: creatorId,
      workspaceId,
      title: "Test Form",
      formName: "draft",
      schemaName: "draftFormSchema",
      content: [],
      draftSettings: defaultFormSettings,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return form;
};

// deleteUser only drops the `user` row; `member` has no FK (schema.ts:32-42) so member rows + auto-provisioned org (auth.ts:72-104) linger. Walk by userId: org cascade sweeps workspaces/forms/etc; explicit member/order deletes mop up FK-less rows.
export const cleanupTestUser = async (userId: string) => {
  const orgRows = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  const orgIds = orgRows.map((r) => r.organizationId);

  if (orgIds.length > 0) {
    await db.delete(schema.organization).where(inArray(schema.organization.id, orgIds));
  }
  // member + user_workspace_order have no FK cascade — clear explicitly.
  await db.delete(schema.member).where(eq(schema.member.userId, userId));
  await db.delete(schema.userWorkspaceOrder).where(eq(schema.userWorkspaceOrder.userId, userId));

  const t = await getTestUtils();
  await t.deleteUser(userId);
};

export const cleanupTestOrg = async (orgId: string) => {
  // Like cleanupTestUser: drop members first (no FK cascade), then org (cascades workspaces/forms/etc).
  await db.delete(schema.member).where(eq(schema.member.organizationId, orgId));
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
