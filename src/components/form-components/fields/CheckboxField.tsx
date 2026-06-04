import { Checkbox } from "@/components/ui/checkbox";
import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import { cn } from "@/lib/utils";
import { useOptionHotkeys } from "./option-keyboard";
import { OptionOrdinalBadge } from "./shared";
import type { FieldRendererProps } from "./shared";

const CheckboxField = ({ element, form }: FieldRendererProps<"Checkbox">) => {
  // Default preserves today's look — checkbox controls until a letter/number label is chosen.
  const labelStyle = element.optionLabel ?? "none";
  const { optionRefs, getKeyDownHandler } = useOptionHotkeys(labelStyle, element.options.length);

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selectedValues = (f.state.value as string[] | undefined) ?? [];
        const toggle = (value: string, checked: boolean) => {
          if (checked) {
            f.handleChange([...selectedValues, value]);
          } else {
            f.handleChange(selectedValues.filter((v: string) => v !== value));
          }
        };

        // Letter/Number labels double as hotkeys: press an option's ordinal to toggle it.
        const handleKeyDown = getKeyDownHandler((idx) => {
          const option = element.options[idx];
          toggle(option.value, !selectedValues.includes(option.value));
        });

        return (
          <>
            <div className="flex flex-col gap-2">
              {element.options.map((option, idx) => {
                const isSelected = selectedValues.includes(option.value);
                if (labelStyle === "none") {
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2",
                        hasErrors && "text-destructive",
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => toggle(option.value, Boolean(checked))}
                        aria-invalid={hasErrors}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  );
                }
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    onKeyDown={handleKeyDown}
                    onClick={() => toggle(option.value, !isSelected)}
                    aria-pressed={isSelected}
                    aria-invalid={hasErrors}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 py-1 text-left text-sm transition-colors",
                      hasErrors && "text-destructive",
                    )}
                  >
                    <OptionOrdinalBadge
                      text={getOptionOrdinal(labelStyle, idx)}
                      selected={isSelected}
                      hasErrors={hasErrors}
                    />
                    <span>{option.label}</span>
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

export default CheckboxField;
