import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import {
  formNotificationPreferences,
  formSubmissionNotifications,
  forms,
  workspaces,
} from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getActiveOrgId } from "./auth-helpers";
import { authForm } from "./auth-helpers.server";

type NotificationRow = typeof formSubmissionNotifications.$inferSelect;

const serializeSubmissionNotification = (
  row: NotificationRow & {
    formTitle: string;
    workspaceId: string;
    formIcon: string | null;
  },
) => ({
  id: row.id,
  formId: row.formId,
  workspaceId: row.workspaceId,
  formTitle: row.formTitle,
  formIcon: row.formIcon,
  unreadCount: row.unreadCount,
  isRead: row.isRead,
  firstUnreadAt: row.firstUnreadAt?.toISOString() ?? null,
  latestSubmissionAt: row.latestSubmissionAt.toISOString(),
  latestSubmissionId: row.latestSubmissionId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export type SerializedSubmissionNotification = ReturnType<typeof serializeSubmissionNotification>;

export const getSubmissionNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id;
    const orgId = getActiveOrgId(context.session);

    const rows = await db
      .select({
        id: formSubmissionNotifications.id,
        userId: formSubmissionNotifications.userId,
        formId: formSubmissionNotifications.formId,
        unreadCount: formSubmissionNotifications.unreadCount,
        isRead: formSubmissionNotifications.isRead,
        firstUnreadAt: formSubmissionNotifications.firstUnreadAt,
        latestSubmissionAt: formSubmissionNotifications.latestSubmissionAt,
        latestSubmissionId: formSubmissionNotifications.latestSubmissionId,
        createdAt: formSubmissionNotifications.createdAt,
        updatedAt: formSubmissionNotifications.updatedAt,
        formTitle: forms.title,
        workspaceId: forms.workspaceId,
        formIcon: forms.icon,
      })
      .from(formSubmissionNotifications)
      .innerJoin(forms, eq(formSubmissionNotifications.formId, forms.id))
      .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
      .where(
        and(
          eq(formSubmissionNotifications.userId, userId),
          eq(forms.createdByUserId, userId),
          eq(workspaces.organizationId, orgId),
          ne(forms.status, "archived"),
        ),
      )
      .orderBy(
        asc(formSubmissionNotifications.isRead),
        desc(formSubmissionNotifications.latestSubmissionAt),
      );

    return rows.map(serializeSubmissionNotification);
  });

export const getSubmissionNotificationsQueryOptions = () =>
  queryOptions({
    queryKey: ["submission-notifications"] as const,
    queryFn: () => getSubmissionNotifications(),
    staleTime: 10_000,
  });

export const getFormInAppNotificationPreference = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    const userId = context.session.user.id;
    await authForm(data.formId, userId, orgId);

    const [form] = await db
      .select({ createdByUserId: forms.createdByUserId })
      .from(forms)
      .where(eq(forms.id, data.formId))
      .limit(1);

    if (!form) {
      throw new Error("Form not found");
    }

    const isOwner = form.createdByUserId === userId;
    if (!isOwner) {
      return { canManageInAppNotifications: false, inAppNotifications: false };
    }

    const [preference] = await db
      .select({ inAppNotifications: formNotificationPreferences.inAppNotifications })
      .from(formNotificationPreferences)
      .where(
        and(
          eq(formNotificationPreferences.userId, userId),
          eq(formNotificationPreferences.formId, data.formId),
        ),
      )
      .limit(1);

    return {
      canManageInAppNotifications: true,
      inAppNotifications: preference?.inAppNotifications ?? false,
    };
  });

export const getFormInAppNotificationPreferenceQueryOptions = (formId: string) =>
  queryOptions({
    queryKey: ["form-in-app-notification-preference", formId] as const,
    queryFn: () => getFormInAppNotificationPreference({ data: { formId } }),
    staleTime: 60_000,
  });

export const setFormInAppNotificationPreference = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    const userId = context.session.user.id;
    await authForm(data.formId, userId, orgId);

    const [form] = await db
      .select({ createdByUserId: forms.createdByUserId })
      .from(forms)
      .where(eq(forms.id, data.formId))
      .limit(1);

    if (!form) {
      throw new Error("Form not found");
    }

    if (form.createdByUserId !== userId) {
      throw new Error("Only the form owner can manage in-app notifications");
    }

    const now = new Date();
    const id = `${userId}:${data.formId}`;

    await db
      .insert(formNotificationPreferences)
      .values({
        id,
        userId,
        formId: data.formId,
        inAppNotifications: data.enabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: formNotificationPreferences.id,
        set: {
          inAppNotifications: data.enabled,
          updatedAt: now,
        },
      });

    return {
      canManageInAppNotifications: true,
      inAppNotifications: data.enabled,
    };
  });

export const markSubmissionNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    const now = new Date();

    await db
      .update(formSubmissionNotifications)
      .set({
        unreadCount: 0,
        isRead: true,
        firstUnreadAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(formSubmissionNotifications.userId, userId),
          eq(formSubmissionNotifications.formId, data.formId),
        ),
      );

    return { success: true };
  });

export const clearSubmissionNotification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;

    await db
      .delete(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, userId),
          eq(formSubmissionNotifications.formId, data.formId),
          eq(formSubmissionNotifications.isRead, true),
        ),
      );

    return { success: true };
  });

export const clearAllReadSubmissionNotifications = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id;

    await db
      .delete(formSubmissionNotifications)
      .where(
        and(
          eq(formSubmissionNotifications.userId, userId),
          eq(formSubmissionNotifications.isRead, true),
        ),
      );

    return { success: true };
  });
