/**
 * Option B: analytics writers run unconditionally; the `forms.analytics`
 * toggle gates DISPLAY only. Flipping the toggle on later surfaces
 * historical data instead of starting from zero.
 *
 * This file pins that contract — if anyone re-adds an `isAnalyticsEnabled`
 * guard to the recorders, or removes it from the readers, these tests fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { defaultFormSettings } from "@/types/form-settings";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestForm,
  createTestOrg,
  createTestWorkspace,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

// recordFormVisitImpl reads the active request's headers (user-agent, ip-country)
// via TanStack Start's server-only helper. In a unit test there's no real
// request, so stub the module to return a fixed Headers object.
vi.mock<typeof import("@tanstack/react-start/server")>(
  import("@tanstack/react-start/server"),
  async (importOriginal) => {
    const original = await importOriginal();
    return {
      ...original,
      getRequestHeaders: () =>
        new Headers({
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        }),
    };
  },
);

// Mock-aware imports go after the mock so the recorders pick up the stub.
const { recordFormVisitImpl, recordQuestionProgressImpl, getFormInsightsImpl } =
  await import("@/lib/server-fn/analytics.server");

describe("analytics Option B contract", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let workspaceId: string;

  beforeEach(async () => {
    const utils = await getTestUtils();
    await utils.saveUser(
      utils.createUser({
        id: ownerId,
        email: `owner-opt-b-${ownerId}@example.com`,
        name: "Owner Opt B",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
    await setOrgPlan(orgId, "pro");
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
      await db.delete(formAnalyticsDaily).where(inArray(formAnalyticsDaily.formId, ids));
      await db.delete(formDropoffDaily).where(inArray(formDropoffDaily.formId, ids));
      await db.delete(formSettings).where(inArray(formSettings.formId, ids));
    }
    await db.delete(forms).where(eq(forms.workspaceId, workspaceId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  /** Set up a form whose live analytics setting is the given value. */
  const seedForm = async (analytics: boolean) => {
    const form = await createTestForm(workspaceId, ownerId);
    await db
      .insert(formSettings)
      .values({ formId: form.id, settings: { ...defaultFormSettings, analytics } });
    return form;
  };

  /** Drive one visit through the recorder using a fixed hash per call. */
  const recordVisit = (formId: string, hash: string) =>
    recordFormVisitImpl({
      formId,
      visitorHash: hash,
      sessionId: `s-${hash}`,
      referrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });

  describe("recorders run unconditionally", () => {
    it("records a form visit even when analytics is disabled", async () => {
      const form = await seedForm(false);

      const { visitId } = await recordVisit(form.id, "v-hash-1");

      expect(visitId).toBeTruthy();
      const visits = await db.select().from(formVisits).where(eq(formVisits.formId, form.id));
      expect(visits).toHaveLength(1);
      expect(visits[0]?.visitorHash).toBe("v-hash-1");
    });

    it("records question progress even when analytics is disabled", async () => {
      const form = await seedForm(false);
      const { visitId } = await recordVisit(form.id, "v-hash-2");
      expect(visitId).toBeTruthy();

      await recordQuestionProgressImpl({
        visitId: visitId as string,
        formId: form.id,
        visitorHash: "v-hash-2",
        questionId: "q-1",
        questionType: "Input",
        questionIndex: 0,
        event: "complete",
        wasLastQuestion: false,
      });

      const progress = await db
        .select()
        .from(formQuestionProgress)
        .where(eq(formQuestionProgress.formId, form.id));
      expect(progress).toHaveLength(1);
      expect(progress[0]?.questionId).toBe("q-1");
      expect(progress[0]?.completedAt).toBeTruthy();
    });
  });

  describe("insights reader gates on the toggle", () => {
    it("hides recorded data while analytics is disabled", async () => {
      const form = await seedForm(false);
      // Real visit row in the DB — proves the reader gates on the toggle,
      // not on absence of data.
      await recordVisit(form.id, "v-hidden");

      const metrics = await getFormInsightsImpl(
        { formId: form.id, filter: "last_30_days" },
        { session: { user: { id: ownerId } } },
        orgId,
      );

      expect(metrics.totalVisits).toBe(0);
      expect(metrics.totalSubmissions).toBe(0);
    });

    it("surfaces previously-recorded visits when analytics is later enabled", async () => {
      // Phase 1 — toggle is off, traffic flows in but is hidden from the reader.
      const form = await seedForm(false);
      await recordVisit(form.id, "v-historical");

      // Phase 2 — flip live analytics on (the row that `setFormAnalytics`
      // writes to from the share sidebar / "Enable analytics" button).
      await db
        .update(formSettings)
        .set({ settings: { ...defaultFormSettings, analytics: true } })
        .where(eq(formSettings.formId, form.id));

      const metrics = await getFormInsightsImpl(
        { formId: form.id, filter: "last_30_days" },
        { session: { user: { id: ownerId } } },
        orgId,
      );

      // No backfill job needed — the visit was kept all along.
      expect(metrics.totalVisits).toBe(1);
    });
  });
});
