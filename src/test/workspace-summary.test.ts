import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import {
  getTestUtils,
  createTestOrg,
  createTestMember,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";
import { createWorkspaceSummaryCollection } from "@/collections/query/workspace";
import type { WorkspaceSummary } from "@/collections/query/workspace";
import { db } from "@/db";
import { forms, member, workspaces } from "@/db/schema";
import { desc, eq, inArray, not } from "drizzle-orm";

/** Query workspaces+forms directly from DB (bypasses auth middleware for tests) */
const fetchWorkspacesWithForms = async (
  userId: string,
): Promise<{ workspaces: WorkspaceSummary[] }> => {
  const userMemberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  if (userMemberships.length === 0) return { workspaces: [] };

  const orgIds = userMemberships.map((m) => m.organizationId);

  const [workspaceList, formsList] = await Promise.all([
    db
      .select()
      .from(workspaces)
      .where(inArray(workspaces.organizationId, orgIds))
      .orderBy(workspaces.createdAt),
    db
      .select({
        id: forms.id,
        title: forms.title,
        updatedAt: forms.updatedAt,
        workspaceId: forms.workspaceId,
      })
      .from(forms)
      .where(not(eq(forms.status, "archived")))
      .orderBy(desc(forms.updatedAt)),
  ]);

  const formsByWorkspace = formsList.reduce(
    (acc, form) => {
      if (!acc[form.workspaceId]) acc[form.workspaceId] = [];
      acc[form.workspaceId].push({
        ...form,
        title: form.title,
        updatedAt: form.updatedAt.toISOString(),
      });
      return acc;
    },
    {} as Record<
      string,
      { id: string; title: string | null; updatedAt: string; workspaceId: string }[]
    >,
  );

  return {
    workspaces: workspaceList.map((ws) => ({
      ...ws,
      createdByUserId: ws.createdByUserId,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
      forms: formsByWorkspace[ws.id] || [],
    })),
  };
};

describe("workspace summary collection", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const t = await getTestUtils();
    const owner = t.createUser({
      id: ownerId,
      email: `owner-ws-${ownerId}@example.com`,
      name: "Owner",
    });
    const memberUser = t.createUser({
      id: memberId,
      email: `member-ws-${memberId}@example.com`,
      name: "Member",
    });
    await t.saveUser(owner);
    await t.saveUser(memberUser);

    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await createTestMember(memberId, orgId);

    const workspace = await createTestWorkspace(orgId, ownerId);
    workspaceId = workspace.id;

    await createTestForm(workspaceId, ownerId);
    await createTestForm(workspaceId, ownerId);
  });

  afterEach(async () => {
    queryClient.clear();
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("loads workspace summaries with lightweight form data", async () => {
    const collection = createWorkspaceSummaryCollection({
      queryClient,
      queryFn: () => fetchWorkspacesWithForms(memberId),
    });

    const state = await collection.stateWhenReady();
    const items = Array.from(state.values());

    const ws = items.find((w: WorkspaceSummary) => w.id === workspaceId);
    expect(ws).toBeDefined();
    expect(ws?.forms).toHaveLength(2);
    // Verify lightweight shape — summary fields only, no full content payload
    expect(ws?.forms[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      workspaceId,
    });
  });

  it("optimistic insert appears immediately in collection state", async () => {
    let serverCalled = false;
    const collection = createWorkspaceSummaryCollection({
      queryClient,
      queryFn: () => fetchWorkspacesWithForms(memberId),
      onInsert: async () => {
        serverCalled = true;
        // Simulate server write — in real app this calls createWorkspace
        return { refetch: false }; // skip refetch to isolate optimistic behavior
      },
    });

    await collection.stateWhenReady();

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    await collection.insert({
      id: newId,
      name: "Optimistic Workspace",
      organizationId: orgId,
      createdByUserId: memberId,
      createdAt: now,
      updatedAt: now,
      forms: [],
    });

    // Optimistic: item should be in state immediately
    const ws = collection.get(newId);
    expect(ws).toBeDefined();
    expect(ws).toMatchObject({
      id: newId,
      name: "Optimistic Workspace",
      organizationId: orgId,
    });

    // Server handler should have been called
    expect(serverCalled).toBeTruthy();
  });

  it("optimistic delete removes item from collection state", async () => {
    const collection = createWorkspaceSummaryCollection({
      queryClient,
      queryFn: () => fetchWorkspacesWithForms(memberId),
      onDelete: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    // Verify workspace exists
    expect(collection.get(workspaceId)).toBeDefined();

    await collection.delete(workspaceId);

    // Optimistic: item should be gone immediately
    expect(collection.get(workspaceId)).toBeUndefined();
  });

  it("optimistic update changes workspace name immediately", async () => {
    const collection = createWorkspaceSummaryCollection({
      queryClient,
      queryFn: () => fetchWorkspacesWithForms(memberId),
      onUpdate: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    await collection.update(workspaceId, (draft) => {
      draft.name = "Renamed Workspace";
    });

    const ws = collection.get(workspaceId);
    expect(ws).toMatchObject({
      id: workspaceId,
      name: "Renamed Workspace",
    });
  });

  it("workspace with no forms returns empty forms array", async () => {
    // Create a second workspace with no forms
    const emptyWs = await createTestWorkspace(orgId, ownerId);

    const collection = createWorkspaceSummaryCollection({
      queryClient,
      queryFn: () => fetchWorkspacesWithForms(memberId),
    });

    const state = await collection.stateWhenReady();
    const items = Array.from(state.values());

    const ws = items.find((w: WorkspaceSummary) => w.id === emptyWs.id);
    expect(ws).toBeDefined();
    expect(ws?.forms).toStrictEqual([]);
  });
});
