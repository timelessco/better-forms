import { isFormattingOn } from "@/lib/form-schema/number-format";
import { FORM_INPUT_CLS, useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const NumberField = ({ element, form, name }: FieldRendererProps<"Number">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
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
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              className={FORM_INPUT_CLS}
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
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              className={FORM_INPUT_CLS}
            />
            <f.FieldError />
          </>
        )
      }
    </form.AppField>
  );
};

export default NumberField;
