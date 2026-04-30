import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOrgPlan } from "@/lib/server-fn/plan-helpers.server";
import { pickThemePromptForPlan } from "@/lib/ai/theme-route-helpers";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestOrg,
  getTestUtils,
  setOrgPlan,
} from "@/test/helpers";

describe("/api/ai/form-generate plan resolution (end-to-end)", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;

  beforeEach(async () => {
    const t = await getTestUtils();
    await t.saveUser(
      t.createUser({
        id: ownerId,
        email: `owner-ai-theme-${ownerId}@example.com`,
        name: "AI Theme Owner",
      }),
    );
    const org = await createTestOrg(ownerId);
    orgId = org.id;
  });

  afterEach(async () => {
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("default-new org → getOrgPlan='free' → route picks the Free tool (limited customization)", async () => {
    const plan = await getOrgPlan(orgId);
    expect(plan).toBe("free");

    const pick = pickThemePromptForPlan(plan);
    expect(pick.toolName).toBe("setFormThemeFree");
    expect(pick.isPro).toBeFalsy();
  });

  it("pro org → getOrgPlan='pro' → route picks the full setFormTheme tool with light:/dark: tokens", async () => {
    await setOrgPlan(orgId, "pro");
    const plan = await getOrgPlan(orgId);
    expect(plan).toBe("pro");

    const pick = pickThemePromptForPlan(plan);
    expect(pick.toolName).toBe("setFormTheme");
    expect(pick.isPro).toBeTruthy();
  });

  it("business org → getOrgPlan='business' → route picks the full setFormTheme tool", async () => {
    await setOrgPlan(orgId, "business");
    const plan = await getOrgPlan(orgId);
    expect(plan).toBe("business");

    const pick = pickThemePromptForPlan(plan);
    expect(pick.toolName).toBe("setFormTheme");
    expect(pick.isPro).toBeTruthy();
  });

  it("downgrade pro → free flips the route back to the limited Free tool", async () => {
    await setOrgPlan(orgId, "pro");
    expect(pickThemePromptForPlan(await getOrgPlan(orgId)).isPro).toBeTruthy();

    await setOrgPlan(orgId, "free");
    const pick = pickThemePromptForPlan(await getOrgPlan(orgId));
    expect(pick.toolName).toBe("setFormThemeFree");
    expect(pick.isPro).toBeFalsy();
  });
});
