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
            // Numbers are too ambiguous to autofill reliably (could be age,
            // amount, quantity, postal code, year, …). "on" lets browsers
            // skip autofill on no-match instead of being actively suppressed.
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
