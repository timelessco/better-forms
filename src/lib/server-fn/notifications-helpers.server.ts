import { and, eq, sql } from "drizzle-orm";
import { formNotificationPreferences, formSubmissionNotifications } from "@/db/schema";
import { db } from "@/db";

export const recordOwnerSubmissionNotification = async ({
  formId,
  userId,
  submissionId,
  createdAt,
}: {
  formId: string;
  userId: string;
  submissionId: string;
  createdAt: Date;
}) => {
  const [preference] = await db
    .select({ inAppNotifications: formNotificationPreferences.inAppNotifications })
    .from(formNotificationPreferences)
    .where(
      and(
        eq(formNotificationPreferences.userId, userId),
        eq(formNotificationPreferences.formId, formId),
      ),
    )
    .limit(1);

  if (!preference?.inAppNotifications) {
    return { notified: false };
  }

  const id = `${userId}:${formId}`;
  // postgres-js (unlike node-postgres) doesn't auto-serialize Date when it
  // appears as a raw parameter inside a `sql\`...\`` template — drizzle's
  // column-aware mapping is what converts Date → ISO on regular `.values()`,
  // but the CASE branch below bypasses that path. Bind an ISO string
  // explicitly.
  const createdAtIso = createdAt.toISOString();

  await db
    .insert(formSubmissionNotifications)
    .values({
      id,
      userId,
      formId,
      unreadCount: 1,
      isRead: false,
      firstUnreadAt: createdAt,
      latestSubmissionAt: createdAt,
      latestSubmissionId: submissionId,
      createdAt,
      updatedAt: createdAt,
    })
    .onConflictDoUpdate({
      target: formSubmissionNotifications.id,
      set: {
        unreadCount: sql`${formSubmissionNotifications.unreadCount} + 1`,
        isRead: false,
        firstUnreadAt: sql`CASE
          WHEN ${formSubmissionNotifications.isRead} = true OR ${formSubmissionNotifications.firstUnreadAt} IS NULL
            THEN ${createdAtIso}
          ELSE ${formSubmissionNotifications.firstUnreadAt}
        END`,
        latestSubmissionAt: createdAt,
        latestSubmissionId: submissionId,
        updatedAt: createdAt,
      },
    });

  return { notified: true };
};
