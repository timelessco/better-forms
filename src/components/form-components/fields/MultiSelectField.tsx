import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import type { FieldRendererProps } from "./shared";

const MultiSelectField = ({ element, form }: FieldRendererProps<"MultiSelect">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      const selectedValues = (f.state.value as string[] | undefined) ?? [];

      return (
        <>
          <MultiSelect
            options={element.options}
            value={selectedValues}
            onChange={(val) => f.handleChange(val)}
            className={cn(hasErrors && "[&>button]:ring-1 [&>button]:ring-destructive")}
          />
          <f.FieldError />
        </>
      );
    }}
  </form.AppField>
);

export default MultiSelectField;
