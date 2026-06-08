import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { IconSignature } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

// Script font stack for the "Sign here" placeholder — no bundled font, falls back across OSes to a
// handwriting face, then generic cursive.
const SIGNATURE_FONT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';

export const FormSignatureElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const { focused, isSelected } = useFormInputNode(element);

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
      <div
        contentEditable={false}
        className="flex h-36 flex-1 items-center justify-center rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] elevation-sm select-none"
      >
        <span
          className="text-3xl text-muted-foreground/45 italic"
          style={{ fontFamily: SIGNATURE_FONT }}
        >
          Sign here
        </span>
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
          <IconSignature className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="left">Signature</TooltipContent>
      </Tooltip>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
