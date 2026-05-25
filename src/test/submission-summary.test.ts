import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/query-core";
import { count, eq } from "drizzle-orm";
import { createSubmissionSummaryCollection } from "@/collections/query/submission";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import {
  getTestUtils,
  createTestOrg,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

const createTestSubmission = async (formId: string) => {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(submissions).values({
    id,
    formId,
    data: { field1: "value1" },
    isCompleted: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
};

const fetchSubmissionsCount = async (formId: string): Promise<{ total: number }> => {
  const [result] = await db
    .select({ total: count() })
    .from(submissions)
    .where(eq(submissions.formId, formId));
  return { total: result?.total ?? 0 };
};

describe("submission summary collection", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-sub-${ownerId}@example.com`, name: "Owner" }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(ws.id, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.formId, formId));
    queryClient.clear();
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("loads submission count via query collection", async () => {
    await createTestSubmission(formId);
    await createTestSubmission(formId);
    await createTestSubmission(formId);

    const collection = createSubmissionSummaryCollection({
      queryClient,
      formId,
      queryFn: () => fetchSubmissionsCount(formId),
    });

    const state = await collection.stateWhenReady();
    const summary = state.get(formId);

    expect(summary).toBeDefined();
    expect(summary).toMatchObject({ formId, total: 3 });
  });

  it("returns zero count for form with no submissions", async () => {
    const collection = createSubmissionSummaryCollection({
      queryClient,
      formId,
      queryFn: () => fetchSubmissionsCount(formId),
    });

    const state = await collection.stateWhenReady();
    const summary = state.get(formId);

    expect(summary).toMatchObject({ formId, total: 0 });
  });

  it("count updates after invalidation when submissions change", async () => {
    const collection = createSubmissionSummaryCollection({
      queryClient,
      formId,
      queryFn: () => fetchSubmissionsCount(formId),
    });

    await collection.stateWhenReady();
    expect(collection.get(formId)).toMatchObject({ total: 0 });

    // Add submissions
    await createTestSubmission(formId);
    await createTestSubmission(formId);

    // Invalidate to trigger refetch
    await queryClient.invalidateQueries({ queryKey: ["submissions-count", formId] });
    await new Promise((r) => setTimeout(r, 300));

    const state = await collection.stateWhenReady();
    expect(state.get(formId)).toMatchObject({ total: 2 });
  });
});
