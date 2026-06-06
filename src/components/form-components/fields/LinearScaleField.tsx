import { buildScaleValues } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const LinearScaleField = ({ element, form }: FieldRendererProps<"LinearScale">) => {
  const values = buildScaleValues(element.min, element.max, element.step);

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selectedValue = (f.state.value as string | undefined) ?? "";

        return (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby={getAriaLabelledBy(element)}
              aria-invalid={hasErrors}
            >
              {values.map((value) => {
                const stringValue = String(value);
                const isSelected = selectedValue === stringValue;
                return (
                  <button
                    key={stringValue}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={stringValue}
                    onClick={() => f.handleChange(isSelected ? "" : stringValue)}
                    className={cn(
                      "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[8px] px-2 text-sm tabular-nums elevation-sm transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-[var(--form-input-bg,var(--color-gray-50))] text-foreground hover:bg-secondary",
                      hasErrors && !isSelected && "ring-1 ring-destructive",
                    )}
                  >
                    {stringValue}
                  </button>
                );
              })}
            </div>
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default LinearScaleField;
