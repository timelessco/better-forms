import { FORM_INPUT_CLS, guessAutocomplete, useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const InputField = ({ element, form, name }: FieldRendererProps<"Input">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
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
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className={FORM_INPUT_CLS}
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default InputField;
