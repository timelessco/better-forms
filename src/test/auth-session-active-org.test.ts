import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth/auth";
import { cleanupTestUser } from "@/test/helpers";

// Validates the `databaseHooks.session.create.before` hook in
// `src/lib/auth/auth.ts`. When a session is created, the hook must populate
// `session.activeOrganizationId` from the user's first membership. Without
// this, the workspace-creation serverFn throws "No active organization" —
// the original symptom that triggered the orphan-user investigation.

// Better Auth's TestHelpers type doesn't surface `login` to consumers; the
// runtime object has it. Narrow type here so we don't lean on `unknown`.
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
