import { guessAutocomplete, useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const TextareaField = ({ element, form, name }: FieldRendererProps<"Textarea">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
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
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            // Figma multi-line answer: 22px line-height (local; ! beats the field-list line-height pin)
            className="min-h-24 form-input pr-[8px] pl-[10px] leading-[22px]!"
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default TextareaField;
