import type { Country } from "react-phone-number-input";

import { useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const PhoneField = ({ element, form, name }: FieldRendererProps<"Phone">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
  // Empty whitelist ⇒ all countries: coerce [] to undefined so the dropdown isn't emptied.
  const allowedCountries = element.allowedCountries?.length
    ? (element.allowedCountries as Country[])
    : undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.PhoneInput
            id={fieldName}
            placeholder={element.placeholder}
            autoComplete="tel"
            // Author whitelist restricts the country dropdown; unset/empty ⇒ all countries.
            // Default to the first allowed; unset ⇒ PhoneInput auto-detects from the browser locale.
            countries={allowedCountries}
            defaultCountry={allowedCountries?.[0]}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            variant="sm"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default PhoneField;
