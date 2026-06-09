import { applyOperator } from "./operators";
import { THANK_YOU_STEP } from "./types";
import type {
  Action,
  Condition,
  ConditionGroup,
  EngineField,
  EvaluationResult,
  Rule,
  Ruleset,
} from "./types";

const isGroup = (node: Condition | ConditionGroup): node is ConditionGroup => "combinator" in node;

const evalCondition = (
  cond: Condition,
  answers: Record<string, unknown>,
  knownNames: Set<string>,
): boolean => {
  // Fail closed: a condition on an unknown source is false.
  if (!knownNames.has(cond.source)) return false;
  return applyOperator(cond.operator, answers[cond.source], cond.value);
};

const evalGroup = (
  group: ConditionGroup,
  answers: Record<string, unknown>,
  knownNames: Set<string>,
): boolean => {
  const results = group.children.map((child) =>
    isGroup(child)
      ? evalGroup(child, answers, knownNames)
      : evalCondition(child, answers, knownNames),
  );
  if (group.combinator === "all") return results.every(Boolean);
  return results.some(Boolean);
};

const collectShowTargets = (rules: Rule[]): Set<string> => {
  const set = new Set<string>();
  for (const rule of rules) {
    for (const action of [...rule.actions, ...(rule.elseActions ?? [])]) {
      if (action.kind === "show") set.add(action.target);
    }
  }
  return set;
};

/** The action list a rule contributes for the current answers: "Do" when it passes,
 * "Else Do" when it doesn't. */
const activeActions = (
  rule: Rule,
  answers: Record<string, unknown>,
  knownNames: Set<string>,
): Action[] =>
  evalGroup(rule.when, answers, knownNames) ? rule.actions : (rule.elseActions ?? []);

/** Pure, isomorphic evaluation of a ruleset against current answers. */
export const evaluate = (
  ruleset: Ruleset,
  answers: Record<string, unknown>,
  fields: ReadonlyArray<EngineField>,
): EvaluationResult => {
  const knownNames = new Set(fields.map((f) => f.name));
  const showTargets = collectShowTargets(ruleset.rules);

  // Collect which targets a *passing* rule shows/hides/requires. Only known fields
  // are tracked, so orphaned action targets never leak stray keys into the result.
  const passingShow = new Set<string>();
  const passingHide = new Set<string>();
  const requiredByAction = new Set<string>();
  const setValues: Record<string, string> = {};
  let focusField: string | null = null;
  let hideSubmit = false;
  let redirectUrl: string | null = null;

  for (const rule of ruleset.rules) {
    for (const action of activeActions(rule, answers, knownNames)) {
      if (action.kind === "show" && knownNames.has(action.target)) passingShow.add(action.target);
      else if (action.kind === "hide" && knownNames.has(action.target))
        passingHide.add(action.target);
      else if (action.kind === "require" && knownNames.has(action.target))
        requiredByAction.add(action.target);
      else if (action.kind === "setValue" && knownNames.has(action.target))
        setValues[action.target] = action.value; // document order, last wins
      else if (action.kind === "moveToNext" && knownNames.has(action.target))
        focusField = action.target; // document order, last wins
      else if (action.kind === "hideSubmit") hideSubmit = true;
      else if (action.kind === "redirect") redirectUrl = action.url;
    }
  }

  // Visibility precedence: a passing hide always wins over a passing show
  // (deterministic, order-independent, fail-safe — hidden fields are stripped server-side).
  // Default: show-targeted fields start hidden; everything else starts visible.
  const visibility: Record<string, boolean> = {};
  for (const field of fields) {
    if (passingHide.has(field.name)) visibility[field.name] = false;
    else if (passingShow.has(field.name)) visibility[field.name] = true;
    else visibility[field.name] = !showTargets.has(field.name);
  }

  const effectiveRequired: Record<string, boolean> = {};
  for (const field of fields) {
    const authored = field.required === true;
    effectiveRequired[field.name] =
      visibility[field.name] && (authored || requiredByAction.has(field.name));
  }

  const resolveJump = (fromStep: string): string | null => {
    for (const rule of ruleset.rules) {
      if (rule.stepId !== fromStep) continue;
      const jump = activeActions(rule, answers, knownNames).find((a) => a.kind === "jump");
      if (jump && jump.kind === "jump") return jump.toStep;
    }
    return null;
  };

  return {
    visibility,
    effectiveRequired,
    computedValues: {},
    setValues,
    focusField,
    hideSubmit,
    redirectUrl,
    resolveJump,
  };
};

export { THANK_YOU_STEP };
