import { buildScaleValues } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const LinearScaleField = ({ element, form }: FieldRendererProps<"LinearScale">) => {
  const values = buildScaleValues(element.min, element.max, element.step);
  // Anchor labels under the scale (block menu "Add Anchor", Figma 25634-16668).
  const { anchorLeft, anchorCenter, anchorRight } = element;
  const hasAnchors = Boolean(anchorLeft || anchorCenter || anchorRight);

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selectedValue = (f.state.value as string | undefined) ?? "";

        return (
          <>
            {/* w-fit: anchors span exactly the buttons' width so Right sits under the last tile */}
            <div className="flex w-fit max-w-full flex-col gap-3">
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
                        "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-[8px] px-2 text-[14px] elevation-sm transition-colors",
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
              {hasAnchors && (
                <div className="flex items-baseline gap-2 text-[13px] leading-none text-muted-foreground">
                  <span className="flex-1 truncate text-left">{anchorLeft}</span>
                  <span className="flex-1 truncate text-center">{anchorCenter}</span>
                  <span className="flex-1 truncate text-right">{anchorRight}</span>
                </div>
              )}
            </div>
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default LinearScaleField;
