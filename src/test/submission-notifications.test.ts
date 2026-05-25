import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordOwnerSubmissionNotification } from "@/lib/server-fn/notifications-helpers.server";
import { formNotificationPreferences, formSubmissionNotifications, forms } from "@/db/schema";
import {
  cleanupTestOrg,
  cleanupTestUser,
  createTestForm,
  createTestOrg,
  createTestWorkspace,
  getTestUtils,
} from "@/test/helpers";

describe("submission notifications", () => {
  const ownerId = crypto.randomUUID();
  let orgId: string;
  let formId: string;

  beforeEach(async () => {
    const testUtils = await getTestUtils();
    await testUtils.saveUser(
      testUtils.createUser({
        id: ownerId,
        email: `owner-notifications-${ownerId}@example.com`,
        name: "Owner Notifications",
      }),
    );

    const org = await createTestOrg(ownerId);
    orgId = org.id;

    const workspace = await createTestWorkspace(orgId, ownerId);
    const form = await createTestForm(workspace.id, ownerId);
    formId = form.id;
  });

  afterEach(async () => {
    await db
      .delete(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, ownerId),
          eq(formSubmissionNotifications.formId, formId),
        ),
      );
    await db
      .delete(formNotificationPreferences)
      .where(
        and(
          eq(formNotificationPreferences.userId, ownerId),
          eq(formNotificationPreferences.formId, formId),
        ),
      );
    await db.delete(forms).where(eq(forms.id, formId));
    await cleanupTestUser(ownerId);
    await cleanupTestOrg(orgId);
  });

  it("creates a grouped unread notification when in-app notifications are enabled", async () => {
    const now = new Date("2026-04-06T10:00:00.000Z");

    await db.insert(formNotificationPreferences).values({
      id: `${ownerId}:${formId}`,
      userId: ownerId,
      formId,
      inAppNotifications: true,
      createdAt: now,
      updatedAt: now,
    });

    await recordOwnerSubmissionNotification({
      formId,
      userId: ownerId,
      submissionId: "submission-1",
      createdAt: now,
    });

    const [notification] = await db
      .select()
      .from(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, ownerId),
          eq(formSubmissionNotifications.formId, formId),
        ),
      );

    expect(notification).toBeDefined();
    expect(notification).toMatchObject({
      userId: ownerId,
      formId,
      unreadCount: 1,
      isRead: false,
      latestSubmissionId: "submission-1",
    });
    expect(notification.firstUnreadAt?.toISOString()).toBe(now.toISOString());
    expect(notification.latestSubmissionAt.toISOString()).toBe(now.toISOString());
  });

  it("increments the unread count without resetting the first unread timestamp", async () => {
    const first = new Date("2026-04-06T10:00:00.000Z");
    const second = new Date("2026-04-06T10:05:00.000Z");

    await db.insert(formNotificationPreferences).values({
      id: `${ownerId}:${formId}`,
      userId: ownerId,
      formId,
      inAppNotifications: true,
      createdAt: first,
      updatedAt: first,
    });

    await recordOwnerSubmissionNotification({
      formId,
      userId: ownerId,
      submissionId: "submission-1",
      createdAt: first,
    });

    await recordOwnerSubmissionNotification({
      formId,
      userId: ownerId,
      submissionId: "submission-2",
      createdAt: second,
    });

    const [notification] = await db
      .select()
      .from(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, ownerId),
          eq(formSubmissionNotifications.formId, formId),
        ),
      );

    expect(notification).toMatchObject({
      unreadCount: 2,
      isRead: false,
      latestSubmissionId: "submission-2",
    });
    expect(notification.firstUnreadAt?.toISOString()).toBe(first.toISOString());
    expect(notification.latestSubmissionAt.toISOString()).toBe(second.toISOString());
  });

  it("does not create notifications when in-app notifications are disabled", async () => {
    await recordOwnerSubmissionNotification({
      formId,
      userId: ownerId,
      submissionId: "submission-1",
      createdAt: new Date("2026-04-06T10:00:00.000Z"),
    });

    const notifications = await db
      .select()
      .from(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, ownerId),
          eq(formSubmissionNotifications.formId, formId),
        ),
      );

    expect(notifications).toHaveLength(0);
  });
});
