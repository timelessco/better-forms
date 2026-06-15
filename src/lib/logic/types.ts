/** Conditional-logic data model. Pure types — no runtime, no imports.
 * All field references use the form-state `name` key (see transforms), never raw Plate ids. */

/** Operators available per field type. Wave 1 sources are always scalar. */
export type OperatorId =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"
  | "isEmpty"
  | "isNotEmpty";

/** A single test against one field's current answer. `value` is absent for isEmpty/isNotEmpty. */
export interface Condition {
  /** field `name` being tested */
  source: string;
  operator: OperatorId;
  value?: string;
}

/** AND (`all`) / OR (`any`) over child conditions or nested groups. The engine
 * supports arbitrary nesting (story 5); Wave-1 editor authors flat groups. */
export interface ConditionGroup {
  combinator: "all" | "any";
  children: Array<Condition | ConditionGroup>;
}

/** Actions come in opposite pairs (show/hide, require/optional, setValue/clearValue) so the
 * Else branch is unnecessary — the inverse condition drives the opposite action. */
export type Action =
  | { kind: "show"; target: string } // field name
  | { kind: "hide"; target: string }
  | { kind: "require"; target: string }
  | { kind: "optional"; target: string } // force not-required (wins over require + base-required)
  | { kind: "setValue"; target: string; value: string | string[] } // auto-fill a field (array → multi-choice)
  | { kind: "clearValue"; target: string } // reset a field to empty
  | { kind: "jump"; toStep: string } // step id, or the sentinel THANK_YOU_STEP
  | { kind: "hideSubmit" }
  | { kind: "redirect"; url: string };

export interface Rule {
  /** logicBlock node id */
  id: string;
  /** id of the step that physically contains this logic block — drives jump timing */
  stepId: string;
  when: ConditionGroup;
  /** actions applied when `when` passes */
  actions: Action[];
}

export interface Ruleset {
  rules: Rule[];
  /** referenced names/targets/steps that don't resolve to a real block — editor warns; engine fails closed */
  orphanedRefs: string[];
}

/** Sentinel jump target meaning "finish — go to the Thank You page". */
export const THANK_YOU_STEP = "__thankYou__" as const;

/** Minimal field info the engine needs (decoupled from PlateFormField). */
export interface EngineField {
  name: string;
  required?: boolean;
}

export interface EvaluationResult {
  /** fieldName → visible */
  visibility: Record<string, boolean>;
  /** fieldName → required (always implies visible) */
  effectiveRequired: Record<string, boolean>;
  /** Wave 2 — always {} in Wave 1 */
  computedValues: Record<string, never>;
  /** fieldName → value to write (Set value); "" / [] reset (Clear value). Arrays target multi-choice. */
  setValues: Record<string, string | string[]>;
  hideSubmit: boolean;
  redirectUrl: string | null;
  /** first matching jump rule tied to `fromStep`, else null (caller falls through) */
  resolveJump: (fromStep: string) => string | null;
}

/** A Plate logicBlock node, as persisted in forms.content. */
export interface LogicBlockNode {
  type: "logicBlock";
  id: string;
  when: ConditionGroup;
  actions: Action[];
  children: [{ text: "" }];
}
