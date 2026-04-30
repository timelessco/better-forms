import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "./shared";
import type { FieldRendererProps } from "./shared";

const CheckboxField = ({ element, form }: FieldRendererProps<"Checkbox">) => (
  <form.AppField name={element.name}>
    {(f) => {
      const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
      const errorMessage = hasErrors ? extractErrorMessage(f.state.meta.errors[0]) : "";
      const selectedValues = (f.state.value as string[] | undefined) ?? [];

      return (
        <>
          <div className="flex flex-col gap-2">
            {element.options.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2",
                  hasErrors && "text-destructive",
                )}
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      f.handleChange([...selectedValues, option.value]);
                    } else {
                      f.handleChange(selectedValues.filter((v: string) => v !== option.value));
                    }
                  }}
                  aria-invalid={hasErrors}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
          {hasErrors && <p className="text-sm text-destructive">{errorMessage}</p>}
        </>
      );
    }}
  </form.AppField>
);

export default CheckboxField;
