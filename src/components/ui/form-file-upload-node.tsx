import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { UploadIcon, UploadLineIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import { DEFAULT_MAX_FILE_SIZE_MB } from "@/lib/form-schema/file-upload-types";
import { cn } from "@/lib/utils";

export const FormFileUploadElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const { focused, isSelected } = useFormInputNode(element);

  const maxFileSize =
    typeof element.maxFileSize === "number" ? element.maxFileSize : DEFAULT_MAX_FILE_SIZE_MB;

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative flex min-h-[100px] w-full cursor-default flex-col items-center justify-center gap-1.5 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] p-4 elevation-sm",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      <div
        contentEditable={false}
        className="flex flex-col items-center gap-1.5 text-muted-foreground select-none"
      >
        <div className="flex items-center gap-1.5">
          <UploadLineIcon className="size-4" />
          <span className="text-sm">Click to choose a file or drag here</span>
        </div>
        <span className="text-[13px] text-[color:var(--color-gray-500)]">
          Max file up to {maxFileSize}MB
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              contentEditable={false}
              className="absolute top-2 right-2 flex items-center justify-center text-muted-foreground select-none"
            />
          }
        >
          <UploadIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="left">File upload</TooltipContent>
      </Tooltip>
      {/* Plate passes BelowRootNodes (which includes BlockSelection) as a
          sibling of `children`, so wrapping {children} in `display:none`
          above also hides the highlight. Render it explicitly instead. */}
      <BlockSelection {...props} />
    </PlateElement>
  );
};
