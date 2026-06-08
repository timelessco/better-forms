import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { IconLinearScale } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { buildScaleValues, LINEAR_SCALE_DEFAULTS } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

export const FormLinearScaleElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const { focused, isSelected } = useFormInputNode(element);

  const min = (element.scaleMin as number | undefined) ?? LINEAR_SCALE_DEFAULTS.min;
  const max = (element.scaleMax as number | undefined) ?? LINEAR_SCALE_DEFAULTS.max;
  const step = (element.scaleStep as number | undefined) ?? LINEAR_SCALE_DEFAULTS.step;
  const values = buildScaleValues(min, max, step);

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
      <div contentEditable={false} className="flex flex-1 flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={String(value)}
            className="flex h-8 min-w-8 items-center justify-center rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] px-2 text-sm text-foreground tabular-nums elevation-sm"
          >
            {String(value)}
          </span>
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
          <IconLinearScale className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="left">Linear scale</TooltipContent>
      </Tooltip>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
