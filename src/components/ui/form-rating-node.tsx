import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { IconRating } from "@/components/ui/icons";
import { RatingStar } from "@/components/ui/rating-star";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { extractRatingFields } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

export const FormRatingElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const { focused, isSelected } = useFormInputNode(element);

  const { starCount } = extractRatingFields(element);

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative flex w-full cursor-default items-start gap-2 rounded-[8px]",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
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
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              contentEditable={false}
              className="mt-1 flex shrink-0 items-center justify-center text-muted-foreground select-none"
            />
          }
        >
          <IconRating className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="left">Rating</TooltipContent>
      </Tooltip>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
