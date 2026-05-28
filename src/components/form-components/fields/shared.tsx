import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppForm } from "@/hooks/use-form-builder";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { cn } from "@/lib/utils";

export type FieldType = Exclude<PlateFormField["fieldType"], "Button">;

export type FieldRendererProps<
  T extends PlateFormField["fieldType"] = PlateFormField["fieldType"],
> = {
  element: Extract<PlateFormField, { fieldType: T }>;
  form: AppForm;
  /** When rendered as one item of a repeatable field, the indexed binding name
   * (e.g. "emails[0]"). Falls back to `element.name` for standalone fields. */
  name?: string;
};

export const getFieldLabelProps = (element: PlateFormField) => ({
  label: "label" in element ? (element.label ?? "") : "",
  required: "required" in element ? !!element.required : false,
  labelType: "labelType" in element ? element.labelType : undefined,
});

export const getAriaLabelFallback = (element: PlateFormField): string | undefined => {
  const label = "label" in element ? element.label : undefined;
  if (label) return undefined;
  const placeholder = "placeholder" in element ? element.placeholder : undefined;
  return placeholder ?? "Field";
};

// Label → WHATWG `autocomplete` token map. Match order matters — list more
// specific patterns first (e.g. "first name" before bare "name") so they
// win when both could match. Tokens come from
// https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
const AUTOCOMPLETE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/first\s*name|given\s*name/i, "given-name"],
  [/(last|family|sur)\s*name/i, "family-name"],
  [/middle\s*name/i, "additional-name"],
  [/full\s*name|^\s*name\s*$/i, "name"],
  [/nick\s*name|user\s*name|handle/i, "nickname"],
  [/e[-\s]?mail/i, "email"],
  [/(phone|mobile|cell|tel)(\s*number)?/i, "tel"],
  [/organization|company|business|employer/i, "organization"],
  [/job\s*title|position|role/i, "organization-title"],
  [/street\s*address|address\s*line\s*1|^\s*address\s*$/i, "street-address"],
  [/address\s*line\s*2|apt|suite|unit/i, "address-line2"],
  [/city|town|locality/i, "address-level2"],
  [/state|province|region/i, "address-level1"],
  [/(zip|postal|post)\s*code|post\s*code/i, "postal-code"],
  [/country/i, "country-name"],
  [/birth(\s*day|\s*date|day)|date\s*of\s*birth|dob/i, "bday"],
  [/website|^\s*url\s*$|^\s*link\s*$/i, "url"],
] as const;

/**
 * Maps the field's label/placeholder text to a WHATWG `autocomplete` token
 * so browsers and password managers can fill it. Without this most fields
 * fall back to the generic `name` attribute (which is a random short id
 * here) and autofill silently no-ops.
 *
 * Falls back to "on" (i.e. let the browser try its own heuristics) when no
 * pattern matches — never returns "off", since the public-form pattern is
 * "respondent fills personal details," not "auth/secret entry".
 */
export const guessAutocomplete = (element: PlateFormField): string => {
  const text = (("label" in element && element.label) ||
    ("placeholder" in element && element.placeholder) ||
    "") as string;
  if (!text) return "on";
  for (const [pattern, token] of AUTOCOMPLETE_PATTERNS) {
    if (pattern.test(text)) return token;
  }
  return "on";
};

/** Returns `aria-labelledby={fieldLabelId(name)}` when the field has a label
 * rendered as a heading/blockquote (not a real `<label>`). For non-heading
 * labels, the standard `<label htmlFor>` already does the association so we
 * return undefined to avoid double-wiring. */
export const getAriaLabelledBy = (element: PlateFormField): string | undefined => {
  const labelType = "labelType" in element ? element.labelType : undefined;
  const label = "label" in element ? element.label : undefined;
  if (!label) return undefined;
  if (
    labelType === "h1" ||
    labelType === "h2" ||
    labelType === "h3" ||
    labelType === "blockquote"
  ) {
    return fieldLabelId(element.name);
  }
  return undefined;
};

const RequiredBadge = () => (
  <Tooltip>
    <TooltipTrigger
      render={
        <span
          aria-label="Required field"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[8px] bg-destructive/15 text-destructive",
            "mr-1 ml-auto",
          )}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Required</title>
            <path
              d="M12.39 5.69L12.79 6.93L9.02 8.22L11.47 11.53L10.42 12.34L7.95 8.92L5.58 12.31L4.53 11.5L6.9 8.22L3.16 6.95L3.59 5.69L7.28 7.01V3.02H8.65V6.98L12.39 5.69Z"
              fill="currentColor"
            />
          </svg>
        </span>
      }
    />
    <TooltipContent side="right">Required</TooltipContent>
  </Tooltip>
);

/** Stable id for label-less render variants (h1/h2/h3/blockquote and group
 * fields) so the input can wire `aria-labelledby` to it. */
export const fieldLabelId = (fieldName: string): string => `${fieldName}-label`;

export const FieldLabelText = ({
  text,
  labelType,
  htmlFor,
  required,
  asGroupLabel = false,
}: {
  text: string;
  labelType?: string;
  htmlFor: string;
  required?: boolean;
  /** When true, render the label as a non-<label> element with a stable id,
   * since group fields (Checkbox/MultiChoice/Ranking) have no single
   * `<input id>` to bind to — the surrounding `role="group"` wrapper uses
   * `aria-labelledby` instead. */
  asGroupLabel?: boolean;
}) => {
  if (!text) return null;
  const badge = required ? <RequiredBadge /> : null;
  const labelId = fieldLabelId(htmlFor);

  // Heading / blockquote label variants are non-<label> elements, so they
  // can't use `htmlFor`. We give them a stable id and the input control wires
  // `aria-labelledby={fieldLabelId(name)}` to it (see RenderStepPreviewInput).
  if (labelType === "h1") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h1 id={labelId} className="font-heading flex-1 text-4xl font-semibold">
          {text}
        </h1>
        {badge}
      </div>
    );
  }
  if (labelType === "h2") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h2 id={labelId} className="font-heading flex-1 text-2xl font-semibold">
          {text}
        </h2>
        {badge}
      </div>
    );
  }
  if (labelType === "h3") {
    return (
      <div className="flex w-full items-center py-2.5">
        <h3 id={labelId} className="font-heading flex-1 text-xl font-semibold">
          {text}
        </h3>
        {badge}
      </div>
    );
  }
  if (labelType === "blockquote") {
    return (
      <div className="flex w-full items-center py-2.5">
        <blockquote id={labelId} className="flex-1 border-l-2 pl-6 italic">
          {text}
        </blockquote>
        {badge}
      </div>
    );
  }

  // Group fields don't have a single labelable input — emit a <span> (with the
  // stable id) styled like the label, rather than a <label htmlFor> that would
  // point at nothing.
  if (asGroupLabel) {
    return (
      <span
        id={labelId}
        className="flex w-full items-center gap-2 py-2.5 text-sm select-none"
        data-bf-field-label
      >
        <span className="flex-1">{text}</span>
        {badge}
      </span>
    );
  }

  return (
    <Label htmlFor={htmlFor} id={labelId} className="w-full" data-bf-field-label>
      <span className="flex-1">{text}</span>
      {badge}
    </Label>
  );
};

/** Field types whose visible control is NOT a labelable HTML element
 * (multi-checkbox + single-pick + ranking lists, plus MultiSelect whose
 * outer trigger is a `<div role="button">` due to nested remove-tag buttons
 * — see comment at top of multi-select.tsx). They render as groups, so the
 * surrounding shell uses `role="group" aria-labelledby` rather than
 * `<label htmlFor>`. */
export const GROUP_FIELD_TYPES = new Set<PlateFormField["fieldType"]>([
  "Checkbox",
  "MultiChoice",
  "Ranking",
  "MultiSelect",
]);
