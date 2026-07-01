import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { RatingStar } from "@/components/ui/rating-star";
import { extractRatingFields } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

export const FormRatingElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;

  const { starCount } = extractRatingFields(element);

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn("relative flex w-full cursor-default items-start gap-2 rounded-[8px]")}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      <div contentEditable={false} className="flex flex-1 flex-wrap gap-px">
        {Array.from({ length: starCount }, (_, i) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <RatingStar key={i} filled={false} className="size-5 text-(--color-gray-300)" />
        ))}
      </div>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
