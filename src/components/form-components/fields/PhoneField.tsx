import { getAriaLabelFallback } from "./shared";
import type { FieldRendererProps } from "./shared";

const PhoneField = ({ element, form }: FieldRendererProps<"Phone">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.PhoneInput
          id={element.name}
          placeholder={element.placeholder}
          aria-label={getAriaLabelFallback(element)}
          variant="sm"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default PhoneField;
