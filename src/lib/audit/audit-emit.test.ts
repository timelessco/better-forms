import { audit, mockAudit } from "evlog";
import { afterEach, expect, it } from "vitest";
import { formDeleted, submissionDeleted, workspaceAccessDenied, workspaceDeleted } from "./actions";

// mockAudit() installs a request-free collector that captures every event going
// through audit() / log.audit(). We drive the standalone audit() (no Nitro scope,
// no DB) with the real action factories — this guards the emit boundary without
// spinning up the server-fn stack or the shared remote DB.
let captured: ReturnType<typeof mockAudit>;

afterEach(() => {
  captured?.restore();
});

it("captures a success audit with the action factory's name + target type", () => {
  captured = mockAudit();
  audit(
    formDeleted({
      actor: { type: "user", id: "usr_1" },
      target: { id: "frm_1", tenantId: "org_1" },
      outcome: "success",
    }),
  );
  expect(captured.events).toHaveLength(1);
  expect(
    captured.toIncludeAuditOf({
      action: "form.deleted",
      outcome: "success",
      target: { type: "form", id: "frm_1" },
    }),
  ).toBe(true);
});

it("captures a denied audit emitted through the deny helper", () => {
  captured = mockAudit();
  audit(
    workspaceAccessDenied({
      actor: { type: "user", id: "usr_2" },
      target: { id: "org_x" },
      outcome: "denied",
      reason: "not a member of org_x",
    }),
  );
  const [event] = captured.events;
  expect(event?.outcome).toBe("denied");
  expect(event?.reason).toBe("not a member of org_x");
  expect(captured.toIncludeAuditOf({ action: "workspace.access", outcome: "denied" })).toBe(true);
});

it("captures a batch destructive op as a single event carrying only ids + count", () => {
  captured = mockAudit();
  audit(
    submissionDeleted({
      actor: { type: "user", id: "usr_3" },
      target: {
        id: "batch:2",
        tenantId: "org_3",
        formId: "frm_3",
        submissionIds: ["sub_a", "sub_b"],
        count: 2,
      },
      outcome: "success",
    }),
  );
  expect(captured.events).toHaveLength(1);
  const [event] = captured.events;
  expect(event?.target?.count).toBe(2);
  expect(event?.target?.submissionIds).toEqual(["sub_a", "sub_b"]);
});

// PII guard: the captured envelope must never carry respondent answers, form
// content, or contact fields. If a call site ever passes such a payload the
// serialized event will contain a forbidden key and this test fails.
const FORBIDDEN_KEYS = [
  "data",
  "answers",
  "payload",
  "submission",
  "content",
  "customization",
  "title",
  "values",
];

it("never leaks PII / content keys into the serialized audit envelope", () => {
  captured = mockAudit();
  audit(
    workspaceDeleted({
      actor: { type: "user", id: "usr_4" },
      target: { id: "org_4", tenantId: "org_4", formCount: 5 },
      outcome: "success",
    }),
  );
  audit(
    submissionDeleted({
      actor: { type: "user", id: "usr_4" },
      target: { id: "sub_1", tenantId: "org_4", formId: "frm_4", count: 1 },
      outcome: "success",
    }),
  );
  const serialized = JSON.stringify(captured.events).toLowerCase();
  for (const key of FORBIDDEN_KEYS) {
    expect(serialized.includes(`"${key}":`)).toBe(false);
  }
});

it("collector stops capturing after restore()", () => {
  const local = mockAudit();
  local.restore();
  audit(
    formDeleted({
      actor: { type: "user", id: "usr_5" },
      target: { id: "frm_5" },
      outcome: "success",
    }),
  );
  expect(local.events).toHaveLength(0);
});
