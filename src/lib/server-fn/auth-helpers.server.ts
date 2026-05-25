import { and, eq, exists, inArray } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import { forms, member, workspaces } from "@/db/schema";
import { db } from "@/db";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Authorize access to a workspace.
 * Checks if the workspace belongs to the user's active organization
 * and the user is a member of that organization.
 */
export const authWorkspace = async (
  workspaceId: string,
  userId: string,
  organizationId: string,
) => {
  const memberSubquery = db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.organizationId, organizationId),
        exists(memberSubquery),
      ),
    )
    .limit(1);

  if (workspace.length === 0) {
    throw createError({
      code: "auth/not-workspace-member" satisfies ErrorCode,
      status: 404,
      message: "Workspace not found or access denied",
      why: "Workspace doesn't exist in this org or user isn't a member",
      fix: "Confirm the workspace ID and that you're a member of its organization",
      internal: { workspaceId, userId, organizationId },
    });
  }
  return { workspace: workspace[0] };
};

/**
 * Authorize access to a form.
 * Checks if the form's workspace belongs to the user's active organization
 * and the user is a member of that organization.
 */
export const authForm = async (formId: string, userId: string, organizationId: string) => {
  const memberSubquery = db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));

  const form = await db
    .select({ id: forms.id, workspaceId: forms.workspaceId })
    .from(forms)
    .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
    .where(
      and(
        eq(forms.id, formId),
        eq(workspaces.organizationId, organizationId),
        exists(memberSubquery),
      ),
    )
    .limit(1);

  if (form.length === 0) {
    throw createError({
      code: "auth/not-form-owner" satisfies ErrorCode,
      status: 404,
      message: "Form not found or access denied",
      why: "Form doesn't exist in this org or user isn't a member of its workspace",
      fix: "Confirm the form ID and that you have access to its workspace",
      internal: { formId, userId, organizationId },
    });
  }
  return { form: form[0] };
};

/**
 * Authorize bulk access to forms. Returns the subset of `formIds` that the
 * user is allowed to operate on (forms whose workspace belongs to the active
 * org). The caller decides whether to error on partial matches or proceed
 * with whatever was authorized — bulk handlers typically want to throw if
 * anything is missing so a single bad id doesn't silently drop affected rows.
 */
export const authFormsBulk = async (formIds: string[], userId: string, organizationId: string) => {
  if (formIds.length === 0) return { formIds: [] as string[] };

  const memberSubquery = db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));

  const allowed = await db
    .select({ id: forms.id })
    .from(forms)
    .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
    .where(
      and(
        inArray(forms.id, formIds),
        eq(workspaces.organizationId, organizationId),
        exists(memberSubquery),
      ),
    );

  if (allowed.length !== formIds.length) {
    throw createError({
      code: "auth/not-form-owner" satisfies ErrorCode,
      status: 404,
      message: "Form not found or access denied",
      why: "One or more form IDs don't belong to this org or user isn't a workspace member",
      fix: "Remove inaccessible IDs from the batch and retry",
      internal: { formIds, userId, organizationId, allowedCount: allowed.length },
    });
  }
  return { formIds: allowed.map((r) => r.id) };
};
