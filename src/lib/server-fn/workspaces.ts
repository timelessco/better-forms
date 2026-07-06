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
import { createError } from "@/lib/errors/create";
import * as v from "valibot";
import type { ErrorCode } from "@/lib/errors/codes";
import { requireScopedWorkspace } from "./auth-helpers.server";

const workspaceSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  organizationId: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.maxLength(100)),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
});

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    v.object({
      organizationId: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.maxLength(100)), "Workspace"),
      id: v.optional(v.pipe(v.string(), v.uuid())),
      sortIndex: v.optional(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const userId = context.session.user.id;
    const workspaceId = data.id ?? crypto.randomUUID();

    // Insert workspace + per-user sort entry in one transaction so the getWorkspaces refetch
    // always sees the joined sortIndex; else the new workspace briefly sorts to sidebar bottom.
    const [workspace] = await db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({
          id: workspaceId,
          organizationId: data.organizationId,
          createdByUserId: userId,
          name: data.name,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (data.sortIndex) {
        await tx.insert(userWorkspaceOrder).values({
          id: `${userId}:${workspaceId}`,
          userId,
          workspaceId,
          sortIndex: data.sortIndex,
          createdAt: now,
          updatedAt: now,
        });
      }

      return [ws];
    });

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
  .inputValidator(v.partial(v.pick(workspaceSchema, ["id", "name"]), ["name"]))
  .handler(async ({ data, context }) => {
    const { id, ...updateData } = data;
    await requireScopedWorkspace(context.session, id);

    const [workspace] = await db
      .update(workspaces)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();

    if (!workspace) {
      throw createError({
        code: "workspaces/not-found" satisfies ErrorCode,
        status: 404,
        message: "Workspace not found",
        why: "UPDATE matched no workspaces row — deleted mid-request",
        fix: "Refresh — the workspace may have been deleted",
        internal: { workspaceId: id },
      });
    }

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
  .inputValidator(v.pick(workspaceSchema, ["id"]))
  .handler(async ({ data, context }) => {
    const { orgId } = await requireScopedWorkspace(context.session, data.id);

    const [{ total }] = await db
      .select({ total: count() })
      .from(workspaces)
      .where(eq(workspaces.organizationId, orgId));
    if (total <= 1) {
      throw createError({
        code: "workspaces/cannot-delete-last" satisfies ErrorCode,
        status: 422,
        message: "Cannot delete the last workspace. You must have at least one workspace.",
        why: "Deleting the last workspace would leave the org with nowhere to create forms",
        fix: "Create another workspace first, then delete this one",
        internal: { orgId, workspaceId: data.id },
      });
    }

    const result = await db.transaction(async (tx) => {
      // Cascade-delete all forms + dependents; capture ever-published subset to purge CDN tags post-commit.
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

      if (!workspace) {
        throw createError({
          code: "workspaces/not-found" satisfies ErrorCode,
          status: 404,
          message: "Workspace not found",
          why: "DELETE matched no workspaces row — deleted mid-request",
          fix: "Refresh — the workspace may have been deleted",
          internal: { workspaceId: data.id },
        });
      }

      return {
        workspace: {
          ...workspace,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        },
        everPublished,
      };
    });

    // Purge CDN for forms live at the edge; skipped for never-published (no tag to invalidate).
    await purgeFormCacheBatch(result.everPublished);

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
    v.object({
      workspaceId: v.pipe(v.string(), v.uuid()),
      sortIndex: v.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    await requireScopedWorkspace(context.session, data.workspaceId);

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
