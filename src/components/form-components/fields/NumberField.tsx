import { getAriaLabelFallback } from "./shared";
import type { FieldRendererProps } from "./shared";

const NumberField = ({ element, form }: FieldRendererProps<"Number">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.Input
          id={element.name}
          type="number"
          placeholder={element.placeholder}
          onKeyDown={(e) => {
            if (e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
              e.preventDefault();
            }
          }}
          autoComplete="off"
          aria-label={getAriaLabelFallback(element)}
          className="h-7 form-input pr-[8px] pl-[10px]"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default NumberField;
