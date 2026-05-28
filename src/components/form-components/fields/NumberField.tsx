import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const NumberField = ({ element, form, name }: FieldRendererProps<"Number">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.Input
            id={fieldName}
            type="number"
            placeholder={element.placeholder}
            onKeyDown={(e) => {
              if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              }
            }}
            // Numbers too ambiguous to autofill (age/amount/qty/zip/year). "on" lets browser skip on no-match rather than suppress.
            autoComplete="on"
            inputMode="numeric"
            aria-label={getAriaLabelFallback(element)}
            aria-labelledby={isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)}
            className="h-7 form-input pr-[8px] pl-[10px]"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default NumberField;
