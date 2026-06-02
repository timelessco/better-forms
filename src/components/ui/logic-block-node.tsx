import { GitBranch, Zap } from "lucide-react";
import * as React from "react";
import type { PlateElementProps } from "platejs/react";
import {
  PlateElement,
  useEditorRef,
  useEditorVersion,
  useFocused,
  useSelected,
} from "platejs/react";

import { MinusIcon, PlusIcon } from "@/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findNextNonButtonPath,
  findPrevNonButtonPath,
  insertParagraphAfterPath,
  moveToPath,
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
  elseActions: [],
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
      className="gap-1 rounded-lg border-0 bg-[var(--form-input-bg,var(--color-gray-50))] ps-2.5 pe-2 text-foreground elevation-sm"
    >
      <SelectValue className="font-normal">
        {(selected: string) => options.find((o) => o.value === selected)?.label ?? ""}
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
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
      "h-8 rounded-lg border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-2 pl-2.5 text-[13px] text-foreground elevation-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
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
    <span className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--form-input-bg,var(--color-gray-50))] px-1.5 elevation-sm">
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

/** Scalar field types — the only ones a "Set value" action can sensibly target. */
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

/** Operand/value control matched to the field type: stepper for numbers, native
 * date/time pickers for Date/Time, plain text otherwise. */
const ValueControl = ({
  fieldType,
  value,
  onChange,
  ariaLabel,
}: {
  fieldType: string | undefined;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) => {
  if (fieldType === "Number")
    return <TokenStepper value={value} onChange={onChange} ariaLabel={ariaLabel} />;
  if (fieldType === "Date")
    return (
      <TokenInput
        type="date"
        widthClass="w-36"
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    );
  if (fieldType === "Time")
    return (
      <TokenInput
        type="time"
        widthClass="w-28"
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    );
  return <TokenInput placeholder="value" value={value} onChange={onChange} ariaLabel={ariaLabel} />;
};

const AddToken = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex h-8 w-fit items-center gap-1 rounded-lg border border-dashed border-border px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
  >
    <PlusIcon className="size-3.5" />
    {label}
  </button>
);

const RemoveToken = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
  >
    <span className="text-base leading-none">×</span>
  </button>
);

/** One labelled section ("If" / "Do" / "Else Do"): leading icon+label column,
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
    <div className="flex h-8 shrink-0 items-center gap-2">
      {icon}
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
    <div className="flex flex-1 flex-col items-start gap-1.5">{children}</div>
  </div>
);

const isCondition = (node: Condition | ConditionGroup): node is Condition =>
  !("combinator" in node);

const ACTION_KIND_OPTIONS: Option[] = [
  { value: "show", label: "Show field" },
  { value: "hide", label: "Hide field" },
  { value: "require", label: "Require field" },
  { value: "setValue", label: "Set value" },
  { value: "jump", label: "Jump to step" },
  { value: "hideSubmit", label: "Hide submit" },
  { value: "redirect", label: "Redirect to URL" },
];

const COMBINATOR_OPTIONS: Option[] = [
  { value: "all", label: "all of" },
  { value: "any", label: "any of" },
];

const defaultActionForKind = (
  kind: Action["kind"],
  fields: FieldInfo[],
  stepOptions: Option[],
): Action => {
  if (kind === "hideSubmit") return { kind };
  if (kind === "jump") return { kind, toStep: stepOptions[0]?.value ?? THANK_YOU_STEP };
  if (kind === "redirect") return { kind, url: "" };
  if (kind === "setValue") {
    const scalar = fields.find((f) => SCALAR_FIELD_TYPES.has(f.fieldType) && !f.isFieldArray);
    return { kind, target: scalar?.name ?? "", value: "" };
  }
  return { kind, target: fields[0]?.name ?? "" };
};

/** One condition: field · operator · value (stepper for numbers). */
const ConditionRow = ({
  condition,
  sourceOptions,
  fieldTypeByName,
  fieldChoicesByName,
  onChange,
  onRemove,
}: {
  condition: Condition;
  sourceOptions: Option[];
  fieldTypeByName: Map<string, string>;
  fieldChoicesByName: Map<string, Option[]>;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) => {
  const operatorOptions = operatorsForFieldType(fieldTypeByName.get(condition.source)).map(
    (op) => ({
      value: op,
      label: OPERATOR_LABELS[op],
    }),
  );
  const choices = fieldChoicesByName.get(condition.source);
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <TokenSelect
        ariaLabel="Field"
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
        ariaLabel="Operator"
        value={condition.operator}
        options={operatorOptions}
        onChange={(op) => onChange({ ...condition, operator: op as OperatorId })}
      />
      {operatorNeedsOperand(condition.operator) &&
        (choices && choices.length > 0 ? (
          <TokenSelect
            ariaLabel="Value"
            value={condition.value ?? ""}
            options={choices}
            onChange={(value) => onChange({ ...condition, value })}
          />
        ) : (
          <ValueControl
            ariaLabel="Value"
            fieldType={fieldTypeByName.get(condition.source)}
            value={condition.value ?? ""}
            onChange={(value) => onChange({ ...condition, value })}
          />
        ))}
      <RemoveToken onClick={onRemove} label="Remove condition" />
    </div>
  );
};

/** One action: kind · target/step/url. */
const ActionRow = ({
  action,
  fields,
  fieldOptions,
  setTargetOptions,
  fieldTypeByName,
  stepOptions,
  onChange,
  onRemove,
}: {
  action: Action;
  fields: FieldInfo[];
  fieldOptions: Option[];
  /** Scalar-only targets for "Set value" (multi/file/repeatable can't be set). */
  setTargetOptions: Option[];
  fieldTypeByName: Map<string, string>;
  stepOptions: Option[];
  onChange: (next: Action) => void;
  onRemove: () => void;
}) => (
  <div className="flex w-full flex-wrap items-center gap-1.5">
    <TokenSelect
      ariaLabel="Action"
      value={action.kind}
      options={ACTION_KIND_OPTIONS}
      onChange={(kind) =>
        onChange(defaultActionForKind(kind as Action["kind"], fields, stepOptions))
      }
    />
    {(action.kind === "show" || action.kind === "hide" || action.kind === "require") && (
      <TokenSelect
        ariaLabel="Target field"
        value={action.target}
        options={fieldOptions}
        onChange={(target) => onChange({ ...action, target })}
      />
    )}
    {action.kind === "setValue" && (
      <>
        <TokenSelect
          ariaLabel="Target field"
          value={action.target}
          options={setTargetOptions}
          onChange={(target) => onChange({ ...action, target })}
        />
        <ValueControl
          ariaLabel="Set value"
          fieldType={fieldTypeByName.get(action.target)}
          value={action.value}
          onChange={(value) => onChange({ ...action, value })}
        />
      </>
    )}
    {action.kind === "jump" && (
      <TokenSelect
        ariaLabel="Target step"
        value={action.toStep}
        options={stepOptions}
        onChange={(toStep) => onChange({ ...action, toStep })}
      />
    )}
    {action.kind === "redirect" && (
      <TokenInput
        ariaLabel="Redirect URL"
        placeholder="https://…"
        widthClass="w-48"
        value={action.url}
        onChange={(url) => onChange({ ...action, url })}
      />
    )}
    <RemoveToken onClick={onRemove} label="Remove action" />
  </div>
);

export const LogicBlockElement = (props: PlateElementProps) => {
  const { element, children } = props;
  const editor = useEditorRef();
  const selected = useSelected();
  const focused = useFocused();

  // Re-render on editor edits so renamed fields / new steps update pickers.
  useEditorVersion();

  const when = (element.when as ConditionGroup | undefined) ?? { combinator: "all", children: [] };
  const actions = (element.actions as Action[] | undefined) ?? [];
  const elseActions = (element.elseActions as Action[] | undefined) ?? [];
  const conditions = when.children;

  const fields = collectFields(editor);
  const sources = fields.filter((f) => !f.isFieldArray); // Wave 1: repeatable can't be a source
  const sourceOptions = sources.map((f) => ({ value: f.name, label: f.label }));
  const fieldOptions = fields.map((f) => ({ value: f.name, label: f.label }));
  const setTargetOptions = fields
    .filter((f) => SCALAR_FIELD_TYPES.has(f.fieldType) && !f.isFieldArray)
    .map((f) => ({ value: f.name, label: f.label }));
  const stepOptions = collectStepOptions(editor);
  const fieldTypeByName = new Map(fields.map((f) => [f.name, f.fieldType]));
  const fieldChoicesByName = new Map(fields.map((f) => [f.name, f.options ?? []]));

  const patch = React.useCallback(
    (updates: Partial<Pick<LogicBlockNode, "when" | "actions" | "elseActions">>) => {
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
      const path = editor.api.findPath(element);
      if (!path) return;
      event.preventDefault();
      event.stopPropagation();
      const goPrev = event.key === "ArrowUp" || (isTab && event.shiftKey);
      const target = goPrev
        ? findPrevNonButtonPath(editor, path)
        : findNextNonButtonPath(editor, path);
      if (target) {
        moveToPath(editor, target);
        editor.tf.focus();
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

  // Conditions
  const updateCondition = (index: number, next: Condition) =>
    patch({ when: { ...when, children: conditions.map((c, i) => (i === index ? next : c)) } });
  const removeCondition = (index: number) =>
    patch({ when: { ...when, children: conditions.filter((_, i) => i !== index) } });
  const addCondition = () => {
    const source = sources[0]?.name ?? "";
    const operator = operatorsForFieldType(fieldTypeByName.get(source))[0];
    patch({ when: { ...when, children: [...conditions, { source, operator, value: "" }] } });
  };
  const setCombinator = (combinator: string) =>
    patch({ when: { ...when, combinator: combinator === "any" ? "any" : "all" } });

  // Actions (Do) + else actions (Else Do) share helpers via a setter.
  const makeActionHandlers = (
    list: Action[],
    key: "actions" | "elseActions",
  ): {
    update: (index: number, next: Action) => void;
    remove: (index: number) => void;
    add: () => void;
  } => ({
    update: (index, next) => patch({ [key]: list.map((a, i) => (i === index ? next : a)) }),
    remove: (index) => patch({ [key]: list.filter((_, i) => i !== index) }),
    add: () => patch({ [key]: [...list, { kind: "show", target: fields[0]?.name ?? "" }] }),
  });
  const doHandlers = makeActionHandlers(actions, "actions");
  const elseHandlers = makeActionHandlers(elseActions, "elseActions");

  const renderActionRows = (list: Action[], handlers: ReturnType<typeof makeActionHandlers>) => (
    <>
      {list.map((action, i) => (
        <ActionRow
          // eslint-disable-next-line @eslint-react/no-array-index-key
          key={i}
          action={action}
          fields={fields}
          fieldOptions={fieldOptions}
          setTargetOptions={setTargetOptions}
          fieldTypeByName={fieldTypeByName}
          stepOptions={stepOptions}
          onChange={(next) => handlers.update(i, next)}
          onRemove={() => handlers.remove(i)}
        />
      ))}
      <AddToken onClick={handlers.add} label="Add action" />
    </>
  );

  return (
    <PlateElement {...props} className="clear-both my-3">
      <div
        contentEditable={false}
        role="presentation"
        onKeyDown={handleBlockKeyDown}
        className={cn(
          "flex flex-col gap-0.5 rounded-xl bg-muted/50 p-1.5",
          // Soft selection halo matching form fields (no hard ring-offset border).
          selected && focused && "ring-[3px] ring-ring/50",
        )}
      >
        {/* IF — conditions */}
        <RowShell icon={<GitBranch className="size-4 text-[#7757ee]" />} label="If">
          {sources.length === 0 ? (
            <span className="flex h-8 items-center text-[13px] text-muted-foreground">
              Add a field to the form first.
            </span>
          ) : (
            <>
              {conditions.length > 1 && (
                <TokenSelect
                  value={when.combinator}
                  onChange={setCombinator}
                  ariaLabel="Match"
                  options={COMBINATOR_OPTIONS}
                />
              )}
              {conditions.map((node, i) =>
                isCondition(node) ? (
                  <ConditionRow
                    // eslint-disable-next-line @eslint-react/no-array-index-key
                    key={i}
                    condition={node}
                    sourceOptions={sourceOptions}
                    fieldTypeByName={fieldTypeByName}
                    fieldChoicesByName={fieldChoicesByName}
                    onChange={(next) => updateCondition(i, next)}
                    onRemove={() => removeCondition(i)}
                  />
                ) : null,
              )}
              <AddToken onClick={addCondition} label="Add condition" />
            </>
          )}
        </RowShell>

        {/* DO — actions when conditions pass */}
        <RowShell icon={<Zap className="size-4 text-[#278f5e]" />} label="Do">
          {renderActionRows(actions, doHandlers)}
        </RowShell>

        {/* ELSE DO — actions when conditions fail */}
        <RowShell icon={<Zap className="size-4 text-muted-foreground" />} label="Else Do">
          {renderActionRows(elseActions, elseHandlers)}
        </RowShell>
      </div>
      {children}
    </PlateElement>
  );
};
