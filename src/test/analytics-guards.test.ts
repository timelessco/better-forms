/**
 * Plan 005: anonymous analytics ingestion guards. DB-backed (shared Postgres).
 *  - Published-form gate: recordQuestionProgressImpl writes only for published forms; draft /
 *    archived / missing formIds are silent no-ops (best-effort analytics, never throws).
 *  - Per-IP rate limit: checkAnalyticsRateLimit allows up to the window cap, then blocks.
 * recordFormVisitImpl shares the same gate but needs request-header context, so the gate is
 * exercised here via recordQuestionProgressImpl. The rate limiter is skipped in the impls when
 * there's no request IP (tests), so it's verified directly with an explicit IP.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { analyticsRateLimits, formQuestionProgress, formVisits, forms } from "@/db/schema";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestForm,
  createTestOrg,
  createTestWorkspace,
  getTestUtils,
} from "@/test/helpers";
import {
  checkAnalyticsRateLimit,
  recordQuestionProgressImpl,
} from "@/lib/server-fn/analytics.server";

describe("analytics ingestion guards", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-guards-${ownerId}@example.com`,
        name: "Owner Guards",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    const ws = await createTestWorkspace(orgId, ownerId);
    workspaceId = ws.id;
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
    }
    await db.delete(forms).where(eq(forms.workspaceId, workspaceId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  const progressRows = (formId: string) =>
    db.select().from(formQuestionProgress).where(eq(formQuestionProgress.formId, formId));

  const ingest = (formId: string, visitId: string) =>
    recordQuestionProgressImpl({
      visitId,
      formId,
      visitorHash: "h",
      questionId: "q-1",
      questionType: "Input",
      questionIndex: 0,
      stepId: "s-1",
      stepIndex: 0,
      event: "view",
      wasLastQuestion: false,
    });

  it("records progress for a published form", async () => {
    const form = await createTestForm(workspaceId, ownerId, "published");
    const visitId = crypto.randomUUID();
    await db
      .insert(formVisits)
      .values({ id: visitId, formId: form.id, visitorHash: "h", sessionId: "s" });

    const result = await ingest(form.id, visitId);

    expect(result).toEqual({ ok: true });
    expect(await progressRows(form.id)).toHaveLength(1);
  });

  it("skips progress for a draft form (no write, no throw)", async () => {
    const form = await createTestForm(workspaceId, ownerId, "draft");
    const visitId = crypto.randomUUID();
    await db
      .insert(formVisits)
      .values({ id: visitId, formId: form.id, visitorHash: "h", sessionId: "s" });

    const result = await ingest(form.id, visitId);

    expect(result).toEqual({ ok: true });
    expect(await progressRows(form.id)).toHaveLength(0);
  });

  it("skips progress for a non-existent form (no write, no throw)", async () => {
    const result = await ingest(crypto.randomUUID(), crypto.randomUUID());
    expect(result).toEqual({ ok: true });
  });

  describe("checkAnalyticsRateLimit", () => {
    const ip = `test-${crypto.randomUUID()}`;

    afterEach(async () => {
      await db.delete(analyticsRateLimits).where(eq(analyticsRateLimits.ip, ip));
    });

    it("allows up to the per-window cap (120), then blocks", async () => {
      let allowed = true;
      for (let i = 0; i < 120; i++) {
        allowed = await checkAnalyticsRateLimit(ip);
      }
      expect(allowed).toBe(true); // 120th still under the cap
      expect(await checkAnalyticsRateLimit(ip)).toBe(false); // 121st over

      // A different IP is independent — not affected by the first IP's spend.
      const otherIp = `test-${crypto.randomUUID()}`;
      expect(await checkAnalyticsRateLimit(otherIp)).toBe(true);
      await db.delete(analyticsRateLimits).where(eq(analyticsRateLimits.ip, otherIp));
    });
  });
});
