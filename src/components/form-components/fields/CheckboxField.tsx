import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { useOptionHotkeys } from "./option-keyboard";
import { getAriaLabelledBy, ImageOptionGrid, OptionOrdinalBadge, shuffleOptions } from "./shared";
import type { FieldRendererProps } from "./shared";

const CheckboxField = ({ element, form }: FieldRendererProps<"Checkbox">) => {
  // Default preserves today's look — checkbox controls until a letter/number label is chosen.
  const labelStyle = element.optionLabel ?? "none";
  const { optionRefs, getKeyDownHandler } = useOptionHotkeys(labelStyle, element.options.length);

  // Shuffle once per mount when enabled, so option order stays stable while answering.
  const options = useMemo(
    () => (element.shuffle ? shuffleOptions(element.options) : element.options),
    [element.options, element.shuffle],
  );

  // "Show as dropdown" display mode — same multi answer, rendered as a multi-select dropdown.
  if (element.showAsDropdown) {
    return (
      <form.AppField name={element.name}>
        {(f) => {
          const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
          return (
            <>
              <MultiSelect
                id={element.name}
                options={options}
                value={(f.state.value as string[] | undefined) ?? []}
                onChange={(val) => f.handleChange(val)}
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
  }

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
          const option = options[idx];
          toggle(option.value, !selectedValues.includes(option.value));
        });

        // Picture-choice grid of cover-cropped tiles when image mode is on.
        if (element.showImage) {
          return (
            <>
              <ImageOptionGrid
                options={options}
                multi
                labelStyle={labelStyle}
                hasErrors={hasErrors}
                isSelected={(value) => selectedValues.includes(value)}
                onToggle={(value) => toggle(value, !selectedValues.includes(value))}
                optionRefs={optionRefs}
                onKeyDown={handleKeyDown}
              />
              <f.FieldError />
            </>
          );
        }

        return (
          <>
            <div className="flex flex-col gap-2">
              {options.map((option, idx) => {
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
                      // Figma selected state: gray-200 rounded row pill (badge flips to white). No
                      // focus ring (the keyboard handler programmatically focuses, which would show
                      // focus-visible on click); a subtle gray-100 bg marks keyboard focus instead.
                      "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors outline-none",
                      isSelected ? "bg-gray-200" : "focus-visible:bg-gray-100",
                      hasErrors && "text-destructive",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <OptionOrdinalBadge
                        text={getOptionOrdinal(labelStyle, idx)}
                        selected={isSelected}
                        hasErrors={hasErrors}
                      />
                      <span>{option.label}</span>
                    </span>
                    {option.image && (
                      <img
                        src={option.image}
                        alt=""
                        className="block h-auto max-w-[280px] rounded-lg"
                      />
                    )}
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
