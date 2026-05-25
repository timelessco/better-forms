import { and, eq, exists, inArray } from "drizzle-orm";
import { forms, member, workspaces } from "@/db/schema";
import { db } from "@/db";

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
    throw new Error("Workspace not found or access denied");
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
    throw new Error("Form not found or access denied");
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
    throw new Error("Form not found or access denied");
  }
  return { formIds: allowed.map((r) => r.id) };
};
