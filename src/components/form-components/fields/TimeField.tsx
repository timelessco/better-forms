import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const TimeField = ({ element, form, name }: FieldRendererProps<"Time">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.TimePicker
            id={fieldName}
            use24Hour={element.use24Hour}
            aria-label={getAriaLabelFallback(element)}
            aria-labelledby={isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)}
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default TimeField;
