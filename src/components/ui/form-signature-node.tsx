import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { IconSignature } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Script font stack for the "Sign here" placeholder — no bundled font, falls back across OSes to a
// handwriting face, then generic cursive.
const SIGNATURE_FONT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';

export const FormSignatureElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn("relative w-full cursor-default rounded-[8px]")}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      {/* Single bordered box (Figma 25650-15525): type glyph bottom-left, "Sign here" centered. */}
      <div
        contentEditable={false}
        className="relative flex h-36 w-full items-end gap-1 overflow-hidden rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] px-2.5 py-[7px] elevation-sm select-none"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                contentEditable={false}
                className="flex shrink-0 items-center justify-center px-1.5 py-1 text-muted-foreground select-none"
              />
            }
          >
            <IconSignature className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Signature</TooltipContent>
        </Tooltip>
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-muted-foreground/45 italic"
          style={{ fontFamily: SIGNATURE_FONT }}
        >
          Sign here
        </span>
      </div>
      {/* Plate's BelowRootNodes (incl. BlockSelection) ride with {children}, which we hide —
          render the highlight explicitly so block selection still shows. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
