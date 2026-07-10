import { useFieldBinding } from "./shared";
import type { FieldRendererProps } from "./shared";

const TimeField = ({ element, form, name }: FieldRendererProps<"Time">) => {
  const { fieldName, ariaLabel, ariaLabelledBy } = useFieldBinding(element, name);
  return (
    <form.AppField name={fieldName}>
      {(f) => (
        <>
          <f.TimePicker
            id={fieldName}
            use24Hour={element.use24Hour}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

export default TimeField;
