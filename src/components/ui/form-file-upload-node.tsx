import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { BlockSelection } from "@/components/ui/block-selection";
import { UploadIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormInputNode } from "@/hooks/use-form-input-node";
import {
  buildPlaceholderLabel,
  DEFAULT_MAX_FILE_SIZE_MB,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";
import { cn } from "@/lib/utils";

export const FormFileUploadElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const { focused, isSelected } = useFormInputNode(element);

  const maxFileSize =
    typeof element.maxFileSize === "number" ? element.maxFileSize : DEFAULT_MAX_FILE_SIZE_MB;
  const { category, subtypes } = resolveAllowedSubtypes(
    element.allowedFileTypes,
    element.allowedFileExtensions,
  );
  const fileTypesLabel = buildPlaceholderLabel(category, subtypes);

  return (
    <PlateElement
      attributes={{ ...attributes, "data-bf-input": "true" }}
      className={cn(
        "relative flex min-h-20 w-full max-w-[464px] cursor-default flex-col items-center justify-center rounded-[8px] border border-dashed border-border/60 bg-[var(--color-gray-50)] p-4 shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)]",
        isSelected && focused && "ring-[3px] ring-ring/50",
      )}
      element={element}
      {...rest}
    >
      <div className="hidden">{children}</div>
      <div
        contentEditable={false}
        className="flex flex-col items-center gap-1.5 text-muted-foreground/50 select-none"
      >
        <UploadIcon className="size-5" />
        <span className="text-sm">Click or drag to upload</span>
        <span className="text-xs">
          {fileTypesLabel} up to {maxFileSize}MB
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
