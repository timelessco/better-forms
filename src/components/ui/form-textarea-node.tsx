import type { PlateElementProps } from "platejs/react";

import { PlateElement } from "platejs/react";

import { AlignLeftIcon } from "@/components/ui/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFieldLabelText, useFormInputNode } from "@/hooks/use-form-input-node";
import { cn } from "@/lib/utils";

export const FormTextareaElement = ({ children, ...props }: PlateElementProps) => {
  const { attributes, element, ...rest } = props;
  const placeholder = element.placeholder as string | undefined;
  const { focused, isSelected } = useFormInputNode(element);
  // Pulled from the preceding label block so the editor's add-item indicator
  // reads e.g. "Add full name" (matching the live preview) instead of the
  // generic "Add item". Hook subscribes to label edits and updates live.
  const fieldLabel = useFieldLabelText(element);
  const isFieldArray = (element as { isFieldArray?: boolean }).isFieldArray === true;
  const addLabelText = `Add${fieldLabel ? ` ${fieldLabel.toLowerCase()}` : " item"}`;

  return (
    <div className="w-full max-w-[464px]">
      <PlateElement
        attributes={{ ...attributes, placeholder, "data-bf-input": "true" }}
        className={cn(
          "relative flex min-h-24 w-full cursor-text items-start gap-[4px] rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] pr-[8px] pl-[10px] text-sm caret-current elevation-sm before:top-2.5",
          isSelected && focused && "ring-[3px] ring-ring/50",
        )}
        element={element}
        {...rest}
      >
        <span className="block min-w-px flex-1 pt-2.5 pb-2 text-muted-foreground/50 outline-none">
          {children}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                contentEditable={false}
                className="mt-3 ml-1 flex shrink-0 items-center justify-center self-start text-muted-foreground select-none"
              />
            }
          >
            <AlignLeftIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="left">Long answer</TooltipContent>
        </Tooltip>
      </PlateElement>
      {isFieldArray && (
        <span
          contentEditable={false}
          aria-hidden="true"
          className="mt-2 inline-flex h-7 w-fit cursor-default items-center gap-1.5 rounded-lg border-none bg-secondary px-2.5 text-[0.8rem] font-normal text-secondary-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] select-none"
        >
          <span aria-hidden="true">+</span>
          {addLabelText}
        </span>
      )}
    </div>
  );
};
