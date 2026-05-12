import { getAriaLabelFallback } from "./shared";
import type { FieldRendererProps } from "./shared";

const TimeField = ({ element, form }: FieldRendererProps<"Time">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.TimePicker id={element.name} aria-label={getAriaLabelFallback(element)} />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default TimeField;
