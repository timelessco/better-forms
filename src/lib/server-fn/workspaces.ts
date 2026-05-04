import {
  formAnalyticsDaily,
  formDropoffDaily,
  formFavorites,
  formQuestionProgress,
  forms,
  formVersions,
  formVisits,
  member,
  submissions,
  userWorkspaceOrder,
  workspaces,
} from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { purgeFormCacheBatch } from "@/lib/server-fn/cdn-cache";
import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getActiveOrgId } from "./auth-helpers";
import { authWorkspace } from "./auth-helpers.server";

const workspaceSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string().max(100),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    workspaceSchema.pick({ organizationId: true, name: true }).extend({
      id: z.uuid().optional(),
      name: workspaceSchema.shape.name.optional().default("Workspace"),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();

    const [workspace] = await db
      .insert(workspaces)
      .values({
        id: data.id ?? crypto.randomUUID(),
        organizationId: data.organizationId,
        createdByUserId: context.session.user.id,
        name: data.name,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return {
      workspace: {
        ...workspace,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
    };
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(workspaceSchema.pick({ id: true, name: true }).partial({ name: true }))
  .handler(async ({ data, context }) => {
    const { id, ...updateData } = data;
    const orgId = getActiveOrgId(context.session);
    await authWorkspace(id, context.session.user.id, orgId);

    const [workspace] = await db
      .update(workspaces)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();

    return {
      workspace: {
        ...workspace,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      },
    };
  });

export const deleteWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(workspaceSchema.pick({ id: true }))
  .handler(async ({ data, context }) => {
    const orgId = getActiveOrgId(context.session);
    await authWorkspace(data.id, context.session.user.id, orgId);

    const [{ total }] = await db
      .select({ total: count() })
      .from(workspaces)
      .where(eq(workspaces.organizationId, orgId));
    if (total <= 1) {
      throw new Error("Cannot delete the last workspace. You must have at least one workspace.");
    }

    const result = await db.transaction(async (tx) => {
      // Cascade-delete all forms and their dependent records. Capture the
      // ever-published subset so we can purge their CDN tags after commit.
      const workspaceForms = await tx
        .select({ id: forms.id, lastPublishedVersionId: forms.lastPublishedVersionId })
        .from(forms)
        .where(eq(forms.workspaceId, data.id));
      const formIds = workspaceForms.map((f) => f.id);
      const everPublished = workspaceForms.filter((f) => f.lastPublishedVersionId).map((f) => f.id);

      if (formIds.length > 0) {
        await Promise.all([
          tx.delete(formAnalyticsDaily).where(inArray(formAnalyticsDaily.formId, formIds)),
          tx.delete(formDropoffDaily).where(inArray(formDropoffDaily.formId, formIds)),
          tx.delete(formQuestionProgress).where(inArray(formQuestionProgress.formId, formIds)),
          tx.delete(formVisits).where(inArray(formVisits.formId, formIds)),
          tx.delete(formFavorites).where(inArray(formFavorites.formId, formIds)),
          tx.delete(submissions).where(inArray(submissions.formId, formIds)),
          tx.delete(formVersions).where(inArray(formVersions.formId, formIds)),
        ]);
        await tx.delete(forms).where(inArray(forms.id, formIds));
      }

      const [workspace] = await tx.delete(workspaces).where(eq(workspaces.id, data.id)).returning();

      return {
        workspace: {
          ...workspace,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        },
        everPublished,
      };
    });

    // Purge CDN cache for any forms that were live at the edge. Skipped for
    // never-published forms (no tag at the edge to invalidate).
    void purgeFormCacheBatch(result.everPublished);

    return { workspace: result.workspace };
  });

export const getWorkspaces = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id;
    const workspaceList = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        organizationId: workspaces.organizationId,
        createdByUserId: workspaces.createdByUserId,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        sortIndex: userWorkspaceOrder.sortIndex,
      })
      .from(workspaces)
      .innerJoin(member, eq(workspaces.organizationId, member.organizationId))
      .leftJoin(
        userWorkspaceOrder,
        and(
          eq(userWorkspaceOrder.workspaceId, workspaces.id),
          eq(userWorkspaceOrder.userId, userId),
        ),
      )
      .where(eq(member.userId, userId))
      .orderBy(workspaces.createdAt);

    return {
      workspaces: workspaceList.map((workspace) => ({
        ...workspace,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      })),
    };
  });

export const reorderWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      workspaceId: z.uuid(),
      sortIndex: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    const orgId = getActiveOrgId(context.session);
    await authWorkspace(data.workspaceId, userId, orgId);

    const id = `${userId}:${data.workspaceId}`;
    const now = new Date();

    await db
      .insert(userWorkspaceOrder)
      .values({
        id,
        userId,
        workspaceId: data.workspaceId,
        sortIndex: data.sortIndex,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userWorkspaceOrder.id,
        set: { sortIndex: data.sortIndex, updatedAt: now },
      });
  });
