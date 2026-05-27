import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiQuotaForPlan, PLAN_QUOTAS } from "@/lib/config/plan-gates";
import {
  checkAiQuota,
  getAiCount,
  incrementAiCount,
  utcDayKey,
} from "@/lib/server-fn/ai-quota.server";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestOrg,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

describe("aiQuotaForPlan (central plan-quotas config)", () => {
  it("free plan: 5 generations / day", () => {
    expect(aiQuotaForPlan("free").aiGenerationsPerDay).toBe(5);
  });

  it("pro plan: unlimited (null)", () => {
    expect(aiQuotaForPlan("pro").aiGenerationsPerDay).toBeNull();
  });

  it("business plan: unlimited (null)", () => {
    expect(aiQuotaForPlan("business").aiGenerationsPerDay).toBeNull();
  });

  it("pLAN_QUOTAS covers every ServerPlan", () => {
    expect(Object.keys(PLAN_QUOTAS).toSorted()).toStrictEqual(
      ["business", "free", "pro"].toSorted(),
    );
  });
});

describe("utcDayKey", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    const key = utcDayKey(new Date("2026-04-30T23:59:59Z"));
    expect(key).toBe("2026-04-30");
  });

  it("rolls over at 00:00 UTC", () => {
    expect(utcDayKey(new Date("2026-05-01T00:00:00Z"))).toBe("2026-05-01");
  });
});

describe("aI quota counter (DB-backed)", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({
        id: ownerId,
        email: `owner-aiquota-${ownerId}@example.com`,
        name: "AI Quota Owner",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("getAiCount returns 0 for a fresh org with no row yet", async () => {
    await expect(getAiCount(orgId)).resolves.toBe(0);
  });

  it("incrementAiCount inserts the first row at count=1", async () => {
    await incrementAiCount(orgId);
    await expect(getAiCount(orgId)).resolves.toBe(1);
  });

  it("incrementAiCount increments the same-day row idempotently", async () => {
    await incrementAiCount(orgId);
    await incrementAiCount(orgId);
    await incrementAiCount(orgId);
    await expect(getAiCount(orgId)).resolves.toBe(3);
  });

  it("counts are per-day: yesterday's bucket doesn't bleed into today", async () => {
    const today = utcDayKey(new Date("2026-04-30T12:00:00Z"));
    const tomorrow = utcDayKey(new Date("2026-05-01T12:00:00Z"));
    await incrementAiCount(orgId, today);
    await incrementAiCount(orgId, today);
    await incrementAiCount(orgId, tomorrow);

    await expect(getAiCount(orgId, today)).resolves.toBe(2);
    await expect(getAiCount(orgId, tomorrow)).resolves.toBe(1);
  });
});

describe("checkAiQuota", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({
        id: ownerId,
        email: `owner-aiquota-check-${ownerId}@example.com`,
        name: "AI Quota Check Owner",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("free plan: under-limit allows", async () => {
    const result = await checkAiQuota(orgId, "free");
    expect(result.allowed).toBeTruthy();
    expect(result.limit).toBe(5);
    expect(result.used).toBe(0);
  });

  it("free plan: at-limit blocks with daily_limit_exceeded", async () => {
    for (let i = 0; i < 5; i++) await incrementAiCount(orgId);
    const result = await checkAiQuota(orgId, "free");
    // Cast the union once so assertions skip a type-narrowing conditional (oxlint forbids those in tests).
    const blocked = result as Extract<typeof result, { allowed: false }>;
    expect(blocked.allowed).toBeFalsy();
    expect(blocked.reason).toBe("daily_limit_exceeded");
    expect(blocked.used).toBe(5);
    expect(blocked.limit).toBe(5);
  });

  it("free plan: one-below-limit still allows (5/day = 5 calls)", async () => {
    for (let i = 0; i < 4; i++) await incrementAiCount(orgId);
    const result = await checkAiQuota(orgId, "free");
    expect(result.allowed).toBeTruthy();
    expect(result.used).toBe(4);
  });

  it("pro plan: never blocks regardless of count", async () => {
    await setOrgPlan(orgId, "pro");
    for (let i = 0; i < 50; i++) await incrementAiCount(orgId);
    const result = await checkAiQuota(orgId, "pro");
    expect(result.allowed).toBeTruthy();
    expect(result.limit).toBeNull();
    expect(result.used).toBe(50);
  });

  it("business plan: never blocks", async () => {
    await setOrgPlan(orgId, "business");
    for (let i = 0; i < 100; i++) await incrementAiCount(orgId);
    const result = await checkAiQuota(orgId, "business");
    expect(result.allowed).toBeTruthy();
    expect(result.limit).toBeNull();
  });

  it("free plan: day boundary resets the budget", async () => {
    const yesterday = utcDayKey(new Date("2026-04-30T12:00:00Z"));
    const today = utcDayKey(new Date("2026-05-01T12:00:00Z"));

    for (let i = 0; i < 5; i++) await incrementAiCount(orgId, yesterday);

    const yesterdayCheck = await checkAiQuota(orgId, "free", yesterday);
    expect(yesterdayCheck.allowed).toBeFalsy();

    const todayCheck = await checkAiQuota(orgId, "free", today);
    expect(todayCheck.allowed).toBeTruthy();
    expect(todayCheck.used).toBe(0);
  });
});
