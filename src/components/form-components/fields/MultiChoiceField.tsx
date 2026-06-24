import { useMemo } from "react";

import { DropdownSelect } from "@/components/ui/dropdown-select";
import { getOptionOrdinal } from "@/components/ui/form-option-item-constants";
import { cn } from "@/lib/utils";
import { useOptionHotkeys } from "./option-keyboard";
import {
  getAriaLabelledBy,
  ImageOptionGrid,
  OptionOrdinalBadge,
  OptionRadioMark,
  shuffleOptions,
} from "./shared";
import type { FieldRendererProps } from "./shared";

const MultiChoiceField = ({ element, form }: FieldRendererProps<"MultiChoice">) => {
  // Default preserves today's look — single-choice shows letter badges until changed.
  const labelStyle = element.optionLabel ?? "letters";
  const { optionRefs, getKeyDownHandler } = useOptionHotkeys(labelStyle, element.options.length);

  // Shuffle once per mount when enabled, so option order stays stable while answering.
  const options = useMemo(
    () => (element.shuffle ? shuffleOptions(element.options) : element.options),
    [element.options, element.shuffle],
  );

  // "Show as dropdown" display mode — same single answer, rendered as a select.
  if (element.showAsDropdown) {
    return (
      <form.AppField name={element.name}>
        {(f) => {
          const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
          return (
            <>
              <DropdownSelect
                id={element.name}
                options={options}
                value={(f.state.value as string | undefined) ?? ""}
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
        const selectedValue = (f.state.value as string | undefined) ?? "";

        // Letter/Number labels double as hotkeys: press an option's ordinal to pick it.
        const handleKeyDown = getKeyDownHandler((idx) => {
          const option = options[idx];
          f.handleChange(selectedValue === option.value ? "" : option.value);
        });

        // Picture-choice grid of cover-cropped tiles when image mode is on.
        if (element.showImage) {
          return (
            <>
              <ImageOptionGrid
                options={options}
                multi={false}
                labelStyle={labelStyle}
                hasErrors={hasErrors}
                isSelected={(value) => selectedValue === value}
                onToggle={(value) => f.handleChange(selectedValue === value ? "" : value)}
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
                      // Figma selected state: gray-200 rounded row pill (badge flips to white). No
                      // focus ring (the keyboard handler programmatically focuses, which would show
                      // focus-visible on click); a subtle gray-100 bg marks keyboard focus instead.
                      "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-base transition-colors outline-none",
                      isSelected ? "bg-gray-200" : "focus-visible:bg-gray-100",
                      hasErrors && "text-destructive",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
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

export default MultiChoiceField;
