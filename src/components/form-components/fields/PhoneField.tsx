import type { Country } from "react-phone-number-input";

import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const PhoneField = ({ element, form, name }: FieldRendererProps<"Phone">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.PhoneInput
            id={fieldName}
            placeholder={element.placeholder}
            autoComplete="tel"
            // Author-set default country; unset ⇒ PhoneInput auto-detects from the browser locale.
            defaultCountry={element.defaultCountryCode as Country | undefined}
            aria-label={getAriaLabelFallback(element)}
            aria-labelledby={isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)}
            variant="sm"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default PhoneField;
