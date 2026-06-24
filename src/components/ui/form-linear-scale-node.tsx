import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { buildScaleValues, LINEAR_SCALE_DEFAULTS } from "@/lib/form-schema/form-field-constants";
import { cn } from "@/lib/utils";

export const FormLinearScaleElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;

  const min = (element.scaleMin as number | undefined) ?? LINEAR_SCALE_DEFAULTS.min;
  const max = (element.scaleMax as number | undefined) ?? LINEAR_SCALE_DEFAULTS.max;
  const step = (element.scaleStep as number | undefined) ?? LINEAR_SCALE_DEFAULTS.step;
  const values = buildScaleValues(min, max, step);

  // Anchor labels under the scale (block menu "Add Anchor", Figma 25634-16668).
  const anchorLeft = (element.anchorLeft as string | undefined)?.trim();
  const anchorCenter = (element.anchorCenter as string | undefined)?.trim();
  const anchorRight = (element.anchorRight as string | undefined)?.trim();
  const hasAnchors = Boolean(anchorLeft || anchorCenter || anchorRight);

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn("relative flex w-full cursor-default items-start gap-2 rounded-[8px]")}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      <div contentEditable={false} className="flex flex-1 flex-col">
        {/* w-fit: anchors span exactly the tiles' width so Right sits under the last tile */}
        <div className="flex w-fit max-w-full flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {values.map((value) => (
              <span
                key={String(value)}
                className="flex h-8 min-w-8 items-center justify-center rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] px-2 text-[14px] text-foreground elevation-sm"
              >
                {String(value)}
              </span>
            ))}
          </div>
          {hasAnchors && (
            <div className="flex items-baseline gap-2 text-[13px] leading-none text-muted-foreground">
              <span className="flex-1 truncate text-left">{anchorLeft}</span>
              <span className="flex-1 truncate text-center">{anchorCenter}</span>
              <span className="flex-1 truncate text-right">{anchorRight}</span>
            </div>
          )}
        </div>
      </div>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
