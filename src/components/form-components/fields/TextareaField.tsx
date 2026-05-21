import { getAriaLabelFallback, getAriaLabelledBy, guessAutocomplete } from "./shared";
import type { FieldRendererProps } from "./shared";

const TextareaField = ({ element, form }: FieldRendererProps<"Textarea">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.Textarea
          id={element.name}
          placeholder={element.placeholder}
          minLength={element.minLength}
          maxLength={element.maxLength}
          autoComplete={guessAutocomplete(element)}
          aria-label={getAriaLabelFallback(element)}
          aria-labelledby={getAriaLabelledBy(element)}
          className="min-h-24 form-input pr-[8px] pl-[10px]"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default TextareaField;
