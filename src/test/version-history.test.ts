import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { desc, eq } from "drizzle-orm";
import {
  createVersionListCollection,
  createVersionContentCollection,
} from "@/collections/query/version";
import type { VersionListItem, VersionContent } from "@/collections/query/version";
import { db } from "@/db";
import { formVersions, user } from "@/db/schema";
import { pickVersionedSettings } from "@/lib/content-hash";
import {
  getTestUtils,
  createTestOrg,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

/** Create a test version in the DB */
const createTestVersion = async (formId: string, publishedByUserId: string, version: number) => {
  const id = crypto.randomUUID();
  const now = new Date();
  const [v] = await db
    .insert(formVersions)
    .values({
      id,
      formId,
      version,
      content: [{ type: "p", children: [{ text: `Version ${version}` }] }],
      settings: pickVersionedSettings(null),
      customization: {},
      title: `Form v${version}`,
      publishedByUserId,
      publishedAt: now,
      createdAt: now,
    })
    .returning();
  return v;
};

/** Fetch version list from DB (bypasses auth) */
const fetchVersionList = async (formId: string): Promise<VersionListItem[]> => {
  const versions = await db
    .select({
      id: formVersions.id,
      version: formVersions.version,
      title: formVersions.title,
      publishedAt: formVersions.publishedAt,
      publishedByUserId: formVersions.publishedByUserId,
      publishedByName: user.name,
      publishedByImage: user.image,
    })
    .from(formVersions)
    .leftJoin(user, eq(formVersions.publishedByUserId, user.id))
    .where(eq(formVersions.formId, formId))
    .orderBy(desc(formVersions.version));

  return versions.map((v) => ({
    id: v.id,
    version: v.version,
    title: v.title,
    publishedAt: v.publishedAt.toISOString(),
    publishedBy: { id: v.publishedByUserId, name: v.publishedByName, image: v.publishedByImage },
  }));
};

/** Fetch version content from DB (bypasses auth) */
const fetchVersionContent = async (versionId: string): Promise<VersionContent | null> => {
  const [v] = await db.select().from(formVersions).where(eq(formVersions.id, versionId));
  if (!v) return null;
  return {
    id: v.id,
    formId: v.formId,
    version: v.version,
    content: v.content as object[],
    settings: v.settings,
    customization: (v.customization ?? {}) as Record<string, string>,
    title: v.title,
    icon: v.icon ?? null,
    cover: v.cover ?? null,
    publishedAt: v.publishedAt.toISOString(),
    createdAt: v.createdAt.toISOString(),
  };
};

describe("version history collection", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;
  let versionId1: string;
  // versionId2 available if needed for future tests
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-ver-${ownerId}@example.com`, name: "Owner" }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(ws.id, ownerId);
    formId = form.id;

    const v1 = await createTestVersion(formId, ownerId, 1);
    await createTestVersion(formId, ownerId, 2);
    versionId1 = v1.id;
  });

  afterEach(async () => {
    await db.delete(formVersions).where(eq(formVersions.formId, formId));
    queryClient.clear();
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("loads lightweight version list without content", async () => {
    const collection = createVersionListCollection({
      queryClient,
      formId,
      queryFn: () => fetchVersionList(formId),
    });

    const state = await collection.stateWhenReady();
    const items = Array.from(state.values());

    expect(items).toHaveLength(2);
    // Both versions present
    const versions = items.map((i) => i.version).toSorted();
    expect(versions).toStrictEqual([1, 2]);
    // No content field in list items (lightweight)
    expect(Object.keys(items[0])).not.toContain("content");
  });

  it("loads full version content on demand", async () => {
    const collection = createVersionContentCollection({
      queryClient,
      versionId: versionId1,
      queryFn: () => fetchVersionContent(versionId1),
    });

    const state = await collection.stateWhenReady();
    const version = state.get(versionId1);

    expect(version).toBeDefined();
    expect(version).toMatchObject({
      id: versionId1,
      version: 1,
      content: expect.any(Array),
    });
  });

  it("returns empty for nonexistent version", async () => {
    const collection = createVersionContentCollection({
      queryClient,
      versionId: "00000000-0000-0000-0000-000000000000",
      queryFn: () => fetchVersionContent("00000000-0000-0000-0000-000000000000"),
    });

    const state = await collection.stateWhenReady();
    expect(state.size).toBe(0);
  });
});
