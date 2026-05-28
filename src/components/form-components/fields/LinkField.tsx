import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const LinkField = ({ element, form, name }: FieldRendererProps<"Link">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
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

export default LinkField;
