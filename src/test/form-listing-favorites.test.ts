import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { and, eq, not } from "drizzle-orm";
import {
  createFormListingCollection,
  createFavoriteCollection,
} from "@/collections/query/form-listing";
import type { FormListing, FormFavorite } from "@/collections/query/form-listing";
import { db } from "@/db";
import { forms, formFavorites, member, workspaces } from "@/db/schema";
import {
  getTestUtils,
  createTestOrg,
  createTestMember,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
  toFormListing,
} from "@/test/helpers";

/** Fetch form listings directly from DB (bypasses auth middleware) */
const fetchFormListings = async (userId: string): Promise<FormListing[]> => {
  const userMemberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId));

  if (userMemberships.length === 0) return [];

  const orgIds = userMemberships.map((m) => m.organizationId);

  const wsIds = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(orgIds.length === 1 ? eq(workspaces.organizationId, orgIds[0]) : (undefined as never));

  const formList = await db
    .select()
    .from(forms)
    .where(and(not(eq(forms.status, "archived"))))
    .orderBy(forms.updatedAt);

  return formList
    .filter((f) => wsIds.some((w) => w.id === f.workspaceId))
    .map((f) => toFormListing(f));
};

/** Fetch favorites directly from DB */
const fetchFavorites = async (userId: string): Promise<FormFavorite[]> => {
  const favs = await db.select().from(formFavorites).where(eq(formFavorites.userId, userId));

  return favs.map((f) => ({
    id: f.id,
    userId: f.userId,
    formId: f.formId,
    createdAt: f.createdAt.toISOString(),
  }));
};

describe("form listing collection", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;
  let formId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-fl-${ownerId}@example.com`, name: "Owner" }),
    );
    await t.saveUser(
      t.createUser({ id: memberId, email: `member-fl-${memberId}@example.com`, name: "Member" }),
    );

    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await createTestMember(memberId, orgId);

    const workspace = await createTestWorkspace(orgId, ownerId);
    workspaceId = workspace.id;

    const form = await createTestForm(workspaceId, ownerId);
    formId = form.id;
    await createTestForm(workspaceId, ownerId);
  });

  afterEach(async () => {
    // Clean up favorites
    await db.delete(formFavorites).where(eq(formFavorites.userId, memberId));
    queryClient.clear();
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("loads lightweight form listings for org member", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(memberId),
    });

    const state = await collection.stateWhenReady();
    const items = Array.from(state.values());

    const ours = items.filter((f) => f.workspaceId === workspaceId);
    expect(ours).toHaveLength(2);
    expect(ours[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      workspaceId,
    });
  });

  it("optimistic form listing update works", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(memberId),
      onUpdate: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    await collection.update(formId, (draft: FormListing) => {
      draft.title = "Updated Title";
    });

    const updated = collection.get(formId);
    expect(updated).toMatchObject({ id: formId, title: "Updated Title" });
  });
});

describe("favorite collection", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;
  let formId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-fav-${ownerId}@example.com`, name: "Owner" }),
    );
    await t.saveUser(
      t.createUser({ id: memberId, email: `member-fav-${memberId}@example.com`, name: "Member" }),
    );

    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await createTestMember(memberId, orgId);

    const workspace = await createTestWorkspace(orgId, ownerId);
    workspaceId = workspace.id;

    const form = await createTestForm(workspaceId, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    await db.delete(formFavorites).where(eq(formFavorites.userId, memberId));
    queryClient.clear();
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("optimistic favorite insert appears immediately", async () => {
    const collection = createFavoriteCollection({
      queryClient,
      queryFn: () => fetchFavorites(memberId),
      onInsert: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    const favId = `${memberId}:${formId}`;
    await collection.insert({
      id: favId,
      userId: memberId,
      formId,
      createdAt: new Date().toISOString(),
    });

    const fav = collection.get(favId);
    expect(fav).toBeDefined();
    expect(fav).toMatchObject({ userId: memberId, formId });
  });

  it("optimistic favorite delete removes immediately and rolls back on failure", async () => {
    // Seed a favorite in the DB
    const favId = `${memberId}:${formId}`;
    await db.insert(formFavorites).values({
      id: favId,
      userId: memberId,
      formId,
      createdAt: new Date(),
    });

    const collection = createFavoriteCollection({
      queryClient,
      queryFn: () => fetchFavorites(memberId),
      onDelete: async () => {
        throw new Error("Server failure");
      },
    });

    await collection.stateWhenReady();
    expect(collection.get(favId)).toBeDefined();

    // Delete — optimistic removal happens immediately
    collection.delete(favId);
    expect(collection.get(favId)).toBeUndefined();

    // Wait for server failure + rollback + refetch
    await new Promise((r) => setTimeout(r, 500));
    // After rollback, item should reappear from refetch
    expect(collection.get(favId)).toBeDefined();
  });

  it("favorite toggle: insert then delete", async () => {
    const collection = createFavoriteCollection({
      queryClient,
      queryFn: () => fetchFavorites(memberId),
      onInsert: async () => ({ refetch: false }),
      onDelete: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    const favId = `${memberId}:${formId}`;

    await collection.insert({
      id: favId,
      userId: memberId,
      formId,
      createdAt: new Date().toISOString(),
    });
    expect(collection.get(favId)).toBeDefined();

    await collection.delete(favId);
    expect(collection.get(favId)).toBeUndefined();
  });
});
