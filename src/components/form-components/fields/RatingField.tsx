import { useState } from "react";

import { RatingStar } from "@/components/ui/rating-star";
import { extractRatingFields } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const RatingField = ({ element, form, name }: FieldRendererProps<"Rating">) => {
  const fieldName = name ?? element.name;
  const { starCount } = extractRatingFields(element);
  // 0 = nothing hovered; otherwise the star under the pointer/focus drives the fill preview.
  const [hovered, setHovered] = useState(0);

  return (
    <form.AppField name={fieldName}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const selected = Number((f.state.value as string | undefined) ?? "") || 0;
        const active = hovered || selected;

        return (
          <>
            <div
              className="flex flex-wrap gap-px"
              role="radiogroup"
              aria-labelledby={getAriaLabelledBy(element)}
              aria-invalid={hasErrors}
              onPointerLeave={() => setHovered(0)}
            >
              {Array.from({ length: starCount }, (_, i) => {
                const value = i + 1;
                const isOn = value <= active;
                return (
                  <button
                    // eslint-disable-next-line @eslint-react/no-array-index-key
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={value === selected}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    onPointerEnter={() => setHovered(value)}
                    onFocus={() => setHovered(value)}
                    onBlur={() => setHovered(0)}
                    // Re-clicking the current rating clears it (matches the linear-scale toggle).
                    onClick={() => f.handleChange(value === selected ? "" : String(value))}
                    className={cn(
                      "cursor-pointer rounded-[4px] transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                      isOn ? "text-[#FFC107]" : "text-(--color-gray-300) hover:text-[#FFC107]/50",
                      hasErrors && !isOn && "text-destructive/40",
                    )}
                  >
                    <RatingStar filled={isOn} className="size-5" />
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

export default RatingField;
