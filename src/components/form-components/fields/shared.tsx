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

// Label → WHATWG `autocomplete` token. Order matters: specific before generic ("first name" before "name").
// Tokens: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
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

// Map label/placeholder → autocomplete token for browser/password-manager fill (else `name` is a random id and autofill no-ops).
// No match → "on" (browser heuristics), never "off" — public forms collect personal details, not secrets.
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

// aria-labelledby for heading/blockquote labels (not real <label>). Non-heading: <label htmlFor> already wires it, return undefined to avoid double-wiring.
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

// Stable id for label-less variants (h1/h2/h3/blockquote, group fields) to wire aria-labelledby.
export const fieldLabelId = (fieldName: string): string => `${fieldName}-label`;

// Leading marker for option groups when "Labels" = Letters/Numbers (Figma 25578:9710 / 25578:9688).
export const OptionOrdinalBadge = ({
  text,
  selected,
  hasErrors,
}: {
  text: string;
  selected: boolean;
  hasErrors?: boolean;
}) => (
  <span
    className={cn(
      // Match the editor badge (form-option-item-node): dark gray-900 text @ 12px Medium, flat.
      // Pinned grays (not --form-input-bg, which themed forms remap to white). Selected flips to a
      // white badge on the gray-200 row pill (Figma 25578:9719/9720); default is a gray-100 fill.
      "flex size-4 shrink-0 items-center justify-center rounded-[4px] text-[12px]! leading-none font-medium text-gray-900",
      selected ? "bg-white" : "bg-gray-100",
      hasErrors && !selected && "ring-1 ring-destructive",
    )}
  >
    {text}
  </span>
);

// Radio marker for single-choice when "Labels" = None (Figma 25458:16773).
export const OptionRadioMark = ({
  selected,
  hasErrors,
}: {
  selected: boolean;
  hasErrors?: boolean;
}) => (
  <span
    className={cn(
      "flex size-4 shrink-0 items-center justify-center rounded-full border bg-card",
      selected ? "border-primary" : "border-input",
      hasErrors && !selected && "border-destructive",
    )}
  >
    {selected && <span className="size-2 rounded-full bg-primary" />}
  </span>
);

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
  /** Render label as non-<label> w/ stable id. Group fields (Checkbox/MultiChoice/Ranking) have no single <input id>; role="group" wrapper uses aria-labelledby. */
  asGroupLabel?: boolean;
}) => {
  if (!text) return null;
  const badge = required ? <RequiredBadge /> : null;
  const labelId = fieldLabelId(htmlFor);

  // Heading/blockquote labels are non-<label>, can't use htmlFor. Stable id; input wires aria-labelledby (see RenderStepPreviewInput).
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

  // Group fields have no single labelable input — emit styled <span> w/ stable id, not a <label htmlFor> pointing at nothing.
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

// Field types whose control isn't a labelable element (checkbox/single-pick/ranking lists; MultiSelect trigger is <div role="button"> due to nested remove-tag buttons — see multi-select.tsx). Render as groups: role="group" aria-labelledby, not <label htmlFor>.
export const GROUP_FIELD_TYPES = new Set<PlateFormField["fieldType"]>([
  "Checkbox",
  "MultiChoice",
  "Ranking",
  "MultiSelect",
  "Dropdown",
  "LinearScale",
  "Matrix",
]);
