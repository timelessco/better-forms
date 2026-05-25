import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const DateField = ({ element, form }: FieldRendererProps<"Date">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      return (
        <>
          <DatePicker
            id={element.name}
            name={element.name}
            value={(f.state.value as string) ?? null}
            onChange={(val) => f.handleChange(val ?? "")}
            placeholder={element.placeholder}
            aria-invalid={hasErrors}
            aria-labelledby={getAriaLabelledBy(element)}
            className={cn(hasErrors && "ring-1 ring-destructive")}
          />
          <f.FieldError />
        </>
      );
    }}
  </form.AppField>
);

export default DateField;
