import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { eq } from "drizzle-orm";
import { resolveFormRoute } from "@/collections/utils";
import { createFormListingCollection } from "@/collections/query/form-listing";
import type { FormListing } from "@/collections/query/form-listing";
import { db } from "@/db";
import { forms } from "@/db/schema";
import {
  getTestUtils,
  createTestOrg,
  createTestMember,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

/** Fetch form listings directly from DB (bypasses auth middleware) */
const fetchFormListings = async (formId: string): Promise<FormListing[]> => {
  const [form] = await db.select().from(forms).where(eq(forms.id, formId));
  if (!form) return [];
  return [
    {
      id: form.id,
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
      submissionCount: 0,
    },
  ];
};

describe("form data in unified collection", () => {
  const ownerId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  let orgId: string;
  let formId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-fd-${ownerId}@example.com`, name: "Owner" }),
    );
    await t.saveUser(
      t.createUser({ id: memberId, email: `member-fd-${memberId}@example.com`, name: "Member" }),
    );

    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await createTestMember(memberId, orgId);

    const workspace = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(workspace.id, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    queryClient.clear();
    await cleanupTestUser(memberId);
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("loads form with content through formListings", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
    });

    const state = await collection.stateWhenReady();
    const form = state.get(formId);

    expect(form).toBeDefined();
    expect(form).toMatchObject({
      id: formId,
      status: "draft",
      content: expect.any(Object),
    });
  });

  it("returns empty collection for nonexistent form", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings("00000000-0000-0000-0000-000000000000"),
    });

    const state = await collection.stateWhenReady();
    expect(state.size).toBe(0);
  });

  it("optimistic update modifies form data", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
      onUpdate: async () => ({ refetch: false }),
    });

    await collection.stateWhenReady();

    collection.update(formId, (draft: FormListing) => {
      draft.title = "Updated Detail Title";
      draft.status = "published";
    });

    const form = collection.get(formId);
    expect(form).toMatchObject({
      title: "Updated Detail Title",
      status: "published",
    });
  });
});

describe("resolveFormRoute", () => {
  it("routes draft to editor", () => {
    expect(resolveFormRoute("draft")).toBe("editor");
  });

  it("routes published to submissions", () => {
    expect(resolveFormRoute("published")).toBe("submissions");
  });

  it("routes archived to archived", () => {
    expect(resolveFormRoute("archived")).toBe("archived");
  });

  it("routes undefined to not-found", () => {
    expect(resolveFormRoute(undefined)).toBe("not-found");
  });
});
