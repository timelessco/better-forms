import type { Value } from "platejs";
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import { THANK_YOU_STEP } from "./types";
import type { ConditionGroup, LogicBlockNode, Rule, Ruleset } from "./types";

const FIRST_STEP_ID = "step-0";

interface FieldMeta {
  name: string;
  isFieldArray: boolean;
}

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
    const lb = node as unknown as LogicBlockNode;
    rules.push({
      id: lb.id,
      stepId: currentStep,
      when: sanitizeGroup(lb.when ?? { combinator: "all", children: [] }, fields, orphans),
      actions: lb.actions ?? [],
      elseActions: lb.elseActions,
    });
  }

  // Flag orphaned action targets / jump targets (both Do and Else Do branches).
  for (const rule of rules) {
    for (const action of [...rule.actions, ...(rule.elseActions ?? [])]) {
      if (action.kind === "jump") {
        if (action.toStep !== THANK_YOU_STEP && !stepIds.has(action.toStep)) {
          orphans.add(action.toStep);
        }
      } else if (action.kind !== "hideSubmit" && action.kind !== "redirect") {
        if (!fields.has(action.target)) orphans.add(action.target);
      }
    }
  }

  return { rules, orphanedRefs: [...orphans] };
};
