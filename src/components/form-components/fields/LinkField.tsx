import { FORM_INPUT_CLS, useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const LinkField = ({ element, form, name }: FieldRendererProps<"Link">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.Input
            id={fieldName}
            type="url"
            placeholder={element.placeholder}
            autoComplete="url"
            inputMode="url"
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

export default LinkField;
