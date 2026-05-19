import { getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const EmailField = ({ element, form }: FieldRendererProps<"Email">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.Input
          id={element.name}
          type="email"
          placeholder={element.placeholder}
          autoComplete="off"
          aria-label={getAriaLabelFallback(element)}
          aria-labelledby={getAriaLabelledBy(element)}
          className="h-7 form-input pr-[8px] pl-[10px]"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default EmailField;
