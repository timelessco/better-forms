import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { upsertSubmissionByDraft } from "@/lib/server-fn/public-submissions-upsert.server";
import {
  getTestUtils,
  createTestOrg,
  createTestWorkspace,
  createTestForm,
  cleanupTestUser,
  cleanupTestOrg,
} from "@/test/helpers";

const rowsForDraft = (formId: string, draftId: string) =>
  db
    .select()
    .from(submissions)
    .where(and(eq(submissions.formId, formId), eq(submissions.draftId, draftId)));

describe("upsertSubmissionByDraft (atomic finalize upsert)", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;

  beforeEach(async () => {
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({ id: ownerId, email: `owner-upsert-${ownerId}@example.com`, name: "Owner" }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(ws.id, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    await db.delete(submissions).where(eq(submissions.formId, formId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("first finalize inserts a single row and reports it was not previously completed", async () => {
    const draftId = crypto.randomUUID();
    const res = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "value1" },
      isCompleted: true,
      lastStepReached: 2,
      now: new Date(),
    });

    expect(res.wasCompleted).toBe(false);
    const rows = await rowsForDraft(formId, draftId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(res.submissionId);
    expect(rows[0]?.isCompleted).toBe(true);
    expect(rows[0]?.data).toEqual({ field1: "value1" });
  });

  it("re-finalize with the same draftId updates the same row (no duplicate, no throw)", async () => {
    const draftId = crypto.randomUUID();
    const first = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "v1" },
      isCompleted: true,
      lastStepReached: null,
      now: new Date(),
    });

    // Second finalize with the SAME draftId — the regression: previously this raced into a
    // duplicate INSERT → unique violation → 500. Now it upserts the same row.
    const second = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "v2" },
      isCompleted: true,
      lastStepReached: null,
      now: new Date(),
    });

    expect(second.submissionId).toBe(first.submissionId);
    expect(second.wasCompleted).toBe(true);
    const rows = await rowsForDraft(formId, draftId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toEqual({ field1: "v2" });
  });

  it("does not downgrade a completed row when a late save arrives with isCompleted=false", async () => {
    const draftId = crypto.randomUUID();
    await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "final" },
      isCompleted: true,
      lastStepReached: 5,
      now: new Date(),
    });

    const late = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "stale-draft" },
      isCompleted: false,
      lastStepReached: 1,
      now: new Date(),
    });

    expect(late.wasCompleted).toBe(true);
    const rows = await rowsForDraft(formId, draftId);
    expect(rows).toHaveLength(1);
    // Row stays completed; data + lastStepReached unchanged (no-downgrade guard held).
    expect(rows[0]?.isCompleted).toBe(true);
    expect(rows[0]?.data).toEqual({ field1: "final" });
    expect(rows[0]?.lastStepReached).toBe(5);
  });

  it("upgrades an incomplete draft to completed in place", async () => {
    const draftId = crypto.randomUUID();
    const draft = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "draft" },
      isCompleted: false,
      lastStepReached: 1,
      now: new Date(),
    });
    expect(draft.wasCompleted).toBe(false);

    const final = await upsertSubmissionByDraft({
      formId,
      draftId,
      formVersionId: null,
      data: { field1: "done" },
      isCompleted: true,
      lastStepReached: 3,
      now: new Date(),
    });

    expect(final.submissionId).toBe(draft.submissionId);
    // Prior row existed but was NOT completed → finalize should fire (wasCompleted=false).
    expect(final.wasCompleted).toBe(false);
    const rows = await rowsForDraft(formId, draftId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isCompleted).toBe(true);
    expect(rows[0]?.data).toEqual({ field1: "done" });
  });
});
