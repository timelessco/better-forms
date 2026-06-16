import { ChevronsUpDown, Zap } from "lucide-react";
import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import {
  PlateElement,
  useEditorRef,
  useEditorVersion,
  useFocused,
  useSelected,
} from "platejs/react";

import {
  ChevronDownIcon,
  ConditionalLogicIcon,
  DeleteIcon,
  DuplicateIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findNextFocusTarget,
  findPrevFocusTarget,
  goToFocusTarget,
  insertParagraphAfterPath,
} from "@/components/editor/plugins/form-blocks-utils";
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import { operatorNeedsOperand, operatorsForFieldType, OPERATOR_LABELS } from "@/lib/logic/labels";
import { THANK_YOU_STEP } from "@/lib/logic/types";
import type {
  Action,
  Condition,
  ConditionGroup,
  LogicBlockNode,
  OperatorId,
} from "@/lib/logic/types";
import { cn } from "@/lib/utils";

export const createLogicBlockNode = (): LogicBlockNode => ({
  type: "logicBlock",
  id: crypto.randomUUID(),
  when: { combinator: "all", children: [] },
  actions: [],
  children: [{ text: "" }],
});

interface Option {
  value: string;
  label: string;
}

interface FieldInfo {
  name: string;
  label: string;
  fieldType: string;
  isFieldArray: boolean;
  /** Defined choices, for choice-type fields (Checkbox/Radio/MultiSelect/Ranking). */
  options?: Option[];
}

const FIRST_STEP_ID = "step-0";

const collectFields = (editor: ReturnType<typeof useEditorRef>): FieldInfo[] => {
  const out: FieldInfo[] = [];
  const { steps } = transformPlateForPreview(editor.children);
  for (const segments of steps) {
    for (const seg of segments) {
      if (seg.type !== "field" || seg.field.fieldType === "Button") continue;
      out.push({
        name: seg.field.name,
        label: seg.field.label ?? seg.field.name,
        fieldType: seg.field.fieldType,
        isFieldArray: (seg.field as { isFieldArray?: boolean }).isFieldArray === true,
        options: (seg.field as { options?: Option[] }).options,
      });
    }
  }
  return out;
};

const collectStepOptions = (editor: ReturnType<typeof useEditorRef>): Option[] => {
  const options: Option[] = [{ value: FIRST_STEP_ID, label: "Step 1" }];
  let stepNumber = 2;
  for (const node of editor.children as Array<Record<string, unknown>>) {
    if (node.type !== "pageBreak") continue;
    if (node.isThankYouPage === true) continue;
    const value = typeof node.id === "string" ? node.id : `${FIRST_STEP_ID}-${stepNumber}`;
    options.push({ value, label: `Step ${stepNumber}` });
    stepNumber++;
  }
  options.push({ value: THANK_YOU_STEP, label: "Thank You page" });
  return options;
};

// ── Token primitives (Figma: white pill, elevation-sm, 8px radius, 32px tall) ──

/** Pill-shaped dropdown built on the shared Select component, sized to its content. */
const TokenSelect = ({
  value,
  onChange,
  ariaLabel,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  options: Option[];
}) => (
  <Select value={value} onValueChange={(next) => onChange(String(next))}>
    <SelectTrigger
      aria-label={ariaLabel}
      size="sm"
      // 28px pill (Figma). `rounded-lg!` overrides the sm variant's tighter radius so corners match the sibling tokens.
      className="gap-1 rounded-lg! border-0 bg-[var(--form-input-bg,var(--color-gray-50))] ps-2.5 pe-2 text-foreground elevation-sm"
    >
      <SelectValue className="font-normal">
        {(selected: string) => options.find((o) => o.value === selected)?.label ?? ""}
      </SelectValue>
    </SelectTrigger>
    {/* drop below the trigger (Figma) — default alignItemWithTrigger overlays/shoves the popup off-anchor */}
    <SelectContent align="start" alignItemWithTrigger={false}>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const TokenInput = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  widthClass = "w-28",
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  widthClass?: string;
  type?: "text" | "date" | "time";
}) => (
  <input
    aria-label={ariaLabel}
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={cn(
      "h-7 rounded-lg border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-2 pl-2.5 text-[13px] text-foreground elevation-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
      widthClass,
    )}
  />
);

/** Allow only a (partial) number: optional leading minus, digits, one decimal point. */
const NUMERIC_PATTERN = /^-?\d*\.?\d*$/;

/** Numeric operand as a − value + stepper (Figma "− 5 +"). Typeable but digits-only,
 * since it only renders for Number-typed fields. */
const TokenStepper = ({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) => {
  const parsed = Number(value);
  const current = Number.isFinite(parsed) ? parsed : 0;
  return (
    <span className="flex h-7 items-center gap-1.5 rounded-lg bg-[var(--form-input-bg,var(--color-gray-50))] px-1.5 elevation-sm">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => onChange(String(current - 1))}
        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <MinusIcon className="size-3.5" />
      </button>
      <input
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        value={value}
        placeholder="0"
        onChange={(e) => {
          // Reject non-numeric input — this control is tied to a Number field.
          if (NUMERIC_PATTERN.test(e.target.value)) onChange(e.target.value);
        }}
        className="w-12 bg-transparent text-center text-[13px] text-foreground tabular-nums outline-none placeholder:text-muted-foreground"
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => onChange(String(current + 1))}
        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </span>
  );
};

/** Scalar field types — single string answer. */
const SCALAR_FIELD_TYPES = new Set([
  "Input",
  "Textarea",
  "Email",
  "Phone",
  "Number",
  "Link",
  "Date",
  "Time",
]);

/** Single-choice (radio / single-select): answer is one option `value` string. */
const SINGLE_CHOICE_TYPES = new Set(["MultiChoice"]);
/** Multi-choice (checkbox / multi-select): answer is a `string[]` of option `value`s. */
const MULTI_CHOICE_TYPES = new Set(["Checkbox"]);

/** Field types a "Set value" action can target (Ranking excluded — setting an order has no clear UX). */
const SET_TARGET_TYPES = new Set([
  ...SCALAR_FIELD_TYPES,
  ...SINGLE_CHOICE_TYPES,
  ...MULTI_CHOICE_TYPES,
]);

/** A field is a valid Set-value target if its type is settable and it isn't repeatable (array rows). */
const isSetTarget = (f: FieldInfo): boolean => SET_TARGET_TYPES.has(f.fieldType) && !f.isFieldArray;

/** The empty value for a target's shape: [] for multi-choice, "" otherwise. */
const blankValueForType = (fieldType: string | undefined): string | string[] =>
  fieldType && MULTI_CHOICE_TYPES.has(fieldType) ? [] : "";

/** Pill multi-select for Checkbox targets — base-ui checkbox items keep the menu open per toggle.
 * Selection is stored option-order so the persisted array reads predictably. */
const MultiTokenSelect = ({
  value,
  onChange,
  ariaLabel,
  options,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  ariaLabel: string;
  options: Option[];
}) => {
  const selected = new Set(value);
  const labels = options.filter((o) => selected.has(o.value)).map((o) => o.label);
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="flex h-7 max-w-48 items-center gap-1 rounded-lg bg-[var(--form-input-bg,var(--color-gray-50))] ps-2.5 pe-2 text-[13px] text-foreground elevation-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className={cn("truncate", labels.length === 0 && "text-muted-foreground")}>
          {labels.length > 0 ? labels.join(", ") : "Select options"}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.has(o.value)}
            onCheckedChange={() => toggle(o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Operand/value control matched to the field type: stepper for numbers, native date/time pickers,
 * an option dropdown for single-choice, a multi-select for multi-choice, plain text otherwise. */
const ValueControl = ({
  fieldType,
  options,
  value,
  onChange,
  ariaLabel,
}: {
  fieldType: string | undefined;
  /** Selectable options when the target is a choice field. */
  options: Option[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  ariaLabel: string;
}) => {
  const str = typeof value === "string" ? value : "";
  if (fieldType === "Number")
    return <TokenStepper value={str} onChange={onChange} ariaLabel={ariaLabel} />;
  if (fieldType === "Date")
    return (
      <TokenInput
        type="date"
        widthClass="w-36"
        value={str}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    );
  if (fieldType === "Time")
    return (
      <TokenInput
        type="time"
        widthClass="w-28"
        value={str}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    );
  if (fieldType && SINGLE_CHOICE_TYPES.has(fieldType))
    return <TokenSelect ariaLabel={ariaLabel} value={str} options={options} onChange={onChange} />;
  if (fieldType && MULTI_CHOICE_TYPES.has(fieldType))
    return (
      <MultiTokenSelect
        ariaLabel={ariaLabel}
        value={Array.isArray(value) ? value : []}
        options={options}
        onChange={onChange}
      />
    );
  return <TokenInput placeholder="value" value={str} onChange={onChange} ariaLabel={ariaLabel} />;
};

const AddToken = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-7 w-fit items-center gap-1 rounded-lg border border-dashed border-border px-2.5 text-[13px] text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
  >
    <PlusIcon className="size-3.5" />
    {label}
  </button>
);

/** Per-row overflow menu (Figma `•••`): row actions live here instead of inline. */
interface RowMenuItem {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  variant?: "default" | "destructive";
}

const RowMenu = ({ items, ariaLabel }: { items: RowMenuItem[]; ariaLabel: string }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={ariaLabel}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MoreHorizontalIcon className="size-[18px]" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[246px]">
      {items.map((item) => (
        <DropdownMenuItem
          key={item.label}
          variant={item.variant}
          className="text-foreground/80"
          onClick={item.onSelect}
        >
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

/** Row wrapper: flex-1 controls on the left, `•••` menu pinned right (Figma). */
const TokenRow = ({ children, menu }: { children: React.ReactNode; menu: React.ReactNode }) => (
  <div className="flex w-full items-start gap-1.5">
    <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
    {menu}
  </div>
);

// Fixed-width lead rail: keeps the When/Then/Else labels, the And/Or toggle, and the condition
// tokens on the same vertical axis across every row and section (Figma).
const LEAD_W = "w-[3.75rem]";

/** One labelled section ("When" / "Then" / "Else"): leading icon+label column,
 * then a vertical stack of token rows. */
const RowShell = ({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex gap-2 px-2 py-1.5">
    <div className={cn(LEAD_W, "flex h-7 shrink-0 items-center gap-2")}>
      {icon}
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
    <div className="flex flex-1 flex-col items-start gap-2">{children}</div>
  </div>
);

/** And/Or toggle for the lead rail of every condition after the first — muted text + a vertical
 * stepper (Figma), aligned under the "When" label. Toggles the group's single combinator. */
const CombinatorLead = ({
  value,
  onChange,
}: {
  value: ConditionGroup["combinator"];
  onChange: (value: string) => void;
}) => (
  <button
    type="button"
    aria-label="Toggle and / or"
    onClick={() => onChange(value === "all" ? "any" : "all")}
    className="flex h-7 items-center gap-0.5 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
  >
    {value === "all" ? "and" : "or"}
    <ChevronsUpDown className="size-3" />
  </button>
);

type CondNode = Condition | ConditionGroup;
const isGroup = (node: CondNode): node is ConditionGroup => "combinator" in node;

/** Flatten a condition tree to its leaf conditions (for validation / warnings). */
const flattenConditions = (group: ConditionGroup): Condition[] =>
  group.children.flatMap((c) => (isGroup(c) ? flattenConditions(c) : [c]));

// Opposite pairs (show/hide, require/optional, set/clear) so the inverse condition drives the
// inverse action — no Else branch needed.
const ACTION_KIND_OPTIONS: Option[] = [
  { value: "show", label: "Show field" },
  { value: "hide", label: "Hide field" },
  { value: "require", label: "Require field" },
  { value: "optional", label: "Make optional" },
  { value: "setValue", label: "Set value" },
  { value: "clearValue", label: "Clear value" },
  { value: "jump", label: "Jump to step" },
  { value: "hideSubmit", label: "Hide submit" },
  { value: "redirect", label: "Redirect to URL" },
];

/** Field-target actions whose target picker is the full field list. */
const FIELD_TARGET_KINDS = new Set<Action["kind"]>([
  "show",
  "hide",
  "require",
  "optional",
  "clearValue",
]);

/** Readable verb per field-target action kind, for the self-referential warning. */
const SELF_REF_VERB: Partial<Record<Action["kind"], string>> = {
  show: "shows",
  hide: "hides",
  require: "requires",
  optional: "makes optional",
  setValue: "sets the value of",
  clearValue: "clears",
};

const defaultActionForKind = (
  kind: Action["kind"],
  fields: FieldInfo[],
  stepOptions: Option[],
): Action => {
  if (kind === "hideSubmit") return { kind };
  if (kind === "jump") return { kind, toStep: stepOptions[0]?.value ?? THANK_YOU_STEP };
  if (kind === "redirect") return { kind, url: "" };
  if (kind === "setValue") {
    const target = fields.find(isSetTarget);
    return { kind, target: target?.name ?? "", value: blankValueForType(target?.fieldType) };
  }
  return { kind, target: fields[0]?.name ?? "" };
};

// ── Immutable edits on the `when` condition tree (root group is path []) ──

/** Apply `fn` to the group at `path` ([] = root). Recurses into nested groups. */
const mapGroupAt = (
  group: ConditionGroup,
  path: number[],
  fn: (g: ConditionGroup) => ConditionGroup,
): ConditionGroup => {
  if (path.length === 0) return fn(group);
  const [head, ...rest] = path;
  return {
    ...group,
    children: group.children.map((child, i) =>
      i === head && isGroup(child) ? mapGroupAt(child, rest, fn) : child,
    ),
  };
};

/** Keep the tree minimal and every level meaningful. Recursively:
 *  - drop empty groups,
 *  - unwrap single-child groups (a group of one is just the condition),
 *  - inline a child group whose combinator equals its parent's — same-combinator nesting is
 *    logically identical to a flat list (all-of-in-all-of ≡ all-of), so it carries no meaning.
 * Result: nesting only persists when combinators differ (a real `A AND (B OR C)` scope). */
const normalizeGroup = (group: ConditionGroup): ConditionGroup => {
  const children: CondNode[] = [];
  for (const child of group.children) {
    if (!isGroup(child)) {
      children.push(child);
      continue;
    }
    const norm = normalizeGroup(child);
    if (norm.children.length === 0)
      continue; // drop empty
    else if (norm.children.length === 1)
      children.push(norm.children[0]); // unwrap singleton
    else if (norm.combinator === group.combinator)
      children.push(...norm.children); // flatten same-combinator
    else children.push(norm);
  }
  return { ...group, children };
};

/** One condition: field · operator · value (stepper for numbers) · `•••` menu. */
const ConditionRow = ({
  condition,
  rowIndex,
  sourceOptions,
  fieldTypeByName,
  fieldChoicesByName,
  onChange,
  menuItems,
}: {
  condition: Condition;
  /** 1-based row position, woven into aria-labels so each control is distinguishable. */
  rowIndex: number;
  sourceOptions: Option[];
  fieldTypeByName: Map<string, string>;
  fieldChoicesByName: Map<string, Option[]>;
  onChange: (next: Condition) => void;
  menuItems: RowMenuItem[];
}) => {
  const operatorOptions = operatorsForFieldType(fieldTypeByName.get(condition.source)).map(
    (op) => ({
      value: op,
      label: OPERATOR_LABELS[op],
    }),
  );
  const choices = fieldChoicesByName.get(condition.source);
  const prefix = `Condition ${rowIndex}`;
  return (
    <TokenRow menu={<RowMenu ariaLabel={`${prefix} options`} items={menuItems} />}>
      <TokenSelect
        ariaLabel={`${prefix} field`}
        value={condition.source}
        options={sourceOptions}
        onChange={(source) => {
          const valid = operatorsForFieldType(fieldTypeByName.get(source));
          const operator = valid.includes(condition.operator) ? condition.operator : valid[0];
          // Reset the operand when the field type changes; seed the first choice for choice fields.
          const nextChoices = fieldChoicesByName.get(source);
          const value = nextChoices?.[0]?.value ?? "";
          onChange({ ...condition, source, operator, value });
        }}
      />
      <TokenSelect
        ariaLabel={`${prefix} operator`}
        value={condition.operator}
        options={operatorOptions}
        onChange={(op) => onChange({ ...condition, operator: op as OperatorId })}
      />
      {operatorNeedsOperand(condition.operator) &&
        (choices && choices.length > 0 ? (
          <TokenSelect
            ariaLabel={`${prefix} value`}
            value={condition.value ?? ""}
            options={choices}
            onChange={(value) => onChange({ ...condition, value })}
          />
        ) : (
          <ValueControl
            ariaLabel={`${prefix} value`}
            fieldType={fieldTypeByName.get(condition.source)}
            options={[]}
            value={condition.value ?? ""}
            onChange={(value) =>
              onChange({ ...condition, value: typeof value === "string" ? value : "" })
            }
          />
        ))}
    </TokenRow>
  );
};

/** One action: kind · target/step/url · `•••` menu. */
const ActionRow = ({
  action,
  rowIndex,
  fields,
  fieldOptions,
  setTargetOptions,
  fieldTypeByName,
  stepOptions,
  onChange,
  menuItems,
}: {
  action: Action;
  /** 1-based row position, woven into aria-labels so each control is distinguishable. */
  rowIndex: number;
  fields: FieldInfo[];
  fieldOptions: Option[];
  /** Scalar-only targets for "Set value" (multi/file/repeatable can't be set). */
  setTargetOptions: Option[];
  fieldTypeByName: Map<string, string>;
  stepOptions: Option[];
  onChange: (next: Action) => void;
  menuItems: RowMenuItem[];
}) => {
  const prefix = `Then action ${rowIndex}`;
  return (
    <TokenRow menu={<RowMenu ariaLabel={`${prefix} options`} items={menuItems} />}>
      <TokenSelect
        ariaLabel={`${prefix} type`}
        value={action.kind}
        options={ACTION_KIND_OPTIONS}
        onChange={(kind) =>
          onChange(defaultActionForKind(kind as Action["kind"], fields, stepOptions))
        }
      />
      {FIELD_TARGET_KINDS.has(action.kind) && "target" in action && (
        <TokenSelect
          ariaLabel={`${prefix} target field`}
          value={action.target}
          options={fieldOptions}
          onChange={(target) => onChange({ ...action, target })}
        />
      )}
      {action.kind === "setValue" && (
        <>
          <TokenSelect
            ariaLabel={`${prefix} target field`}
            value={action.target}
            options={setTargetOptions}
            onChange={(target) =>
              onChange({ ...action, target, value: blankValueForType(fieldTypeByName.get(target)) })
            }
          />
          <ValueControl
            ariaLabel={`${prefix} value`}
            fieldType={fieldTypeByName.get(action.target)}
            options={fields.find((f) => f.name === action.target)?.options ?? []}
            value={action.value}
            onChange={(value) => onChange({ ...action, value })}
          />
        </>
      )}
      {action.kind === "jump" && (
        <TokenSelect
          ariaLabel={`${prefix} target step`}
          value={action.toStep}
          options={stepOptions}
          onChange={(toStep) => onChange({ ...action, toStep })}
        />
      )}
      {action.kind === "redirect" && (
        <TokenInput
          ariaLabel={`${prefix} redirect URL`}
          placeholder="https://…"
          widthClass="w-48"
          value={action.url}
          onChange={(url) => onChange({ ...action, url })}
        />
      )}
    </TokenRow>
  );
};

// Interactive controls inside the block, in DOM (tab) order. Drives Tab cycling within
// the block and lands focus on the first control when the block is navigated into.
const BLOCK_CONTROL_SELECTOR =
  'button, input, select, [role="combobox"], [tabindex]:not([tabindex="-1"])';
const getBlockControls = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(BLOCK_CONTROL_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );

export const LogicBlockElement = (props: PlateElementProps) => {
  const { element, children } = props;
  const editor = useEditorRef();
  const selected = useSelected();
  const focused = useFocused();
  const blockRef = React.useRef<HTMLDivElement>(null);

  // Re-render on editor edits so renamed fields / new steps update pickers.
  useEditorVersion();

  // Navigating into the block (keyboard selection from an adjacent block) lands focus on
  // the first control instead of leaving the whole block ring-selected. Layout effect so
  // the control focuses before paint, avoiding a one-frame flash of the selection ring.
  // Guard on the false→true selection transition only: clicking away to another block
  // transiently blurs+refocuses the editor while this void stays selected, and firing on
  // that churn would snap focus back here (trapping the user and canceling the click's
  // pending selection move). wasSelected resets when selection leaves the block.
  const wasSelected = React.useRef(false);
  React.useLayoutEffect(() => {
    const justEntered = selected && !wasSelected.current;
    wasSelected.current = selected;
    if (!(justEntered && focused)) return;
    const container = blockRef.current;
    if (!container || container.contains(document.activeElement)) return;
    getBlockControls(container)[0]?.focus();
  }, [selected, focused]);

  const when = (element.when as ConditionGroup | undefined) ?? { combinator: "all", children: [] };
  const actions = (element.actions as Action[] | undefined) ?? [];

  const fields = collectFields(editor);
  const sources = fields.filter((f) => !f.isFieldArray); // Wave 1: repeatable can't be a source
  const sourceOptions = sources.map((f) => ({ value: f.name, label: f.label }));
  const fieldOptions = fields.map((f) => ({ value: f.name, label: f.label }));
  const setTargetOptions = fields
    .filter(isSetTarget)
    .map((f) => ({ value: f.name, label: f.label }));
  const stepOptions = collectStepOptions(editor);
  const fieldTypeByName = new Map(fields.map((f) => [f.name, f.fieldType]));
  const fieldChoicesByName = new Map(fields.map((f) => [f.name, f.options ?? []]));

  // Author-time validation: surface dangling references and self-fighting rules instead of
  // letting them silently no-op (or fight themselves) at runtime.
  const knownNames = new Set(fields.map((f) => f.name));
  const conditions = flattenConditions(when);
  const conditionSources = new Set(conditions.map((c) => c.source));
  const warnings: string[] = [];
  for (const c of conditions) {
    if (c.source && !knownNames.has(c.source)) {
      warnings.push("A condition refers to a field that was deleted.");
    } else {
      const choices = fieldChoicesByName.get(c.source);
      if (choices && choices.length > 0 && c.value && !choices.some((o) => o.value === c.value)) {
        warnings.push("A condition uses an option that no longer exists.");
      }
    }
  }
  for (const a of actions) {
    if ("target" in a && a.target && !knownNames.has(a.target)) {
      warnings.push("An action targets a field that was deleted.");
    }
    if ("target" in a && conditionSources.has(a.target) && SELF_REF_VERB[a.kind]) {
      warnings.push(
        `This rule ${SELF_REF_VERB[a.kind]} the same field it checks — it may fight itself.`,
      );
    }
  }
  const uniqueWarnings = [...new Set(warnings)];

  const patch = React.useCallback(
    (updates: Partial<Pick<LogicBlockNode, "when" | "actions">>) => {
      const path = editor.api.findPath(element);
      if (path) editor.tf.setNodes(updates, { at: path });
    },
    [editor, element],
  );

  // Cancel a still-pending deferred caret-focus if the block unmounts first.
  const pendingNavFocus = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(pendingNavFocus.current), []);

  // Tab/Shift+Tab and Up/Down move to adjacent blocks like every other editor block. The inner
  // controls steal DOM focus, so the global NavigationPlugin (which reads the editor
  // selection) never fires for this void node - handle it here where the keydown bubbles
  // up from the focused control. Focus the editor afterwards so the destination's caret
  // (text block) or selection ring (void block) is visible.
  const handleBlockKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      const isTab = event.key === "Tab";
      const isVerticalArrow = event.key === "ArrowDown" || event.key === "ArrowUp";
      if (!isTab && !isVerticalArrow) return;
      // Arrow keys have native meaning inside the block's own controls: date/time/number
      // input segments and opening a Select menu. Leave those to the focused control; only
      // Tab is a deliberate block-level jump regardless of which control holds focus.
      if (
        isVerticalArrow &&
        (event.target as HTMLElement).closest("input, textarea, [role='combobox']")
      ) {
        return;
      }
      // Tab cycles the block's own controls first; only Tab off the last control (or
      // Shift+Tab off the first) escapes to the adjacent editor block.
      if (isTab && blockRef.current) {
        const controls = getBlockControls(blockRef.current);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const atBoundary = event.shiftKey ? index <= 0 : index === controls.length - 1;
        if (index !== -1 && !atBoundary) return; // let the browser move focus within the block
      }
      const path = editor.api.findPath(element);
      if (!path) return;
      event.preventDefault();
      event.stopPropagation();
      const goPrev = event.key === "ArrowUp" || (isTab && event.shiftKey);
      // Focus targets include the page's buttons (editable label) now.
      const target = goPrev
        ? findPrevFocusTarget(editor, path[0])
        : findNextFocusTarget(editor, path[0]);
      if (target) {
        goToFocusTarget(editor, target, goPrev);
        return;
      }
      // No block below (logic block is last before the submit button) - create an
      // empty paragraph after it and drop the caret there so the author isn't stuck.
      if (!goPrev) {
        const at = insertParagraphAfterPath(editor, path);
        // Defer select+focus until the new paragraph has rendered; focusing a node that
        // isn't in the DOM yet no-ops, leaving no visible caret.
        pendingNavFocus.current = setTimeout(() => {
          editor.tf.select({ offset: 0, path: [...at, 0] });
          editor.tf.focus();
        }, 0);
      }
    },
    [editor, element],
  );

  // ── Condition tree edits (operate on `when`, keyed by parent-group path + index) ──
  const freshCondition = (): Condition => {
    const source = sources[0]?.name ?? "";
    return { source, operator: operatorsForFieldType(fieldTypeByName.get(source))[0], value: "" };
  };
  // Every write normalizes the tree (drop empties, unwrap single-child groups), so a
  // redundant group can never linger around a lone condition.
  const setWhen = (next: ConditionGroup) => patch({ when: normalizeGroup(next) });
  const editParent = (parentPath: number[], fn: (children: CondNode[]) => CondNode[]) =>
    setWhen(mapGroupAt(when, parentPath, (g) => ({ ...g, children: fn(g.children) })));

  const updateCondition = (parentPath: number[], index: number, next: Condition) =>
    editParent(parentPath, (kids) => kids.map((c, i) => (i === index ? next : c)));
  const removeNode = (parentPath: number[], index: number) =>
    editParent(parentPath, (kids) => kids.filter((_, i) => i !== index));
  const insertAfter = (parentPath: number[], index: number, node: CondNode) =>
    editParent(parentPath, (kids) => [...kids.slice(0, index + 1), node, ...kids.slice(index + 1)]);
  const setCombinatorAt = (path: number[], combinator: string) =>
    setWhen(
      mapGroupAt(when, path, (g) => ({ ...g, combinator: combinator === "any" ? "any" : "all" })),
    );
  // Append a top-level condition (empty-state "Add condition" affordance).
  const addRootCondition = () =>
    setWhen({ ...when, children: [...when.children, freshCondition()] });

  // Render a condition group as rows aligned on the lead rail (Figma): row 0 carries `lead0` (the
  // section "When" header for the top group), every later row shows the And/Or toggle under it. The
  // combinator lives in the rail — never inline — so it sits on the same axis as the labels.
  const renderConditionGroup = (
    group: ConditionGroup,
    path: number[],
    lead0?: React.ReactNode,
  ): React.ReactNode => (
    <>
      {group.children.map((child, i) => {
        const lead =
          i === 0 ? (
            lead0
          ) : (
            // Spacer matches the icon column so the toggle aligns under the label text, not the icon.
            <>
              <span className="size-4 shrink-0" aria-hidden />
              <CombinatorLead value={group.combinator} onChange={(c) => setCombinatorAt(path, c)} />
            </>
          );
        const railCell = (
          <div className={cn(LEAD_W, "flex h-7 shrink-0 items-center gap-2")}>{lead}</div>
        );
        if (isGroup(child)) {
          return (
            // eslint-disable-next-line @eslint-react/no-array-index-key
            <div key={i} className="flex w-full items-start gap-2">
              {railCell}
              <div className="flex flex-1 flex-col items-start gap-2 border-l-2 border-border/70 pl-2.5">
                {renderConditionGroup(child, [...path, i])}
              </div>
            </div>
          );
        }
        // Hard cap: a section holds at most 2 rows, so adding/duplicating is gated.
        const canAdd = group.children.length < 2;
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <div key={i} className="flex w-full items-start gap-2">
            {railCell}
            <div className="min-w-0 flex-1">
              <ConditionRow
                condition={child}
                rowIndex={i + 1}
                sourceOptions={sourceOptions}
                fieldTypeByName={fieldTypeByName}
                fieldChoicesByName={fieldChoicesByName}
                onChange={(nextCond) => updateCondition(path, i, nextCond)}
                menuItems={[
                  ...(canAdd
                    ? [
                        {
                          icon: <ConditionalLogicIcon />,
                          label: "Add condition",
                          onSelect: () => insertAfter(path, i, freshCondition()),
                        },
                      ]
                    : []),
                  ...(canAdd
                    ? [
                        {
                          icon: <DuplicateIcon />,
                          label: "Duplicate",
                          onSelect: () => insertAfter(path, i, { ...child }),
                        },
                      ]
                    : []),
                  {
                    icon: <DeleteIcon />,
                    label: "Remove",
                    onSelect: () => removeNode(path, i),
                  },
                ]}
              />
            </div>
          </div>
        );
      })}
    </>
  );

  // ── Action lists (Then / Else) — flat, no grouping ──
  const makeActionMenu = (list: Action[], key: "actions", index: number): RowMenuItem[] => {
    const setList = (next: Action[]) => patch({ [key]: next });
    // Hard cap: at most 2 actions per Then/Else, so adding/duplicating is gated.
    const canAdd = list.length < 2;
    return [
      ...(canAdd
        ? [
            {
              icon: <PlusIcon className="size-4" />,
              label: "Add action",
              onSelect: () =>
                setList([
                  ...list.slice(0, index + 1),
                  defaultActionForKind("show", fields, stepOptions),
                  ...list.slice(index + 1),
                ]),
            },
            {
              icon: <DuplicateIcon />,
              label: "Duplicate",
              onSelect: () =>
                setList([
                  ...list.slice(0, index + 1),
                  { ...list[index] },
                  ...list.slice(index + 1),
                ]),
            },
          ]
        : []),
      {
        icon: <DeleteIcon />,
        label: "Remove",
        onSelect: () => setList(list.filter((_, i) => i !== index)),
      },
    ];
  };

  const renderActionRows = (list: Action[], key: "actions") => {
    const setList = (next: Action[]) => patch({ [key]: next });
    if (list.length === 0)
      return (
        <AddToken
          onClick={() => setList([defaultActionForKind("show", fields, stepOptions)])}
          label="Add action"
        />
      );
    return (
      <>
        {list.map((action, i) => (
          <ActionRow
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={i}
            action={action}
            rowIndex={i + 1}
            fields={fields}
            fieldOptions={fieldOptions}
            setTargetOptions={setTargetOptions}
            fieldTypeByName={fieldTypeByName}
            stepOptions={stepOptions}
            onChange={(next) => setList(list.map((a, j) => (j === i ? next : a)))}
            menuItems={makeActionMenu(list, key, i)}
          />
        ))}
        {/* Hard cap: 2 actions max — mirror the When section's inline add affordance. */}
        {list.length < 2 && (
          <AddToken
            onClick={() => setList([...list, defaultActionForKind("show", fields, stepOptions)])}
            label="Add action"
          />
        )}
      </>
    );
  };

  // "When" rail lead (icon + label) — row 0 of the condition list, and the empty/seed states.
  const whenLead = (
    <>
      <ConditionalLogicIcon className="size-4 text-[#0289f7]" />
      <span className="text-[13px] text-muted-foreground">When</span>
    </>
  );
  const whenRail = (
    <div className={cn(LEAD_W, "flex h-7 shrink-0 items-center gap-2")}>{whenLead}</div>
  );

  return (
    // Figma: 12px between the field and its condition block. The field contributes its full
    // --bf-block-margin (28px) and clear-both prevents collapse, so pull up by that amount to
    // leave exactly 12px above (same calc(gap − block-margin) trick as tight option spacing).
    <PlateElement {...props} className="clear-both mt-[calc(12px_-_var(--bf-block-margin))] mb-3">
      <div
        ref={blockRef}
        contentEditable={false}
        role="presentation"
        onKeyDown={handleBlockKeyDown}
        className={cn(
          "flex flex-col gap-0.5 rounded-xl bg-muted/50 p-1.5",
          // Soft selection halo matching form fields (no hard ring-offset border).
          selected && focused && "ring-[3px] ring-ring/50",
        )}
      >
        {uniqueWarnings.length > 0 && (
          <div
            role="alert"
            className="mx-2 mt-1 mb-0.5 flex flex-col gap-0.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[12px] text-amber-700 dark:text-amber-400"
          >
            {uniqueWarnings.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        )}

        {/* WHEN — conditions. Custom rail layout so the And/Or toggle aligns under "When". */}
        <div className="flex flex-col gap-2 px-2 py-1.5">
          {sources.length === 0 ? (
            <div className="flex w-full items-start gap-2">
              {whenRail}
              <span className="flex h-7 items-center text-[13px] text-muted-foreground">
                Add a field to the form first.
              </span>
            </div>
          ) : when.children.length === 0 ? (
            <div className="flex w-full items-start gap-2">
              {whenRail}
              <AddToken onClick={addRootCondition} label="Add condition" />
            </div>
          ) : (
            <>
              {renderConditionGroup(when, [], whenLead)}
              {/* Hard cap: 2 rows max — the add affordance disappears at 2. Empty rail keeps it
                  aligned under the condition tokens. */}
              {when.children.length < 2 && (
                <div className="flex w-full items-start gap-2">
                  <div className={cn(LEAD_W, "shrink-0")} />
                  <AddToken onClick={addRootCondition} label="Add condition" />
                </div>
              )}
            </>
          )}
        </div>

        {/* THEN — actions when conditions pass. No Else: use the inverse action (Hide/Make
            optional/Clear value) with the inverse condition instead. */}
        <RowShell icon={<Zap className="size-4 text-amber-500" />} label="Then">
          {renderActionRows(actions, "actions")}
        </RowShell>
      </div>
      {children}
    </PlateElement>
  );
};
