import type { Value } from "platejs";
import * as v from "valibot";
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import { THANK_YOU_STEP } from "./types";
import type { Action, ConditionGroup, Rule, Ruleset } from "./types";

const FIRST_STEP_ID = "step-0";

interface FieldMeta {
  name: string;
  isFieldArray: boolean;
}

// --- Schema: validate persisted logicBlock nodes instead of trusting raw casts. ---
const OperatorSchema = v.picklist([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "greaterThan",
  "lessThan",
  "greaterThanOrEqual",
  "lessThanOrEqual",
  "isEmpty",
  "isNotEmpty",
]);

const ConditionSchema = v.object({
  source: v.string(),
  operator: OperatorSchema,
  value: v.optional(v.string()),
});

const GroupSchema: v.GenericSchema<ConditionGroup> = v.object({
  combinator: v.picklist(["all", "any"]),
  children: v.array(v.lazy(() => v.union([ConditionSchema, GroupSchema]))),
});

const ActionSchema = v.variant("kind", [
  v.object({ kind: v.literal("show"), target: v.string() }),
  v.object({ kind: v.literal("hide"), target: v.string() }),
  v.object({ kind: v.literal("require"), target: v.string() }),
  v.object({ kind: v.literal("optional"), target: v.string() }),
  v.object({
    kind: v.literal("setValue"),
    target: v.string(),
    value: v.union([v.string(), v.array(v.string())]), // string → scalar/single-choice; array → multi-choice
  }),
  v.object({ kind: v.literal("clearValue"), target: v.string() }),
  v.object({ kind: v.literal("jump"), toStep: v.string() }),
  v.object({ kind: v.literal("hideSubmit") }),
  v.object({ kind: v.literal("redirect"), url: v.string() }),
]);

/** Value/required actions corrupt or misbehave on repeatable (array) fields, so they're dropped. */
const ARRAY_INCOMPATIBLE = new Set(["setValue", "clearValue", "require", "optional"]);

const EMPTY_GROUP: ConditionGroup = { combinator: "all", children: [] };

/** Build name → isFieldArray map + step-id set via the canonical preview transform. */
const collectFields = (content: Value): Map<string, FieldMeta> => {
  const map = new Map<string, FieldMeta>();
  const { steps } = transformPlateForPreview(content);
  for (const segments of steps) {
    for (const seg of segments) {
      if (seg.type !== "field") continue;
      const field = seg.field;
      const isFieldArray = (field as { isFieldArray?: boolean }).isFieldArray === true;
      map.set(field.name, { name: field.name, isFieldArray });
    }
  }
  return map;
};

/** Strip orphaned / repeatable-source conditions from a group, recording dropped refs. */
const sanitizeGroup = (
  group: ConditionGroup,
  fields: Map<string, FieldMeta>,
  orphans: Set<string>,
): ConditionGroup => {
  const children: ConditionGroup["children"] = [];
  for (const child of group.children) {
    if ("combinator" in child) {
      children.push(sanitizeGroup(child, fields, orphans));
      continue;
    }
    const cond = child;
    const meta = fields.get(cond.source);
    if (!meta) {
      orphans.add(cond.source);
      continue; // fail closed: drop unknown source
    }
    if (meta.isFieldArray) {
      orphans.add(cond.source); // Wave 1: repeatable not a valid source
      continue;
    }
    children.push(cond);
  }
  return { combinator: group.combinator, children };
};

/** Validate + sanitize a block's action list: drop malformed/legacy actions and field-target
 * actions that don't resolve (unknown field, or array-incompatible on a repeatable). */
const sanitizeActions = (
  rawActions: unknown,
  blockId: string,
  fields: Map<string, FieldMeta>,
  orphans: Set<string>,
): Action[] => {
  const actions: Action[] = [];
  for (const raw of Array.isArray(rawActions) ? rawActions : []) {
    const parsed = v.safeParse(ActionSchema, raw);
    if (!parsed.success) {
      orphans.add(blockId); // malformed or unsupported (e.g. legacy moveToNext)
      continue;
    }
    const action = parsed.output;
    if (action.kind === "jump" || action.kind === "hideSubmit" || action.kind === "redirect") {
      actions.push(action);
      continue;
    }
    const meta = fields.get(action.target);
    if (!meta) {
      orphans.add(action.target);
      continue;
    }
    if (meta.isFieldArray && ARRAY_INCOMPATIBLE.has(action.kind)) {
      orphans.add(action.target);
      continue;
    }
    actions.push(action);
  }
  return actions;
};

export const extractRuleset = (content: Value): Ruleset => {
  const fields = collectFields(content);
  const stepIds = new Set<string>([FIRST_STEP_ID]);
  const orphans = new Set<string>();
  const rules: Rule[] = [];

  let currentStep = FIRST_STEP_ID;
  for (const node of content) {
    const type = (node as { type?: string }).type;
    if (type === "pageBreak") {
      currentStep = (node as { id?: string }).id ?? currentStep;
      stepIds.add(currentStep);
      continue;
    }
    if (type !== "logicBlock") continue;
    const lb = node as { id?: unknown; when?: unknown; actions?: unknown };
    const id = typeof lb.id === "string" ? lb.id : "";

    const whenParsed = v.safeParse(GroupSchema, lb.when);
    if (!whenParsed.success && lb.when !== undefined) orphans.add(id || "logicBlock");
    const when = whenParsed.success ? whenParsed.output : EMPTY_GROUP;

    rules.push({
      id,
      stepId: currentStep,
      when: sanitizeGroup(when, fields, orphans),
      actions: sanitizeActions(lb.actions, id || "logicBlock", fields, orphans),
    });
  }

  // Flag orphaned jump targets (need the full step-id set, so this runs after the pass).
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (action.kind === "jump") {
        if (action.toStep !== THANK_YOU_STEP && !stepIds.has(action.toStep)) {
          orphans.add(action.toStep);
        }
      }
    }
  }

  return { rules, orphanedRefs: [...orphans] };
};
