import { getAriaLabelFallback } from "./shared";
import type { FieldRendererProps } from "./shared";

const LinkField = ({ element, form }: FieldRendererProps<"Link">) => (
  <form.AppField name={element.name}>
    {(f) => (
      <>
        <f.Input
          id={element.name}
          type="url"
          placeholder={element.placeholder}
          autoComplete="off"
          aria-label={getAriaLabelFallback(element)}
          className="h-7 form-input pr-[8px] pl-[10px]"
        />
        <f.FieldError />
      </>
    )}
  </form.AppField>
);

export default LinkField;
