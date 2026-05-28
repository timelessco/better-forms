import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy, guessAutocomplete } from "./shared";
import type { FieldRendererProps } from "./shared";

const InputField = ({ element, form, name }: FieldRendererProps<"Input">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.Input
            id={fieldName}
            type="text"
            placeholder={element.placeholder}
            minLength={element.minLength}
            maxLength={element.maxLength}
            autoComplete={guessAutocomplete(element)}
            aria-label={getAriaLabelFallback(element)}
            aria-labelledby={isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)}
            className="h-7 form-input pr-[8px] pl-[10px]"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default InputField;
