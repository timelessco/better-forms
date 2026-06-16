import { isFormattingOn } from "@/lib/form-schema/number-format";
import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const NumberField = ({ element, form, name }: FieldRendererProps<"Number">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  const ariaLabelledBy = isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element);
  const formatted = isFormattingOn({
    format: element.numberFormat,
    decimalSeparator: element.decimalSeparator,
    thousandsSeparator: element.thousandsSeparator,
  });
  return (
    <form.AppField name={fieldName}>
      {(f) =>
        formatted ? (
          <>
            {/* Format on (separators / currency / percent): text input, parses back to a raw number. */}
            <f.NumberFormatInput
              id={fieldName}
              type="text"
              inputMode="decimal"
              placeholder={element.placeholder}
              format={element.numberFormat}
              decimalSeparator={element.decimalSeparator}
              thousandsSeparator={element.thousandsSeparator}
              autoComplete="off"
              aria-label={getAriaLabelFallback(element)}
              aria-labelledby={ariaLabelledBy}
              className="h-[30px] form-input pr-[8px] pl-[10px]"
            />
            <f.FieldError />
          </>
        ) : (
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
              aria-labelledby={ariaLabelledBy}
              className="h-[30px] form-input pr-[8px] pl-[10px]"
            />
            <f.FieldError />
          </>
        )
      }
    </form.AppField>
  );
};

export default NumberField;
