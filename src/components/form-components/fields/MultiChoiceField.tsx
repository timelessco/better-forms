import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import { cn } from "@/lib/utils";
import { useOptionHotkeys } from "./option-keyboard";
import { OptionOrdinalBadge, OptionRadioMark } from "./shared";
import type { FieldRendererProps } from "./shared";

const MultiChoiceField = ({ element, form }: FieldRendererProps<"MultiChoice">) => {
  // Default preserves today's look — single-choice shows letter badges until changed.
  const labelStyle = element.optionLabel ?? "letters";
  const { optionRefs, getKeyDownHandler } = useOptionHotkeys(labelStyle, element.options.length);

  return (
    <form.AppField name={element.name}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selectedValue = (f.state.value as string | undefined) ?? "";

        // Letter/Number labels double as hotkeys: press an option's ordinal to pick it.
        const handleKeyDown = getKeyDownHandler((idx) => {
          const option = element.options[idx];
          f.handleChange(selectedValue === option.value ? "" : option.value);
        });

        return (
          <>
            <div className="flex flex-col gap-2">
              {element.options.map((option, idx) => {
                const isSelected = selectedValue === option.value;
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    onKeyDown={handleKeyDown}
                    onClick={() => f.handleChange(isSelected ? "" : option.value)}
                    aria-invalid={hasErrors}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 py-1 text-left text-sm transition-colors",
                      hasErrors && "text-destructive",
                    )}
                  >
                    {labelStyle === "none" ? (
                      <OptionRadioMark selected={isSelected} hasErrors={hasErrors} />
                    ) : (
                      <OptionOrdinalBadge
                        text={getOptionOrdinal(labelStyle, idx)}
                        selected={isSelected}
                        hasErrors={hasErrors}
                      />
                    )}
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

export default MultiChoiceField;
