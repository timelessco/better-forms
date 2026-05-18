import { getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const PhoneField = ({ element, form }: FieldRendererProps<"Phone">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.PhoneInput
          id={element.name}
          placeholder={element.placeholder}
          aria-label={getAriaLabelFallback(element)}
          aria-labelledby={getAriaLabelledBy(element)}
          variant="sm"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default PhoneField;
