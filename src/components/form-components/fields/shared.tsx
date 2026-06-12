import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import type { OptionLabelStyle } from "@/components/ui/form-option-item-constants";
import { CheckIcon, ImageIcon } from "@/components/ui/icons";
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

// Small inline asterisk right after the label text (Tally/Typeform style) — not a right-pinned
// badge. The editor keeps its larger toggle button (RequiredBadgeButton); this is preview/live.
const RequiredBadge = () => (
  <Tooltip>
    <TooltipTrigger
      render={
        <span
          aria-label="Required field"
          className="shrink-0 leading-none text-destructive select-none"
        >
          *
        </span>
      }
    />
    <TooltipContent side="right">Required</TooltipContent>
  </Tooltip>
);

// Stable id for label-less variants (h1/h2/h3/blockquote, group fields) to wire aria-labelledby.
export const fieldLabelId = (fieldName: string): string => `${fieldName}-label`;

/** Fisher-Yates copy — memoize at the call site so order stays stable while answering. */
export const shuffleOptions = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

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

// Square checkbox marker for multi-choice when "Labels" = None — presentational twin of the
// interactive <Checkbox> (image-grid tiles are buttons, so a real checkbox would nest interactives).
export const OptionCheckMark = ({
  selected,
  hasErrors,
}: {
  selected: boolean;
  hasErrors?: boolean;
}) => (
  <span
    className={cn(
      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border bg-card",
      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
      hasErrors && !selected && "border-destructive",
    )}
  >
    {selected && <CheckIcon className="size-3" />}
  </span>
);

// Picture-choice grid (Typeform/Tally-style): options as a responsive grid of fixed-aspect,
// cover-cropped image tiles so portrait, landscape, and square uploads all read uniformly. Shared
// by Checkbox (multi) and MultiChoice (single); each field owns its selection + hotkey wiring.
export const ImageOptionGrid = ({
  options,
  multi,
  labelStyle,
  hasErrors,
  isSelected,
  onToggle,
  optionRefs,
  onKeyDown,
}: {
  options: { value: string; label: string; image?: string }[];
  multi: boolean;
  labelStyle: OptionLabelStyle;
  hasErrors: boolean;
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
  optionRefs?: React.RefObject<(HTMLButtonElement | null)[]>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {options.map((option, idx) => {
      const selected = isSelected(option.value);
      return (
        <button
          key={option.value}
          ref={
            optionRefs
              ? (el) => {
                  optionRefs.current[idx] = el;
                }
              : undefined
          }
          type="button"
          onKeyDown={onKeyDown}
          onClick={() => onToggle(option.value)}
          aria-pressed={selected}
          aria-invalid={hasErrors}
          className={cn(
            // Tile pill: 2px border doubles as the selected ring (no layout shift on select).
            "flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 p-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            selected ? "border-primary bg-gray-100" : "border-transparent hover:bg-gray-50",
            hasErrors && "text-destructive",
          )}
        >
          <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
            {option.image ? (
              <img src={option.image} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-6" />
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5 px-0.5">
            {labelStyle === "none" ? (
              multi ? (
                <OptionCheckMark selected={selected} hasErrors={hasErrors} />
              ) : (
                <OptionRadioMark selected={selected} hasErrors={hasErrors} />
              )
            ) : (
              <OptionOrdinalBadge
                text={getOptionOrdinal(labelStyle, idx)}
                selected={selected}
                hasErrors={hasErrors}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
          </span>
        </button>
      );
    })}
  </div>
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
        className="flex w-full items-center gap-1 py-2.5 text-sm select-none"
        data-bf-field-label
      >
        <span>{text}</span>
        {badge}
      </span>
    );
  }

  return (
    <Label htmlFor={htmlFor} id={labelId} className="w-full gap-1" data-bf-field-label>
      <span>{text}</span>
      {badge}
    </Label>
  );
};

// Field types whose control isn't a labelable element (checkbox/single-pick/ranking lists; the
// dropdown display modes keep group semantics — MultiSelect trigger is <div role="button"> due to
// nested remove-tag buttons, see multi-select.tsx). Render as groups: role="group"
// aria-labelledby, not <label htmlFor>.
export const GROUP_FIELD_TYPES = new Set<PlateFormField["fieldType"]>([
  "Checkbox",
  "MultiChoice",
  "Ranking",
  "LinearScale",
  "Matrix",
]);
