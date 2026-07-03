import { and, eq, exists, inArray } from "drizzle-orm";
import { createError } from "@/lib/errors/create";
import { forms, member, workspaces } from "@/db/schema";
import { db } from "@/db";
import type { ErrorCode } from "@/lib/errors/codes";
import { getActiveOrgId } from "./auth-helpers";

type SessionWithActiveOrg = Parameters<typeof getActiveOrgId>[0];

/** Authorize workspace access: workspace in user's active org AND user is a member. */
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

/** Authorize form access: form's workspace in user's active org AND user is a member. */
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

/** Bulk form authz: returns the authorized subset of formIds (workspace in active org). Caller
 * decides on partial matches — bulk handlers usually throw if any missing so a bad id doesn't
 * silently drop affected rows. */
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

export const requireScopedWorkspace = async (
  session: SessionWithActiveOrg,
  workspaceId: string,
) => {
  const orgId = getActiveOrgId(session);
  const { workspace } = await authWorkspace(workspaceId, session.user.id, orgId);
  return { orgId, workspace };
};

export const requireScopedForm = async (session: SessionWithActiveOrg, formId: string) => {
  const orgId = getActiveOrgId(session);
  const { form } = await authForm(formId, session.user.id, orgId);
  return { orgId, form };
};

export const requireScopedFormsBulk = async (session: SessionWithActiveOrg, formIds: string[]) => {
  const orgId = getActiveOrgId(session);
  const { formIds: authorizedFormIds } = await authFormsBulk(formIds, session.user.id, orgId);
  return { orgId, formIds: authorizedFormIds };
};
