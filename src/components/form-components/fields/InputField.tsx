import { getAriaLabelFallback, getAriaLabelledBy, guessAutocomplete } from "./shared";
import type { FieldRendererProps } from "./shared";

const InputField = ({ element, form }: FieldRendererProps<"Input">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.Input
          id={element.name}
          type="text"
          placeholder={element.placeholder}
          minLength={element.minLength}
          maxLength={element.maxLength}
          autoComplete={guessAutocomplete(element)}
          aria-label={getAriaLabelFallback(element)}
          aria-labelledby={getAriaLabelledBy(element)}
          className="h-7 form-input pr-[8px] pl-[10px]"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default InputField;
