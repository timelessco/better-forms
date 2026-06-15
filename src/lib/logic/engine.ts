import { applyOperator, asString } from "./operators";
import { THANK_YOU_STEP } from "./types";
import type {
  Condition,
  ConditionGroup,
  EngineField,
  EvaluationResult,
  Rule,
  Ruleset,
} from "./types";

const isGroup = (node: Condition | ConditionGroup): node is ConditionGroup => "combinator" in node;

/** A set-value with no content (blank string or empty array) is a no-op — use clearValue to reset. */
const isBlankSetValue = (v: string | string[]): boolean =>
  Array.isArray(v) ? v.length === 0 : v === "";

/** Membership-insensitive equality for set-value latch checks (arrays compared as sets). */
const sameSetValue = (a: unknown, b: string | string[]): boolean => {
  if (Array.isArray(b)) {
    const arr = Array.isArray(a) ? a.map(String) : [];
    if (arr.length !== b.length) return false;
    const set = new Set(arr);
    return b.every((x) => set.has(x));
  }
  return asString(a) === b;
};

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
  // An empty / incomplete group never fires — no vacuous truth for `all`.
  if (group.children.length === 0) return false;
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
    for (const action of rule.actions) {
      if (action.kind === "show") set.add(action.target);
    }
  }
  return set;
};

/** Every field name referenced as a condition source across all rules (recurses groups). */
const collectConditionSources = (rules: Rule[]): Set<string> => {
  const sources = new Set<string>();
  const walk = (node: Condition | ConditionGroup): void => {
    if (isGroup(node)) node.children.forEach(walk);
    else sources.add(node.source);
  };
  for (const rule of rules) walk(rule.when);
  return sources;
};

/** Targets of show/hide actions — the only fields whose masking can shift another rule's outcome. */
const collectHideShowTargets = (rules: Rule[]): Set<string> => {
  const set = new Set<string>();
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (action.kind === "show" || action.kind === "hide") set.add(action.target);
    }
  }
  return set;
};

/** Accumulated effect of every rule whose `when` passes for a given answer snapshot. */
interface Accumulated {
  passingShow: Set<string>;
  passingHide: Set<string>;
  requiredByAction: Set<string>;
  optionalByAction: Set<string>;
  setValues: Record<string, string | string[]>;
  hideSubmit: boolean;
  redirectUrl: string | null;
}

const accumulate = (
  rules: Rule[],
  snapshot: Record<string, unknown>,
  knownNames: Set<string>,
): Accumulated => {
  const acc: Accumulated = {
    passingShow: new Set(),
    passingHide: new Set(),
    requiredByAction: new Set(),
    optionalByAction: new Set(),
    setValues: {},
    hideSubmit: false,
    redirectUrl: null,
  };
  for (const rule of rules) {
    const passes = evalGroup(rule.when, snapshot, knownNames);
    for (const action of rule.actions) {
      if (!passes) {
        // Self-CANCELLING set-value latch: a guard like "set X while X is empty" is falsified the
        // moment the value lands, so a pure pass/fail would drop it — the client then clears it and
        // the rule re-fires forever (flicker). Keep the value while the rest of the guard would
        // still pass with the target emptied AND the target already carries exactly that value (so
        // a respondent's own edit is never latched). Positive self-refs ("set X while X contains Y")
        // pass outright above and never reach here.
        if (
          action.kind === "setValue" &&
          !isBlankSetValue(action.value) &&
          knownNames.has(action.target) &&
          sameSetValue(snapshot[action.target], action.value) &&
          evalGroup(rule.when, { ...snapshot, [action.target]: undefined }, knownNames)
        ) {
          acc.setValues[action.target] = action.value;
        }
        continue;
      }
      // Only known fields are tracked, so orphaned targets never leak stray keys.
      if (action.kind === "show" && knownNames.has(action.target))
        acc.passingShow.add(action.target);
      else if (action.kind === "hide" && knownNames.has(action.target))
        acc.passingHide.add(action.target);
      else if (action.kind === "require" && knownNames.has(action.target))
        acc.requiredByAction.add(action.target);
      else if (action.kind === "optional" && knownNames.has(action.target))
        acc.optionalByAction.add(action.target);
      else if (
        action.kind === "setValue" &&
        knownNames.has(action.target) &&
        !isBlankSetValue(action.value)
      )
        acc.setValues[action.target] = action.value; // blank value is a no-op; document order, last wins
      else if (action.kind === "clearValue" && knownNames.has(action.target))
        acc.setValues[action.target] = ""; // reset to empty
      else if (action.kind === "hideSubmit") acc.hideSubmit = true;
      else if (action.kind === "redirect") acc.redirectUrl = action.url;
    }
  }
  return acc;
};

/** Visibility precedence: hide wins over show; show-targeted fields default hidden, all else visible. */
const computeVisibility = (
  acc: Accumulated,
  fields: ReadonlyArray<EngineField>,
  showTargets: Set<string>,
): Record<string, boolean> => {
  const visibility: Record<string, boolean> = {};
  for (const field of fields) {
    if (acc.passingHide.has(field.name)) visibility[field.name] = false;
    else if (acc.passingShow.has(field.name)) visibility[field.name] = true;
    else visibility[field.name] = !showTargets.has(field.name);
  }
  return visibility;
};

/** A hidden field reads as "no answer" so it can't drive other rules (no ghost conditions). */
const maskHidden = (
  answers: Record<string, unknown>,
  visibility: Record<string, boolean>,
  fields: ReadonlyArray<EngineField>,
): Record<string, unknown> => {
  const masked: Record<string, unknown> = { ...answers };
  for (const field of fields) {
    if (visibility[field.name] === false) masked[field.name] = undefined;
  }
  return masked;
};

const sameVisibility = (a: Record<string, boolean>, b: Record<string, boolean>): boolean => {
  for (const key in a) if (a[key] !== b[key]) return false;
  return true;
};

/** Pure, isomorphic evaluation of a ruleset against current answers. */
export const evaluate = (
  ruleset: Ruleset,
  answers: Record<string, unknown>,
  fields: ReadonlyArray<EngineField>,
): EvaluationResult => {
  const knownNames = new Set(fields.map((f) => f.name));
  const showTargets = collectShowTargets(ruleset.rules);

  // Iterate to a stable visibility: a field hidden by one pass is masked in the next, so its
  // value stops satisfying downstream conditions. Bounded by field count (no infinite loop).
  let snapshot = answers;
  let acc = accumulate(ruleset.rules, snapshot, knownNames);
  let visibility = computeVisibility(acc, fields, showTargets);
  // The loop only matters when a show/hide-toggled field is itself a condition source; otherwise
  // masking can't change any outcome, so a single pass is already exact — skip the re-accumulation.
  const hideShowTargets = collectHideShowTargets(ruleset.rules);
  const conditionSources = collectConditionSources(ruleset.rules);
  const needsConvergence = [...hideShowTargets].some((name) => conditionSources.has(name));
  if (needsConvergence) {
    for (let i = 0; i < fields.length; i++) {
      const nextSnapshot = maskHidden(answers, visibility, fields);
      const nextAcc = accumulate(ruleset.rules, nextSnapshot, knownNames);
      const nextVis = computeVisibility(nextAcc, fields, showTargets);
      snapshot = nextSnapshot;
      acc = nextAcc;
      if (sameVisibility(visibility, nextVis)) {
        visibility = nextVis;
        break;
      }
      visibility = nextVis;
    }
  }

  // Optional wins over require and over the field's base-required flag.
  const effectiveRequired: Record<string, boolean> = {};
  for (const field of fields) {
    const authored = field.required === true;
    effectiveRequired[field.name] =
      visibility[field.name] &&
      (authored || acc.requiredByAction.has(field.name)) &&
      !acc.optionalByAction.has(field.name);
  }

  const resolveJump = (fromStep: string): string | null => {
    for (const rule of ruleset.rules) {
      if (rule.stepId !== fromStep) continue;
      if (!evalGroup(rule.when, snapshot, knownNames)) continue;
      const jump = rule.actions.find((a) => a.kind === "jump");
      if (jump && jump.kind === "jump") return jump.toStep;
    }
    return null;
  };

  return {
    visibility,
    effectiveRequired,
    computedValues: {},
    setValues: acc.setValues,
    hideSubmit: acc.hideSubmit,
    redirectUrl: acc.redirectUrl,
    resolveJump,
  };
};

export { THANK_YOU_STEP };
