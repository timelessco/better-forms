import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import type { FieldRendererProps } from "./shared";

const DateField = ({ element, form }: FieldRendererProps<"Date">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      return (
        <>
          <DatePicker
            value={(f.state.value as string) ?? null}
            onChange={(val) => f.handleChange(val ?? "")}
            placeholder={element.placeholder}
            className={cn(hasErrors && "ring-1 ring-destructive")}
          />
          <f.FieldError />
        </>
      );
    }}
  </form.AppField>
);

export default DateField;
