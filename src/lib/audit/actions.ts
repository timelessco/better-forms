// Typed audit-action vocabulary. Centralised so a typo can't become a missing
// alert. `noun.verb`, lowercase, dot-delimited. Each action curries the fixed
// target type via defineAuditAction — call sites only pass actor/target.id/outcome.
import { defineAuditAction } from "evlog";

// AuthZ denial: workspace (organization) access refused.
export const workspaceAccessDenied = defineAuditAction("workspace.access", {
  target: "workspace",
});

// AuthZ denial: form access refused (cross-org / unpublished / unauthorized).
export const formAccessDenied = defineAuditAction("form.access", { target: "form" });

// Mutating: a form was deleted.
export const formDeleted = defineAuditAction("form.deleted", { target: "form" });

// Mutating: a form was published (made publicly reachable).
export const formPublished = defineAuditAction("form.published", { target: "form" });

// Sensitive read: respondent submission payload was accessed.
export const submissionAccessed = defineAuditAction("submission.accessed", {
  target: "submission",
});

// Mutating: a submission was deleted.
export const submissionDeleted = defineAuditAction("submission.deleted", {
  target: "submission",
});

// Mutating: a member's org role was assigned/changed.
export const memberRoleAssigned = defineAuditAction("member.roleAssigned", {
  target: "member",
});

// Mutating: billing subscription/plan changed.
export const subscriptionChanged = defineAuditAction("subscription.changed", {
  target: "subscription",
});

// AuthZ denial: platform-admin surface access refused.
export const platformAdminAccessDenied = defineAuditAction("platformAdmin.access", {
  target: "platformAdmin",
});

// Mutating: forms soft-deleted (moved to trash / archived) in bulk.
export const formsArchived = defineAuditAction("form.archived", { target: "form" });

// Mutating: a workspace was deleted (cascades forms + submissions — mass PII destruction).
export const workspaceDeleted = defineAuditAction("workspace.deleted", {
  target: "workspace",
});

// Mutating: a prior form version's content was restored onto the draft.
export const formVersionRestored = defineAuditAction("form.versionRestored", {
  target: "form",
});
