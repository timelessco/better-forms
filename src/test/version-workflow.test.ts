import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { desc, eq } from "drizzle-orm";
import { createVersionListCollection } from "@/collections/query/version";
import type { VersionListItem } from "@/collections/query/version";
import { createFormListingCollection } from "@/collections/query/form-listing";
import type { FormListing } from "@/collections/query/form-listing";
import { db } from "@/db";
import { forms, formVersions, user } from "@/db/schema";
import { pickVersionedSettings } from "@/lib/content-hash";
import {
  getTestUtils,
  createTestOrg,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

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

const fetchFormListings = async (formId: string): Promise<FormListing[]> => {
  const [f] = await db.select().from(forms).where(eq(forms.id, formId));
  if (!f) return [];
  return [
    {
      id: f.id,
      title: f.title,
      status: f.status,
      workspaceId: f.workspaceId,
      content: f.content as unknown[],
      customization: (f.customization ?? {}) as Record<string, unknown>,
      formName: f.formName,
      schemaName: f.schemaName,
      icon: f.icon,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      submissionCount: 0,
    },
  ];
};

describe("version workflow", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-vw-${ownerId}@example.com`, name: "Owner" }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(ws.id, ownerId);
    formId = form.id;
    await createTestVersion(formId, ownerId, 1);
  });

  afterEach(async () => {
    await db.delete(formVersions).where(eq(formVersions.formId, formId));
    queryClient.clear();
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("publish adds new version to version list", async () => {
    const collection = createVersionListCollection({
      queryClient,
      formId,
      queryFn: () => fetchVersionList(formId),
    });

    await collection.stateWhenReady();
    const before = Array.from(collection.state.values());
    expect(before).toHaveLength(1);

    // Simulate publish by inserting a version in DB, then refetch
    await createTestVersion(formId, ownerId, 2);
    await queryClient.invalidateQueries({ queryKey: ["form-versions", formId] });
    await new Promise((r) => setTimeout(r, 300));

    const after = await collection.stateWhenReady();
    expect(after.size).toBe(2);
  });

  it("restore updates form data optimistically", async () => {
    const detail = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
      onUpdate: async () => ({ refetch: false }),
    });

    await detail.stateWhenReady();

    // Simulate restore: update form title/content to version's values
    detail.update(formId, (draft: FormListing) => {
      draft.title = "Form v1";
      draft.content = [{ type: "p", children: [{ text: "Version 1" }] }] as unknown[];
    });

    const form = detail.get(formId);
    expect(form).toMatchObject({ title: "Form v1" });
  });

  it("discard reverts form to published state optimistically", async () => {
    const detail = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
      onUpdate: async () => ({ refetch: false }),
    });

    await detail.stateWhenReady();

    // Simulate: user edited draft
    detail.update(formId, (draft: FormListing) => {
      draft.title = "Unsaved Edit";
    });
    expect(detail.get(formId)).toMatchObject({ title: "Unsaved Edit" });

    // Simulate discard: revert to published version content
    detail.update(formId, (draft: FormListing) => {
      draft.title = "Form v1";
      draft.content = [{ type: "p", children: [{ text: "Version 1" }] }] as unknown[];
    });
    expect(detail.get(formId)).toMatchObject({ title: "Form v1" });
  });
});
