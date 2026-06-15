// Field-mention (`@`) token resolution. Pure + framework-free so it unit-tests in isolation
// and runs the same in preview and the published form. See docs/plans/2026-06-15-field-mention-tokens-design.md.

/** Plate node type of an inserted field mention (extends @platejs/mention's `mention`). */
export const MENTION_TYPE = "mention";

/** A resolved label/content fragment: literal text, a live answer, or a faint placeholder. */
export type MentionRun =
  | { kind: "text"; text: string }
  | { kind: "value"; text: string }
  | { kind: "placeholder"; text: string };

export interface ResolveMentionsCtx {
  /** Current answer for a field `name` (from the live merged form values). */
  getValue: (fieldName: string) => unknown;
  /** Display label for a field `name`, looked up fresh so renames stay in sync. */
  getLabel: (fieldName: string) => string | undefined;
}

/** A serializable subset of a Plate label child — narrow enough to cross the RSC server-fn
 * boundary (no `unknown` index signature, unlike platejs `Value`). Carries text, marks, and
 * mention metadata (`type:"mention"` + `key`/`fieldName`/`value`). */
export interface LabelTokenNode {
  text?: string;
  type?: string;
  value?: string;
  fieldName?: string;
  key?: string;
  children?: LabelTokenNode[];
  [prop: string]: string | number | boolean | LabelTokenNode[] | undefined;
}

/** Coerce an answer to display text. Arrays join with ", "; empty/blank → "". `0` stays "0". */
export const formatMentionValue = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .filter((v) => v != null && v !== "")
      .map((v) => String(v))
      .join(", ");
  }
  return String(value);
};

/** True when any child is a mention node — gates the slow structured render path. */
export const hasMention = (nodes: unknown): boolean =>
  Array.isArray(nodes) && nodes.some((n) => (n as LabelTokenNode)?.type === MENTION_TYPE);

/** Walk label/content children → runs, swapping mentions for live answers (or a faint
 * placeholder when unanswered/deleted). */
export const resolveMentions = (
  nodes: ReadonlyArray<LabelTokenNode> | undefined,
  ctx: ResolveMentionsCtx,
): MentionRun[] => {
  const runs: MentionRun[] = [];
  for (const node of nodes ?? []) {
    if (node?.type === MENTION_TYPE) {
      const fieldName = node.fieldName ?? node.key ?? "";
      const text = formatMentionValue(ctx.getValue(fieldName));
      if (text) {
        runs.push({ kind: "value", text });
      } else {
        runs.push({
          kind: "placeholder",
          text: ctx.getLabel(fieldName) ?? node.value ?? fieldName,
        });
      }
    } else if (typeof node?.text === "string") {
      runs.push({ kind: "text", text: node.text });
    }
  }
  return runs;
};

/** Fields preceding `cutoffName` in document order (excludes the field itself and any after).
 * `null` cutoff or an unknown name → every field. */
export const fieldsBefore = <T extends { name: string }>(
  fields: ReadonlyArray<T>,
  cutoffName: string | null,
): T[] => {
  if (!cutoffName) return [...fields];
  const idx = fields.findIndex((f) => f.name === cutoffName);
  return idx === -1 ? [...fields] : fields.slice(0, idx);
};
