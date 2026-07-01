import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { fieldLabelId, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const DateField = ({ element, form, name }: FieldRendererProps<"Date">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  return (
    <form.AppField name={fieldName}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        return (
          <>
            <DatePicker
              id={fieldName}
              name={fieldName}
              value={(f.state.value as string) ?? null}
              onChange={(val) => f.handleChange(val ?? "")}
              placeholder={element.placeholder}
              aria-invalid={hasErrors}
              aria-labelledby={
                isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element)
              }
              className={cn(hasErrors && "form-input-error")}
            />
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default DateField;
