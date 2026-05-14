import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/db";
import { getTestUtils, cleanupTestUser } from "@/test/helpers";

// Validates the `databaseHooks.user.create.after` hook in
// `src/lib/auth/auth.ts`. When a new user is created, the hook must
// auto-provision their starting state: one organization, an owner membership,
// and one default workspace. This is the gate that prevented the orphan-user
// bug we backfilled.

describe("auto-provision on user creation", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupTestUser(id);
    }
    createdUserIds.length = 0;
  });

  it("creates an organization for a newly-saved user", async () => {
    const t = await getTestUtils();
    const userId = crypto.randomUUID();
    createdUserIds.push(userId);

    await t.saveUser(
      t.createUser({ id: userId, email: `auto-${userId}@example.com`, name: "Auto" }),
    );

    const memberships = await db
      .select({ orgId: schema.member.organizationId, role: schema.member.role })
      .from(schema.member)
      .where(eq(schema.member.userId, userId));

    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe("owner");
  });

  it("creates a default workspace inside the user's organization", async () => {
    const t = await getTestUtils();
    const userId = crypto.randomUUID();
    createdUserIds.push(userId);

    await t.saveUser(
      t.createUser({ id: userId, email: `auto-${userId}@example.com`, name: "Auto" }),
    );

    const [membership] = await db
      .select({ orgId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId));

    const workspaces = await db
      .select({ id: schema.workspaces.id, name: schema.workspaces.name })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.organizationId, membership.orgId));

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe("My workspace");
  });
});
