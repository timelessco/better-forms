import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy, guessAutocomplete } from "./shared";
import type { FieldRendererProps } from "./shared";

const TextareaField = ({ element, form, name }: FieldRendererProps<"Textarea">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.Textarea
            id={fieldName}
            placeholder={element.placeholder}
            minLength={element.minLength}
            maxLength={element.maxLength}
            autoComplete={guessAutocomplete(element)}
            aria-label={getAriaLabelFallback(element)}
            aria-labelledby={isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)}
            className="min-h-24 form-input pr-[8px] pl-[10px]"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default TextareaField;
