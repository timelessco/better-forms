import { describe, it, expect, afterEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRequestRateLimits } from "@/db/schema";
import {
  checkAiRequestRateLimit,
  MAX_PER_WINDOW,
  WINDOW_MINUTES,
} from "@/lib/server-fn/ai-request-rate-limit.server";

// Table has no FK; keyed by an arbitrary text orgId. Use unique ids per test for isolation.
describe("checkAiRequestRateLimit (per-org short-window burst limit)", () => {
  const orgIds: string[] = [];
  const newOrgId = () => {
    const id = `rl-test-${crypto.randomUUID()}`;
    orgIds.push(id);
    return id;
  };

  afterEach(async () => {
    for (const id of orgIds.splice(0)) {
      await db.delete(aiRequestRateLimits).where(eq(aiRequestRateLimits.orgId, id));
    }
  });

  it("allows calls up to the limit within the window", async () => {
    const orgId = newOrgId();
    for (let i = 1; i <= MAX_PER_WINDOW; i++) {
      const res = await checkAiRequestRateLimit(orgId);
      expect(res.allowed).toBe(true);
      expect(res.count).toBe(i);
    }
  });

  it("rejects the (MAX+1)th call within the window", async () => {
    const orgId = newOrgId();
    // Seed the row at exactly the limit, fresh window.
    await db.insert(aiRequestRateLimits).values({ orgId, count: MAX_PER_WINDOW });

    const res = await checkAiRequestRateLimit(orgId);
    expect(res.count).toBe(MAX_PER_WINDOW + 1);
    expect(res.allowed).toBe(false);
    expect(res.limit).toBe(MAX_PER_WINDOW);
  });

  it("resets the counter once the window has elapsed", async () => {
    const orgId = newOrgId();
    // Row at the limit but with a windowStart older than the window → next call resets to 1.
    await db.insert(aiRequestRateLimits).values({
      orgId,
      count: MAX_PER_WINDOW + 5,
      windowStart: sql`now() - interval '${sql.raw(String(WINDOW_MINUTES + 1))} minutes'`,
    });

    const res = await checkAiRequestRateLimit(orgId);
    expect(res.allowed).toBe(true);
    expect(res.count).toBe(1);
  });
});
