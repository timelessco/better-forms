/**
 * recordQuestionProgressBatchImpl: one multi-row INSERT … ON CONFLICT DO UPDATE per batch.
 * DB-backed — pins intra-batch de-dup (no "row affected twice" error) and that the coalesce/OR
 * conflict semantics match the single-row recorder against real Postgres.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  formAnalyticsDaily,
  formDropoffDaily,
  formQuestionProgress,
  formSettings,
  formVisits,
  forms,
} from "@/db/schema";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestForm,
  createTestOrg,
  createTestWorkspace,
  getTestUtils,
} from "@/test/helpers";
import {
  recordQuestionProgressBatchImpl,
  type RecordQuestionProgressInput,
} from "@/lib/server-fn/analytics.server";

describe("recordQuestionProgressBatchImpl multi-row upsert", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;
  let formId: string;
  const visitId = crypto.randomUUID();

  const item = (
    overrides: Partial<RecordQuestionProgressInput> & Pick<RecordQuestionProgressInput, "event">,
  ): RecordQuestionProgressInput => ({
    visitId,
    formId,
    visitorHash: "hash-1",
    questionId: "q-1",
    questionType: "Input",
    questionIndex: 0,
    stepId: "step-1",
    stepIndex: 2,
    wasLastQuestion: false,
    ...overrides,
  });

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-batch-${ownerId}@example.com`,
        name: "Owner Batch",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    workspaceId = ws.id;
    const form = await createTestForm(workspaceId, ownerId);
    formId = form.id;
    await db
      .insert(formVisits)
      .values({ id: visitId, formId, visitorHash: "hash-1", sessionId: "s-1" });
  });

  afterEach(async () => {
    const formIds = await db
      .select({ id: forms.id })
      .from(forms)
      .where(eq(forms.workspaceId, workspaceId));
    if (formIds.length > 0) {
      const ids = formIds.map((f) => f.id);
      await db.delete(formQuestionProgress).where(inArray(formQuestionProgress.formId, ids));
      await db.delete(formVisits).where(inArray(formVisits.formId, ids));
      await db.delete(formAnalyticsDaily).where(inArray(formAnalyticsDaily.formId, ids));
      await db.delete(formDropoffDaily).where(inArray(formDropoffDaily.formId, ids));
      await db.delete(formSettings).where(inArray(formSettings.formId, ids));
    }
    await db.delete(forms).where(eq(forms.workspaceId, workspaceId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  const progress = () =>
    db.select().from(formQuestionProgress).where(eq(formQuestionProgress.formId, formId));

  it("inserts one row per distinct (visitId, questionId) and reports the input count", async () => {
    const result = await recordQuestionProgressBatchImpl({
      items: [
        item({ questionId: "q-1", questionIndex: 0, event: "view" }),
        item({ questionId: "q-2", questionIndex: 1, event: "start" }),
        item({ questionId: "q-3", questionIndex: 2, event: "complete" }),
      ],
    });

    expect(result).toEqual({ ok: true, processed: 3 });
    const rows = await progress();
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.questionId).sort()).toEqual(["q-1", "q-2", "q-3"]);
  });

  it("de-dups a duplicate (visitId, questionId) within one batch without erroring", async () => {
    // Without de-dup this throws: 'ON CONFLICT DO UPDATE command cannot affect row a second time'.
    const result = await recordQuestionProgressBatchImpl({
      items: [item({ event: "view" }), item({ event: "complete", wasLastQuestion: true })],
    });

    expect(result).toEqual({ ok: true, processed: 2 });
    const rows = await progress();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.completedAt).toBeTruthy();
    expect(rows[0]?.startedAt).toBeTruthy();
    expect(rows[0]?.wasLastQuestion).toBe(true);
  });

  it("preserves coalesce/OR semantics when a later batch conflicts with stored rows", async () => {
    // Phase 1: store a started (not completed) row.
    await recordQuestionProgressBatchImpl({
      items: [item({ event: "start", wasLastQuestion: false })],
    });
    const afterStart = await progress();
    const storedStartedAt = afterStart[0]?.startedAt;
    expect(storedStartedAt).toBeTruthy();
    expect(afterStart[0]?.completedAt).toBeNull();

    // Phase 2: a fresh view event (startedAt null on the excluded side) must NOT clobber startedAt;
    // a complete event fills completedAt; wasLastQuestion ORs up to true.
    await recordQuestionProgressBatchImpl({
      items: [item({ event: "complete", wasLastQuestion: true })],
    });

    const rows = await progress();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.startedAt?.getTime()).toBe(storedStartedAt?.getTime());
    expect(rows[0]?.completedAt).toBeTruthy();
    expect(rows[0]?.wasLastQuestion).toBe(true);
  });

  it("returns processed 0 for an empty batch without inserting", async () => {
    const result = await recordQuestionProgressBatchImpl({ items: [] });
    expect(result).toEqual({ ok: true, processed: 0 });
    expect(await progress()).toHaveLength(0);
  });
});
