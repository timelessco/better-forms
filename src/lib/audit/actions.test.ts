import { expect, it } from "vitest";
import {
  formAccessDenied,
  formDeleted,
  formPublished,
  formsArchived,
  formVersionRestored,
  memberRoleAssigned,
  platformAdminAccessDenied,
  subscriptionChanged,
  submissionAccessed,
  submissionDeleted,
  workspaceAccessDenied,
  workspaceDeleted,
} from "./actions";

// Each defineAuditAction returns a factory that curries the fixed action name +
// target type. Locking the (name, target) pair down here means a rename or typo
// in actions.ts breaks a test instead of silently emitting the wrong action.
const ACTION_CONTRACT = [
  { factory: workspaceAccessDenied, action: "workspace.access", target: "workspace" },
  { factory: formAccessDenied, action: "form.access", target: "form" },
  { factory: formDeleted, action: "form.deleted", target: "form" },
  { factory: formPublished, action: "form.published", target: "form" },
  { factory: submissionAccessed, action: "submission.accessed", target: "submission" },
  { factory: submissionDeleted, action: "submission.deleted", target: "submission" },
  { factory: memberRoleAssigned, action: "member.roleAssigned", target: "member" },
  { factory: subscriptionChanged, action: "subscription.changed", target: "subscription" },
  {
    factory: platformAdminAccessDenied,
    action: "platformAdmin.access",
    target: "platformAdmin",
  },
  { factory: formsArchived, action: "form.archived", target: "form" },
  { factory: workspaceDeleted, action: "workspace.deleted", target: "workspace" },
  { factory: formVersionRestored, action: "form.versionRestored", target: "form" },
] as const;

it("each action factory stamps its fixed action name", () => {
  for (const { factory, action } of ACTION_CONTRACT) {
    const built = factory({
      actor: { type: "user", id: "usr_1" },
      target: { id: "res_1" },
    });
    expect(built.action).toBe(action);
  }
});

it("each action factory stamps its fixed target type", () => {
  for (const { factory, target } of ACTION_CONTRACT) {
    const built = factory({
      actor: { type: "user", id: "usr_1" },
      target: { id: "res_1" },
    });
    expect(built.target?.type).toBe(target);
  }
});

it("passes actor, target id, and outcome through untouched", () => {
  const built = formDeleted({
    actor: { type: "user", id: "usr_42", email: "a@b.co" },
    target: { id: "frm_99", tenantId: "org_7" },
    outcome: "success",
  });
  expect(built.actor).toEqual({ type: "user", id: "usr_42", email: "a@b.co" });
  expect(built.target).toEqual({ type: "form", id: "frm_99", tenantId: "org_7" });
  expect(built.outcome).toBe("success");
});

it("preserves a denied outcome + reason for AuthZ-denial actions", () => {
  const built = workspaceAccessDenied({
    actor: { type: "user", id: "usr_5" },
    target: { id: "org_3" },
    outcome: "denied",
    reason: "cross-org access",
  });
  expect(built.action).toBe("workspace.access");
  expect(built.outcome).toBe("denied");
  expect(built.reason).toBe("cross-org access");
});

it("uses a unique action name per factory", () => {
  const names = ACTION_CONTRACT.map(({ action }) => action);
  expect(new Set(names).size).toBe(names.length);
});
