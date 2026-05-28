import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const EmailField = ({ element, form, name }: FieldRendererProps<"Email">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.Input
            id={fieldName}
            type="email"
            placeholder={element.placeholder}
            autoComplete="email"
            inputMode="email"
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

export default EmailField;
