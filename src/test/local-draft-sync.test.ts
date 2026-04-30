import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { eq } from "drizzle-orm";
import { createFormListingCollection } from "@/collections/query/form-listing";
import type { FormListing } from "@/collections/query/form-listing";
import { db } from "@/db";
import { forms } from "@/db/schema";
import {
  getTestUtils,
  createTestOrg,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

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

describe("local draft sync without Electric txids", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;
  let workspaceId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-ds-${ownerId}@example.com`, name: "Owner" }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    workspaceId = ws.id;
    const form = await createTestForm(workspaceId, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    queryClient.clear();
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("refetch-based confirmation: form exists after server write", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
    });

    const state = await collection.stateWhenReady();
    const confirmed = state.get(formId);

    expect(confirmed).toBeDefined();
    expect(confirmed).toMatchObject({ id: formId });
  });

  it("refetch returns empty when server write failed (form not in DB)", async () => {
    const missingId = "00000000-0000-0000-0000-000000000000";
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(missingId),
    });

    const state = await collection.stateWhenReady();
    expect(state.size).toBe(0);
  });

  it("invalidate + refetch confirms data after server write", async () => {
    const collection = createFormListingCollection({
      queryClient,
      queryFn: () => fetchFormListings(formId),
    });

    await collection.stateWhenReady();

    await queryClient.invalidateQueries({ queryKey: ["form-listings"] });
    await new Promise((r) => setTimeout(r, 200));

    const state = await collection.stateWhenReady();
    expect(state.get(formId)).toMatchObject({ id: formId });
  });
});
