import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth/auth";
import { cleanupTestUser } from "@/test/helpers";

// Validates `databaseHooks.session.create.before` (auth.ts): populates `session.activeOrganizationId` from first membership. Without it, workspace-creation throws "No active organization" (orphan-user symptom).

// Better Auth's TestHelpers type omits `login` (runtime has it); narrow here to avoid `unknown`.
type TestHelpersWithLogin = {
  createUser: (overrides?: Record<string, unknown>) => { id: string; [key: string]: unknown };
  saveUser: (user: { id: string; [key: string]: unknown }) => Promise<{ id: string }>;
  login: (args: { userId: string }) => Promise<{
    session: { activeOrganizationId: string | null; userId: string };
  }>;
};

describe("session.create.before sets activeOrganizationId", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupTestUser(id);
    }
    createdUserIds.length = 0;
  });

  it("populates activeOrganizationId from the user's first membership", async () => {
    const ctx = await auth.$context;
    const t = ctx.test as unknown as TestHelpersWithLogin;
    const userId = crypto.randomUUID();
    createdUserIds.push(userId);

    await t.saveUser(
      t.createUser({ id: userId, email: `sess-${userId}@example.com`, name: "Sess" }),
    );

    const [membership] = await db
      .select({ orgId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId));

    const { session } = await t.login({ userId });

    expect(session.activeOrganizationId).toBe(membership.orgId);
  });
});
